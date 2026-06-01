import { Request, Response, NextFunction } from 'express';
import { redirectAuthenticated } from './authRedirect.js';

export default function registerHelper(
    req: Request,
    res: Response,
    _next: NextFunction
) {
    if (redirectAuthenticated(req, res))
        return;

    return res.render('pages/register', {
        ...res.payload
    });
}
