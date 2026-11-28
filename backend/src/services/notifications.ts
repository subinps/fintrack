import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { sendMail } from '../lib/mailer';

export interface NotifyInput {
    userId: string;
    type: string;
    title: string;
    body: string;
    href?: string | null;
    /** Send an email as well; reserved for things a user must not miss. */
    email?: boolean;
}

export async function createNotification(input: NotifyInput) {
    const notification = await prisma.notification.create({
        data: {
            userId: input.userId,
            type: input.type,
            title: input.title,
            body: input.body,
            href: input.href ?? null,
        },
    });

    logger.info({ notificationId: notification.id, userId: input.userId, type: input.type }, 'notification created');

    if (input.email) {
        const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
        if (user?.email) {
            await sendMail(user.email, input.title, `<p>${input.body}</p>`);
        }
    }

    return notification;
}

export async function listNotifications(userId: string, limit = 20) {
    const [items, unread] = await Promise.all([
        prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        }),
        prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unread };
}

export async function markRead(userId: string, id?: number) {
    const result = await prisma.notification.updateMany({
        where: { userId, readAt: null, ...(id ? { id } : {}) },
        data: { readAt: new Date() },
    });
    return result.count;
}
