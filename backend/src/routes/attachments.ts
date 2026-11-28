import express from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'application/pdf']);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!ALLOWED.has(file.mimetype)) return cb(new Error('Attach a photo or PDF (max 5 MB).'));
        cb(null, true);
    },
});

const shape = (attachment: { id: string; transactionId: number | null; filename: string; mimeType: string; sizeBytes: number; createdAt: Date }) => ({
    id: attachment.id,
    transactionId: attachment.transactionId,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    createdAt: attachment.createdAt,
    url: `/api/attachments/${attachment.id}/file`,
});

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
    const transactionId = Number.parseInt(String(req.query.transactionId ?? ''), 10);
    const attachments = await prisma.attachment.findMany({
        where: { userId: req.user!.id, ...(Number.isFinite(transactionId) ? { transactionId } : {}) },
        orderBy: { createdAt: 'desc' },
        select: { id: true, transactionId: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
    });
    res.json(attachments.map(shape));
});

router.post('/', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Choose a file to attach.' });
        const transactionId = req.body.transactionId ? Number.parseInt(String(req.body.transactionId), 10) : null;
        if (transactionId) {
            const owned = await prisma.transaction.findFirst({ where: { id: transactionId, userId: req.user!.id }, select: { id: true } });
            if (!owned) return res.status(404).json({ error: 'Transaction not found.' });
            const count = await prisma.attachment.count({ where: { transactionId } });
            if (count >= 10) return res.status(400).json({ error: 'This receipt already has 10 attachments.' });
        }
        const attachment = await prisma.attachment.create({
            data: {
                userId: req.user!.id,
                transactionId: transactionId ?? null,
                filename: req.file.originalname.slice(0, 160),
                mimeType: req.file.mimetype,
                sizeBytes: req.file.size,
                data: req.file.buffer,
            },
            select: { id: true, transactionId: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
        });
        res.status(201).json(shape(attachment));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not attach that file.';
        res.status(400).json({ error: message });
    }
});

router.get('/:id/file', authenticateToken, async (req: AuthRequest, res) => {
    const attachment = await prisma.attachment.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
        select: { data: true, mimeType: true, filename: true },
    });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found.' });
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.filename)}"`);
    res.send(Buffer.from(attachment.data));
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
    const deleted = await prisma.attachment.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    if (deleted.count === 0) return res.status(404).json({ error: 'Attachment not found.' });
    res.json({ deleted: deleted.count });
});

export default router;
