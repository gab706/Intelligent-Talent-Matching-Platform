import { Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import { prisma } from '../../database/prisma.js';

const SESSION_MS = 1000 * 60 * 60 * 24 * 7;
const CANDIDATE_ACCOUNT_TYPE = 1;
const EMPLOYER_ACCOUNT_TYPE = 2;

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isUniqueConstraintError(err: unknown): boolean {
    return (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: unknown }).code === 'P2002'
    );
}

export default async function registerWorker(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const accountType = Number(req.body?.account_type);
        const email = String(req.body?.email || '').trim().toLowerCase();
        const password = String(req.body?.password || '');
        const confirmPassword = String(req.body?.confirm_password || '');
        const firstName = String(req.body?.first_name || '').trim();
        const lastName = String(req.body?.last_name || '').trim();
        const phone = String(req.body?.phone || '').trim();

        if (![CANDIDATE_ACCOUNT_TYPE, EMPLOYER_ACCOUNT_TYPE].includes(accountType)) {
            return res.json({
                success: false,
                message: 'Invalid account type.'
            });
        }

        if (!email || !password || !confirmPassword || !firstName || !lastName || !phone) {
            return res.json({
                success: false,
                message: 'Please complete all required fields.'
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

        if (password !== confirmPassword) {
            return res.json({
                success: false,
                message: 'Passwords do not match.'
            });
        }

        const existingUser = await prisma.user.findUnique({
            where: {
                email
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

        if (existingUser) {
            if (
                accountType === CANDIDATE_ACCOUNT_TYPE &&
                existingUser.employer &&
                !existingUser.candidate
            ) {
                return res.json({
                    success: false,
                    message: 'Please login and migrate your account'
                });
            }

            if (
                accountType === EMPLOYER_ACCOUNT_TYPE &&
                existingUser.candidate &&
                !existingUser.employer
            ) {
                return res.json({
                    success: false,
                    message: 'Please login and migrate your account'
                });
            }

            return res.json({
                success: false,
                message: 'An account already exists with that email address.'
            });
        }

        const passwordHash = await argon2.hash(password);
        const theme = req.session.theme === 'DARK' ? 'DARK' : 'LIGHT';

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                firstName,
                lastName,
                phone,
                theme,
                lastLoginAt: new Date(),
                ...(accountType === CANDIDATE_ACCOUNT_TYPE
                    ? {
                        candidate: {
                            create: {}
                        }
                    }
                    : {
                        employer: {
                            create: {}
                        }
                    })
            },
            select: {
                id: true,
                role: true,
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

        if (accountType === CANDIDATE_ACCOUNT_TYPE && !user.candidate) {
            return res.json({
                success: false,
                message: 'Unable to create candidate profile.'
            });
        }

        if (accountType === EMPLOYER_ACCOUNT_TYPE && !user.employer) {
            return res.json({
                success: false,
                message: 'Unable to create employer profile.'
            });
        }

        req.session.regenerate((err) => {
            if (err)
                return next(err);

            req.session.isAuthenticated = true;
            req.session.userId = user.id;
            req.session.userRole = user.role === 'ADMIN' ? 1 : 0;
            req.session.accountType =
                accountType === EMPLOYER_ACCOUNT_TYPE
                    ? EMPLOYER_ACCOUNT_TYPE
                    : CANDIDATE_ACCOUNT_TYPE;
            req.session.theme = user.theme;
            req.session.createdAt = Date.now();
            req.session.lastActivityAt = Date.now();
            req.session.cookie.maxAge = SESSION_MS;

            req.session.save((saveErr) => {
                if (saveErr)
                    return next(saveErr);

                return res.json({
                    success: true,
                    message:
                        accountType === EMPLOYER_ACCOUNT_TYPE
                            ? 'Employer account created successfully.'
                            : 'Candidate account created successfully.',
                    redirectTo:
                        accountType === EMPLOYER_ACCOUNT_TYPE
                            ? '/employer/home'
                            : '/candidate/home'
                });
            });
        });
    } catch (err) {
        if (isUniqueConstraintError(err)) {
            return res.json({
                success: false,
                message: 'An account already exists with that email address.'
            });
        }

        return next(err);
    }
}
