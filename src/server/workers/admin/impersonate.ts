/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';
import { getUserAccountType } from '../../helpers/account-type.js';
import { linkSessionToUser } from '../../helpers/session-links.js';

export default async function adminImpersonateWorker(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		if (!req.session.isAuthenticated || !req.session.userId) {
			return res.status(401).json({
				success: false,
				message: 'Please login as an admin.'
			});
		}

		if (req.session.impersonatorUserId) {
			return res.status(400).json({
				success: false,
				message: 'Already impersonating a user.'
			});
		}

		const targetUserId = String(req.body?.userId || '');
		const [admin, targetUser] = await Promise.all([
			prisma.user.findUnique({
				where: {
					id: req.session.userId
				},
				select: {
					id: true,
					role: true,
					theme: true
				}
			}),
			prisma.user.findUnique({
				where: {
					id: targetUserId
				},
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					role: true,
					theme: true,
					accountStatus: true,
					candidate: {
						select: {
							id: true
						}
					},
					employer: {
						select: {
							id: true
						}
					}
				}
			})
		]);

		if (admin?.role !== 'ADMIN') {
			return res.status(403).json({
				success: false,
				message: 'Only admins can impersonate users.'
			});
		}

		if (!targetUser) {
			return res.status(404).json({
				success: false,
				message: 'User could not be found.'
			});
		}

		if (targetUser.id === admin.id || targetUser.role === 'ADMIN') {
			return res.status(403).json({
				success: false,
				message: 'Admins cannot impersonate this account.'
			});
		}

		if (!['ACTIVE', 'SUSPENDED'].includes(targetUser.accountStatus)) {
			return res.status(400).json({
				success: false,
				message: 'This user cannot be impersonated.'
			});
		}

		req.session.impersonatorUserId = admin.id;
		req.session.impersonatorUserRole = req.session.userRole;
		req.session.impersonatorAccountType = req.session.accountType;
		req.session.impersonatorTheme = req.session.theme || admin.theme;
		req.session.impersonatedUserId = targetUser.id;
		req.session.impersonatedUserName = `${targetUser.firstName} ${targetUser.lastName}`.trim() || targetUser.email;
		req.session.userId = targetUser.id;
		req.session.userRole = 0;
		req.session.accountType = getUserAccountType(targetUser);
		req.session.theme = targetUser.theme;

		req.session.save((err) => {
			if (err)
				return next(err);

			linkSessionToUser(req.sessionID, targetUser.id)
				.then(() => res.json({
					success: true,
					message: `Now viewing as ${req.session.impersonatedUserName}.`,
					redirectTo: req.session.accountType === 2
						? '/employer/home'
						: '/candidate/home'
				}))
				.catch(next);
		});
	} catch (err) {
		return next(err);
	}
}
