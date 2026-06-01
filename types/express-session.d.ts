import 'express-session';

type SessionUserRole = 0 | 1;
type SessionAccountType = 1 | 2 | 3;

declare module 'express-session' {
    interface SessionData {
        userId?: string;
        userRole?: SessionUserRole;
        accountType?: SessionAccountType;
        isAuthenticated?: boolean;
        theme?: string;
        createdAt?: number;
        lastActivityAt?: number;
        csrfToken?: string;
    }
}