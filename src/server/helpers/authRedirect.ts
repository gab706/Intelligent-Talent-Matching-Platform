/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response } from 'express';

export function getAuthenticatedHome(req: Request): string | null {
    if (!req.session.isAuthenticated || !req.session.userId)
        return null;

    return req.session.accountType === 2
        ? '/employer/home'
        : '/candidate/home';
}

export function redirectAuthenticated(req: Request, res: Response): boolean {
    const redirectTo = getAuthenticatedHome(req);

    if (!redirectTo)
        return false;

    res.redirect(redirectTo);
    return true;
}
