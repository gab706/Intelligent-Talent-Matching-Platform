/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import { unlinkSession } from './session-links.js';

export default async function logoutHelper(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const sessionId = req.sessionID;

    delete req.session.isAuthenticated;
    delete req.session.userId;
    delete req.session.userRole;
    delete req.session.accountType;
    delete req.session.csrfToken;
    delete req.session.impersonatorUserId;
    delete req.session.impersonatorUserRole;
    delete req.session.impersonatorAccountType;
    delete req.session.impersonatorTheme;
    delete req.session.impersonatedUserId;
    delete req.session.impersonatedUserName;

    try {
        await unlinkSession(sessionId);
    } catch (err) {
        return next(err);
    }

    req.session.save((err) => {
        if (err)
            return next(err);

        return res.redirect('/index');
    });
}
