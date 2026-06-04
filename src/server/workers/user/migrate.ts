import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

function getAccountType(user: {
    candidate: { id: string } | null;
    employer: { id: string } | null;
}): 1 | 2 | 3 {
    if (user.candidate && user.employer)
        return 3;

    if (user.employer)
        return 2;

    return 1;
}

export default async function migrateWorker(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId) {
            return res.status(401).json({
                success: false,
                message: 'Please login before migrating your account.'
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                id: req.session.userId
            },
            select: {
                id: true,
                candidate: {
                    select: {
                        id: true
                    }
                },
                employer: {
                    select: {
                        id: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Unable to find your account.'
            });
        }

        const currentAccountType = getAccountType(user);

        if (currentAccountType === 3) {
            req.session.accountType = 3;

            return req.session.save((saveErr) => {
                if (saveErr)
                    return next(saveErr);

                return res.json({
                    success: true,
                    message: 'Your account is already flexible.',
                    redirectTo:
                        req.body?.mode === 'employer'
                            ? '/employer/home'
                            : '/candidate/home'
                });
            });
        }

        if (currentAccountType === 1) {
            await prisma.employer.upsert({
                where: {
                    userId: user.id
                },
                update: {},
                create: {
                    userId: user.id
                }
            });
        }

        if (currentAccountType === 2) {
            await prisma.candidate.upsert({
                where: {
                    userId: user.id
                },
                update: {},
                create: {
                    userId: user.id
                }
            });
        }

        req.session.accountType = 3;

        return req.session.save((saveErr) => {
            if (saveErr)
                return next(saveErr);

            return res.json({
                success: true,
                message: 'Your account has been migrated to a flexible account.',
                redirectTo:
                    currentAccountType === 2
                        ? '/employer/home'
                        : '/candidate/home'
            });
        });
    } catch (err) {
        return next(err);
    }
}
