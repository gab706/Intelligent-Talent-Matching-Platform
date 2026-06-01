import { Request, Response, NextFunction } from 'express';

export default function candidateHomeHelper(
    req: Request,
    res: Response,
    _next: NextFunction
) {
    if (req.session.accountType === 2)
        return res.redirect('/employer/home');

    return res.render('pages/candidate/home', {
        ...res.payload,
        userId: req.session.userId
    });
}
