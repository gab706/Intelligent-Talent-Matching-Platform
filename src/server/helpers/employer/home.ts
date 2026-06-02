import { Request, Response, NextFunction } from 'express';

export default function employerHomeHelper(
    req: Request,
    res: Response,
    _next: NextFunction
) {
    if (!req.session.isAuthenticated || !req.session.userId)
        return res.redirect('/login');

    if (req.session.accountType === 1)
        return res.redirect('/candidate/home');

    return res.render('pages/employer/home', {
        ...res.payload,
        userId: req.session.userId
    });
}
