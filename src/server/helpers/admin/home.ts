import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

type RecentNotification = {
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
    recipient: {
        firstName: string;
        lastName: string;
        email: string;
    };
};

function formatUser(user: { firstName: string; lastName: string; email: string }): string {
    return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

function formatDateTime(value: Date): string {
    return new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit'
    }).format(value);
}

export default async function adminHomeHelper(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId)
            return res.redirect('/login');

        const user = await prisma.user.findUnique({
            where: {
                id: req.session.userId
            },
            select: {
                role: true
            }
        });

        if (user?.role !== 'ADMIN') {
            return req.session.accountType === 2
                ? res.redirect('/employer/home')
                : res.redirect('/candidate/home');
        }

        const [
            totalUsers,
            adminUsers,
            memberUsers,
            suspendedUsers,
            unreadNotifications,
            totalNotifications,
            recentNotifications
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({
                where: {
                    role: 'ADMIN'
                }
            }),
            prisma.user.count({
                where: {
                    isMember: true
                }
            }),
            prisma.user.count({
                where: {
                    accountStatus: 'SUSPENDED'
                }
            }),
            prisma.notification.count({
                where: {
                    isRead: false
                }
            }),
            prisma.notification.count(),
            prisma.notification.findMany({
                select: {
                    id: true,
                    type: true,
                    title: true,
                    message: true,
                    isRead: true,
                    createdAt: true,
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
                },
                take: 5
            })
        ]);

        return res.render('pages/admin/home', {
            ...res.payload,
            userId: req.session.userId,
            stats: [
                {
                    label: 'Site Users',
                    value: totalUsers,
                    meta: `${memberUsers} member${memberUsers === 1 ? '' : 's'}`
                },
                {
                    label: 'Admins',
                    value: adminUsers,
                    meta: 'Platform access'
                },
                {
                    label: 'Suspended',
                    value: suspendedUsers,
                    meta: 'Locked accounts'
                },
                {
                    label: 'Unread Notifications',
                    value: unreadNotifications,
                    meta: `${totalNotifications} total`
                }
            ],
            recentNotifications: (recentNotifications as RecentNotification[]).map(notification => ({
                id: notification.id,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                isRead: notification.isRead,
                recipient: formatUser(notification.recipient),
                createdAtLabel: formatDateTime(notification.createdAt)
            }))
        });
    } catch (err) {
        return next(err);
    }
}
