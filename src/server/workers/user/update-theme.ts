import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

export default async function updateThemeWorker(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { theme } = req.body ?? {};

        if (!['LIGHT', 'DARK'].includes(theme)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Theme.'
            });
        }

        req.session.theme = theme;

        if (!req.session.isAuthenticated || !req.session.userId) {
            return res.json({
                success: true,
                persisted: false,
                theme
            });
        }

        const user = await prisma.user.update({
            where: {
                id: req.session.userId
            },
            data: {
                theme
            },
            select: {
                id: true,
                theme: true
            }
        });

        req.session.theme = user.theme;

        req.session.save((saveErr) => {
            if (saveErr)
                return next(saveErr);

            return res.json({
                success: true,
                persisted: true,
                theme: user.theme
            });
        });
    } catch (err) {
        return next(err);
    }
}