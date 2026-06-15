/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma.js';

export default async function SharedController(req: Request, res: Response, next: NextFunction): Promise<void> {
	if (!req.session.theme)
		req.session.theme = 'LIGHT';

	res.payload.theme = req.session.theme;
	res.payload.currentPath = req.path;
	res.payload.isAuthenticated = Boolean(req.session.isAuthenticated && req.session.userId);
	res.payload.accountType = req.session.accountType;
	res.payload.accountLabel =
		req.session.accountType === 3
			? 'Flexible'
			: req.session.accountType === 2
				? 'Employer'
				: 'Candidate';
	res.payload.isAccountHomePage = [
		'/candidate/home',
		'/candidate/find-a-job',
		'/candidate/applications',
		'/candidate/profile',
		'/candidate/migrate',
		'/employer/home',
		'/employer/find-a-candidate',
		'/employer/applications',
		'/employer/migrate',
		'/employer/postings'
	].includes(req.path) || req.path.startsWith('/employer/companies') || req.path.startsWith('/admin');
	res.payload.avatarPath = '/images/avatar/default.png';
	res.payload.notifications = [];
	res.payload.unreadNotificationCount = 0;
	res.payload.isImpersonating = Boolean(req.session.impersonatorUserId && req.session.impersonatedUserName);
	res.payload.impersonatedUserName = req.session.impersonatedUserName;

	if (req.session.isAuthenticated && req.session.userId) {
		const notificationCutoff = new Date();
		notificationCutoff.setDate(notificationCutoff.getDate() - 7);

		const user = await prisma.user.findUnique({
			where: {
				id: req.session.userId
			},
			select: {
				avatarHash: true,
				email: true,
				firstName: true,
				lastName: true,
				phone: true,
				isMember: true,
				role: true
			}
		});

		if (user) {
			res.payload.email = user.email;
			res.payload.firstName = user.firstName;
			res.payload.lastName = user.lastName;
			res.payload.fullName = `${user.firstName} ${user.lastName}`.trim();
			res.payload.phone = user.phone;
			res.payload.isMember = user.isMember;
			res.payload.isAdmin = user.role === 'ADMIN';

			if (user.avatarHash)
				res.payload.avatarPath = `/images/avatars/${user.avatarHash}`;
		}

		const [unreadNotificationCount, notifications] = await Promise.all([
			prisma.notification.count({
				where: {
					recipientId: req.session.userId,
					isRead: false,
					createdAt: {
						gte: notificationCutoff
					}
				}
			}),
			prisma.notification.findMany({
				where: {
					recipientId: req.session.userId,
					createdAt: {
						gte: notificationCutoff
					}
				},
				select: {
					id: true,
					title: true,
					message: true,
					type: true,
					isRead: true,
					sender: {
						select: {
							avatarHash: true
						}
					}
				},
				orderBy: {
					createdAt: 'desc'
				}
			})
		]);

		res.payload.unreadNotificationCount = unreadNotificationCount;
		res.payload.notifications = notifications.map((notification: {
			id: string;
			title: string;
			message: string;
			type: string;
			isRead: boolean;
			sender: {
				avatarHash: string | null;
			} | null;
		}) => {
			const senderAvatarPath = notification.sender?.avatarHash
				? `/images/avatars/${notification.sender.avatarHash}`
				: '/images/avatar/default.png';
			const avatarPath =
				notification.type === 'USER'
					? senderAvatarPath
					: '/images/avatar/default.png';

			return {
				id: notification.id,
				title: notification.title,
				message: notification.message,
				type: notification.type,
				isRead: notification.isRead,
				avatarPath
			};
		});
	}

	next();
}
