import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

export default async function notificationReadWorker(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		if (!req.session.isAuthenticated || !req.session.userId) {
			return res.status(401).json({
				success: false,
				message: 'Please login to manage notifications.'
			});
		}

		const { notificationId, all } = req.body ?? {};
		const now = new Date();

		if (all === true) {
			await prisma.notification.updateMany({
				where: {
					recipientId: req.session.userId,
					isRead: false
				},
				data: {
					isRead: true,
					readAt: now
				}
			});
		} else {
			if (!notificationId || typeof notificationId !== 'string') {
				return res.status(400).json({
					success: false,
					message: 'Invalid notification.'
				});
			}

			await prisma.notification.updateMany({
				where: {
					id: notificationId,
					recipientId: req.session.userId,
					isRead: false
				},
				data: {
					isRead: true,
					readAt: now
				}
			});
		}

		const unreadCount = await prisma.notification.count({
			where: {
				recipientId: req.session.userId,
				isRead: false
			}
		});

		return res.json({
			success: true,
			unreadCount
		});
	} catch (err) {
		return next(err);
	}
}
