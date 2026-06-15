/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import { prisma } from '../../database/prisma.js';
import { getRequestIp } from '../../helpers/request-ip.js';
import { linkSessionToUser } from '../../helpers/session-links.js';

const SHORT_SESSION_MS = 1000 * 60 * 60 * 2; // 2 hours
const LONG_SESSION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const FAILED_LOGIN_WINDOW_MS = 1000 * 60 * 15; // 15 minutes
const LOGIN_THROTTLE_MS = 1000 * 60 * 15; // 15 minutes
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_FAILED_MESSAGE = 'Unable to log in with those credentials.';
const LOGIN_THROTTLED_MESSAGE = 'Unable to log in right now. Please try again later.';

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

async function recordFailedLogin(user: {
    id: string;
    failedLoginAttempts: number;
    failedLoginWindowStartedAt: Date | null;
}, ipAddress: string, now: Date): Promise<void> {
    const windowStartedAt = user.failedLoginWindowStartedAt;
    const isInsideWindow = Boolean(
        windowStartedAt &&
        now.getTime() - windowStartedAt.getTime() <= FAILED_LOGIN_WINDOW_MS
    );
    const failedLoginAttempts = isInsideWindow
        ? user.failedLoginAttempts + 1
        : 1;
    const nextWindowStartedAt = isInsideWindow
        ? windowStartedAt
        : now;

    if (failedLoginAttempts < MAX_FAILED_LOGIN_ATTEMPTS) {
        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                failedLoginAttempts,
                failedLoginWindowStartedAt: nextWindowStartedAt,
                throttledUntil: null
            }
        });
        return;
    }

    const datetimeEnd = new Date(now.getTime() + LOGIN_THROTTLE_MS);

    await prisma.$transaction([
        prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                failedLoginAttempts: 0,
                failedLoginWindowStartedAt: null,
                throttledUntil: datetimeEnd
            }
        }),
        prisma.suspension.create({
            data: {
                ipAddress,
                userId: user.id,
                reason: `Automatic login throttle after ${MAX_FAILED_LOGIN_ATTEMPTS} failed attempts.`,
                issuedBySystem: true,
                datetimeEnd
            }
        })
    ]);
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
        const ipAddress = getRequestIp(req);
        const now = new Date();

        const activeIpSuspension = await prisma.suspension.findFirst({
            where: {
                ipAddress,
                issuedBySystem: true,
                datetimeEnd: {
                    gt: now
                }
            },
            select: {
                id: true
            }
        });

        if (activeIpSuspension) {
            return res.json({
                success: false,
                message: LOGIN_THROTTLED_MESSAGE
            });
        }

        if (!email || !password) {
            return res.json({
                success: false,
                message: LOGIN_FAILED_MESSAGE
            });
        }

        if (!isValidEmail(email)) {
            return res.json({
                success: false,
                message: LOGIN_FAILED_MESSAGE
            });
        }

        if (password.length < 8) {
            return res.json({
                success: false,
                message: LOGIN_FAILED_MESSAGE
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
                throttledUntil: true,
                failedLoginAttempts: true,
                failedLoginWindowStartedAt: true,
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
                message: LOGIN_FAILED_MESSAGE
            });
        }

        if (user.throttledUntil && user.throttledUntil > now) {
            return res.json({
                success: false,
                message: LOGIN_THROTTLED_MESSAGE
            });
        }

        let accountStatus = user.accountStatus;

        if (accountStatus === 'SUSPENDED') {
            const activeSuspension = await prisma.suspension.findFirst({
                where: {
                    userId: user.id,
                    issuedById: {
                        not: null
                    },
                    datetimeEnd: {
                        gt: now
                    }
                },
                select: {
                    id: true
                }
            });

            if (activeSuspension) {
                return res.json({
                    success: false,
                    message: LOGIN_FAILED_MESSAGE
                });
            }

            await prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    accountStatus: 'ACTIVE'
                }
            });
            accountStatus = 'ACTIVE';
        }

        if (accountStatus === 'DELETED') {
            return res.json({
                success: false,
                message: LOGIN_FAILED_MESSAGE
            });
        }

        const passwordMatches = await argon2.verify(
            user.passwordHash,
            password
        );

        if (!passwordMatches) {
            await recordFailedLogin(user, ipAddress, now);

            return res.json({
                success: false,
                message: LOGIN_FAILED_MESSAGE
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
                    lastLoginAt: new Date(),
                    failedLoginAttempts: 0,
                    failedLoginWindowStartedAt: null,
                    throttledUntil: null
                }
            });

            req.session.save((saveErr) => {
                if (saveErr)
                    return next(saveErr);

                const redirectTo =
                    req.session.accountType === 2
                        ? '/employer/home'
                        : '/candidate/home';

                linkSessionToUser(req.sessionID, user.id)
                    .then(() => res.json({
                        success: true,
                        message: 'Logged in successfully.',
                        redirectTo
                    }))
                    .catch(next);
            });
        });
    } catch (err) {
        return next(err);
    }
}
