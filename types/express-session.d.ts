/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
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
        impersonatorUserId?: string;
        impersonatorUserRole?: SessionUserRole;
        impersonatorAccountType?: SessionAccountType;
        impersonatorTheme?: string;
        impersonatedUserId?: string;
        impersonatedUserName?: string;
        createdAt?: number;
        lastActivityAt?: number;
        csrfToken?: string;
    }
}
