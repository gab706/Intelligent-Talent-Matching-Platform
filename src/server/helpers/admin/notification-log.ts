/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

type NotificationLogItem = {
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    sender: {
        firstName: string;
        lastName: string;
        email: string;
    } | null;
    recipient: {
        firstName: string;
        lastName: string;
        email: string;
    };
};

function formatUser(user: { firstName: string; lastName: string; email: string } | null): string {
    if (!user)
        return 'System';

    return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

export default async function adminNotificationLogHelper(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId)
            return res.redirect('/login');

        const currentUser = await prisma.user.findUnique({
            where: {
                id: req.session.userId
            },
            select: {
                role: true
            }
        });

        if (currentUser?.role !== 'ADMIN') {
            return req.session.accountType === 2
                ? res.redirect('/employer/home')
                : res.redirect('/candidate/home');
        }

        const notifications = await prisma.notification.findMany({
            select: {
                id: true,
                type: true,
                title: true,
                message: true,
                isRead: true,
                sender: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                recipient: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return res.render('pages/admin/notification-log', {
            ...res.payload,
            notifications: (notifications as NotificationLogItem[]).map(notification => ({
                id: notification.id,
                from: formatUser(notification.sender),
                to: formatUser(notification.recipient),
                type: notification.type,
                title: notification.title,
                message: notification.message,
                isRead: notification.isRead
            }))
        });
    } catch (err) {
        return next(err);
    }
}
