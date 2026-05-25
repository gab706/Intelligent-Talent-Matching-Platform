import 'express-session';

declare module 'express-session' {
    interface SessionData {
        userId?: string;
        isAuthenticated?: boolean;
        theme?: string;
        createdAt?: number;
        lastActivityAt?: number;
        csrfToken?: string;
    }
}