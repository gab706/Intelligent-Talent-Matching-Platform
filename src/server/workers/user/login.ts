import { Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import { prisma } from '../../database/prisma.js';

const SHORT_SESSION_MS = 1000 * 60 * 60 * 2; // 2 hours
const LONG_SESSION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getAccountType(user: {
    candidate: { id: string } | null;
    employer: { id: string } | null;
}): 1 | 2 | 3 {
    if (user.candidate && user.employer)
        return 3;

    if (user.candidate)
        return 1;

    if (user.employer)
        return 2;

    return 1;
}

export default async function loginWorker(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        const remember = req.body?.remember === 'true' || req.body?.remember === 'on';

        if (!email || !password) {
            return res.json({
                success: false,
                message: 'Email and password are required.'
            });
        }

        if (!isValidEmail(email)) {
            return res.json({
                success: false,
                message: 'Please enter a valid email address.'
            });
        }

        if (password.length < 8) {
            return res.json({
                success: false,
                message: 'Password must be at least 8 characters.'
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                email
            },
            select: {
                id: true,
                email: true,
                passwordHash: true,
                role: true,
                accountStatus: true,
                theme: true,
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
            return res.json({
                success: false,
                message: 'Email address does not exist.'
            });
        }

        if (user.accountStatus === 'SUSPENDED') {
            return res.json({
                success: false,
                message: 'This account has been suspended.'
            });
        }

        if (user.accountStatus === 'DELETED') {
            return res.json({
                success: false,
                message: 'This account has been deleted.'
            });
        }

        const passwordMatches = await argon2.verify(
            user.passwordHash,
            password
        );

        if (!passwordMatches) {
            return res.json({
                success: false,
                message: 'Incorrect password.'
            });
        }

        req.session.regenerate(async (err) => {
            if (err)
                return next(err);

            req.session.isAuthenticated = true;

            req.session.userId = user.id;

            req.session.userRole =
                user.role === 'ADMIN'
                    ? 1
                    : 0;

            req.session.accountType = getAccountType(user);

            req.session.theme = user.theme;

            req.session.createdAt = Date.now();
            req.session.lastActivityAt = Date.now();

            req.session.cookie.maxAge =
                remember
                    ? LONG_SESSION_MS
                    : SHORT_SESSION_MS;

            await prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    lastLoginAt: new Date()
                }
            });

            req.session.save((saveErr) => {
                if (saveErr)
                    return next(saveErr);

                const redirectTo =
                    req.session.accountType === 2
                        ? '/employer/home'
                        : '/candidate/home';

                return res.json({
                    success: true,
                    message: 'Logged in successfully.',
                    redirectTo
                });
            });
        });
    } catch (err) {
        return next(err);
    }
}
