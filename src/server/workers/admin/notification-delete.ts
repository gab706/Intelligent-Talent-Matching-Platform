import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

export default async function adminNotificationDeleteWorker(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId) {
            return res.json({
                success: false,
                message: 'Please login as an admin.'
            });
        }

        const admin = await prisma.user.findUnique({
            where: {
                id: req.session.userId
            },
            select: {
                role: true
            }
        });

        if (admin?.role !== 'ADMIN') {
            return res.json({
                success: false,
                message: 'Only admins can delete notifications.'
            });
        }

        const notificationId = String(req.body?.notificationId || '');

        if (!notificationId) {
            return res.json({
                success: false,
                message: 'Invalid notification.'
            });
        }

        const deleted = await prisma.notification.deleteMany({
            where: {
                id: notificationId
            }
        });

        if (!deleted.count) {
            return res.json({
                success: false,
                message: 'Notification could not be found.'
            });
        }

        return res.json({
            success: true,
            message: 'Notification deleted.'
        });
    } catch (err) {
        return next(err);
    }
}
