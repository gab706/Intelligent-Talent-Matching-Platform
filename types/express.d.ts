/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import 'express';

declare global {
	namespace Express {
		interface Response {
			payload: {
				theme?: string;
				userId?: string;
				currentPath?: string;
				isAuthenticated?: boolean;
				accountType?: 1 | 2 | 3;
				avatarPath?: string;
				fullName?: string;
				firstName?: string;
				lastName?: string;
				email?: string;
				phone?: string;
				isMember?: boolean;
				isAdmin?: boolean;
				isImpersonating?: boolean;
				impersonatedUserName?: string;
				accountLabel?: string;
				isAccountHomePage?: boolean;
				notifications?: Array<{
					id: string;
					title: string;
					message: string;
					type?: string;
					isRead?: boolean;
					avatarPath?: string;
				}>;
				unreadNotificationCount?: number;
			};
		}
	}
}

export {};
