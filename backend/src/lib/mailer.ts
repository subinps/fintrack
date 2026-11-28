import nodemailer from 'nodemailer';
import { logger } from './logger';

let transporter: nodemailer.Transporter | null = null;

const getTransporter = (): nodemailer.Transporter | null => {
    if (!process.env.SMTP_HOST) return null;
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 465,
            secure: Number(process.env.SMTP_PORT || 465) === 465,
            auth: process.env.SMTP_USER
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                : undefined,
        });
    }
    return transporter;
};

/**
 * Best-effort email. Notification delivery must never fail the job that produced it,
 * so every error is logged and swallowed.
 */
export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
    const mailer = getTransporter();
    if (!mailer) {
        logger.warn({ to, subject }, 'SMTP is not configured; skipped notification email');
        return false;
    }
    try {
        await mailer.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject,
            html,
        });
        return true;
    } catch (error) {
        logger.error({ err: error, to, subject }, 'failed to send notification email');
        return false;
    }
}
