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
				isAdmin?: boolean;
				accountLabel?: string;
				isAccountHomePage?: boolean;
				notifications?: Array<{
					id: string;
					title: string;
					message: string;
					type?: string;
					avatarPath?: string;
				}>;
				unreadNotificationCount?: number;
			};
		}
	}
}

export {};
