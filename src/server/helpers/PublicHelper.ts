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
	res.payload.isAccountHomePage = ['/candidate/home', '/employer/home'].includes(req.path);
	res.payload.avatarPath = '/images/avatar/default.png';
	res.payload.notifications = [];
	res.payload.unreadNotificationCount = 0;

	if (req.session.isAuthenticated && req.session.userId) {
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
				role: true
			}
		});

		if (user) {
			res.payload.email = user.email;
			res.payload.firstName = user.firstName;
			res.payload.lastName = user.lastName;
			res.payload.fullName = `${user.firstName} ${user.lastName}`.trim();
			res.payload.phone = user.phone;
			res.payload.isAdmin = user.role === 'ADMIN';

			if (user.avatarHash)
				res.payload.avatarPath = `/images/avatars/${user.avatarHash}`;
		}

		const [unreadNotificationCount, notifications] = await Promise.all([
			prisma.notification.count({
				where: {
					recipientId: req.session.userId,
					isRead: false
				}
			}),
			prisma.notification.findMany({
				where: {
					recipientId: req.session.userId,
					isRead: false
				},
				select: {
					id: true,
					title: true,
					message: true,
					type: true,
					sender: {
						select: {
							avatarHash: true
						}
					}
				},
				orderBy: {
					createdAt: 'desc'
				},
				take: 5
			})
		]);

		res.payload.unreadNotificationCount = unreadNotificationCount;
		res.payload.notifications = notifications.map((notification: {
			id: string;
			title: string;
			message: string;
			type: string;
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
				avatarPath
			};
		});
	}

	next();
}
