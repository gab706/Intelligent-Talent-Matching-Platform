import { Request, Response, NextFunction } from 'express';

export default function logoutHelper(
    req: Request,
    res: Response,
    next: NextFunction
) {
    delete req.session.isAuthenticated;
    delete req.session.userId;
    delete req.session.userRole;
    delete req.session.accountType;
    delete req.session.csrfToken;

    req.session.save((err) => {
        if (err)
            return next(err);

        return res.redirect('/index');
    });
}
