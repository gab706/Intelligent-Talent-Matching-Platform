/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import { redirectAuthenticated } from './authRedirect.js';

export default function loginHelper(
    req: Request,
    res: Response,
    _next: NextFunction
) {
    if (redirectAuthenticated(req, res))
        return;

    return res.render('pages/login', {
        ...res.payload
    });
}
