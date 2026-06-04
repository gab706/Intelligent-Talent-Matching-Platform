import { Request, Response, NextFunction } from 'express';

export default function candidateMigrateHelper(
    req: Request,
    res: Response,
    _next: NextFunction
) {
    if (!req.session.isAuthenticated || !req.session.userId)
        return res.redirect('/login');

    if (req.session.accountType === 2)
        return res.redirect('/employer/migrate');

    if (req.session.accountType === 3)
        return res.redirect('/candidate/home');

    return res.render('pages/candidate/migrate', {
        ...res.payload,
        userId: req.session.userId
    });
}
