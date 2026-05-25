import { Request, Response, NextFunction } from 'express';

export default async function loginWorker(
    req: Request,
    res: Response,
    _next: NextFunction
) {
    return res.json({
        success: true,
    });
}