import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

export default async function notificationReadWorker(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		if (!req.session.isAuthenticated || !req.session.userId) {
			return res.json({
				success: false,
				message: 'Please login to manage notifications.'
			});
		}

		const { notificationId, all } = req.body ?? {};
		const now = new Date();
		const notificationCutoff = new Date();
		notificationCutoff.setDate(notificationCutoff.getDate() - 7);

		if (all === true) {
			await prisma.notification.updateMany({
				where: {
					recipientId: req.session.userId,
					isRead: false,
					createdAt: {
						gte: notificationCutoff
					}
				},
				data: {
					isRead: true,
					readAt: now
				}
			});
		} else {
			if (!notificationId || typeof notificationId !== 'string') {
				return res.json({
					success: false,
					message: 'Invalid notification.'
				});
			}

			const notification = await prisma.notification.findFirst({
				where: {
					id: notificationId,
					recipientId: req.session.userId
				},
				select: {
					isRead: true
				}
			});

			if (!notification) {
				return res.json({
					success: false,
					message: 'Notification could not be found.'
				});
			}

			if (notification.isRead) {
				return res.json({
					success: false,
					message: 'This notification has already been read.'
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
				isRead: false,
				createdAt: {
					gte: notificationCutoff
				}
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
