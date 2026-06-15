/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

export default async function notificationClearWorker(
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

		if (req.body?.all !== true) {
			return res.json({
				success: false,
				message: 'Invalid notification clear request.'
			});
		}

		const notificationCutoff = new Date();
		notificationCutoff.setDate(notificationCutoff.getDate() - 7);

		await prisma.notification.deleteMany({
			where: {
				recipientId: req.session.userId,
				createdAt: {
					gte: notificationCutoff
				}
			}
		});

		return res.json({
			success: true,
			unreadCount: 0
		});
	} catch (err) {
		return next(err);
	}
}
