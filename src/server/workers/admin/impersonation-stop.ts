/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';
import { linkSessionToUser } from '../../helpers/session-links.js';

export default async function adminImpersonationStopWorker(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		if (!req.session.isAuthenticated || !req.session.impersonatorUserId) {
			return res.redirect('/login');
		}

		const admin = await prisma.user.findUnique({
			where: {
				id: req.session.impersonatorUserId
			},
			select: {
				id: true,
				role: true,
				accountStatus: true,
				theme: true
			}
		});

		if (!admin || admin.role !== 'ADMIN' || admin.accountStatus !== 'ACTIVE') {
			return req.session.destroy((err) => {
				if (err)
					return next(err);

				return res.redirect('/login');
			});
		}

		req.session.userId = admin.id;
		req.session.userRole = req.session.impersonatorUserRole ?? 1;
		req.session.accountType = req.session.impersonatorAccountType ?? 1;
		req.session.theme = req.session.impersonatorTheme || admin.theme;
		delete req.session.impersonatorUserId;
		delete req.session.impersonatorUserRole;
		delete req.session.impersonatorAccountType;
		delete req.session.impersonatorTheme;
		delete req.session.impersonatedUserId;
		delete req.session.impersonatedUserName;

		req.session.save((err) => {
			if (err)
				return next(err);

			linkSessionToUser(req.sessionID, admin.id)
				.then(() => res.redirect('/admin/users'))
				.catch(next);
		});
	} catch (err) {
		return next(err);
	}
}
