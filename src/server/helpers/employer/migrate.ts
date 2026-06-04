import { Request, Response, NextFunction } from 'express';

export default function employerMigrateHelper(
    req: Request,
    res: Response,
    _next: NextFunction
) {
    if (!req.session.isAuthenticated || !req.session.userId)
        return res.redirect('/login');

    if (req.session.accountType === 1)
        return res.redirect('/candidate/migrate');

    if (req.session.accountType === 3)
        return res.redirect('/employer/home');

    return res.render('pages/employer/migrate', {
        ...res.payload,
        userId: req.session.userId
    });
}
