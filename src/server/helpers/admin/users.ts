/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const USERS_PER_PAGE = 10;

type SiteUser = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    avatarHash: string | null;
    role: string;
    accountStatus: string;
    isMember: boolean;
    theme: string;
    lastLoginAt: Date | null;
    throttledUntil: Date | null;
    failedLoginAttempts: number;
    failedLoginWindowStartedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    sessions: Array<{
        updatedAt: Date;
        expire: Date;
    }>;
    suspensions: Array<{
        reason: string;
        datetimeAdded: Date;
        datetimeEnd: Date;
        issuedBy: {
            firstName: string;
            lastName: string;
            email: string;
        } | null;
    }>;
    candidate: {
        id: string;
    } | null;
    employer: {
        id: string;
    } | null;
};

function getAccountType(user: { candidate: { id: string } | null; employer: { id: string } | null }): string {
    if (user.candidate && user.employer)
        return 'FLEXIBLE';

    if (user.employer)
        return 'EMPLOYER';

    if (user.candidate)
        return 'CANDIDATE';

    return '';
}

function getLastActiveLabel(value: Date | null): { label: string; isActiveNow: boolean; isOffline: boolean } {
    if (!value)
        return {
            label: 'Offline',
            isActiveNow: false,
            isOffline: true
        };

    const elapsedMs = Date.now() - value.getTime();

    if (elapsedMs <= FIVE_MINUTES_MS) {
        return {
            label: 'Active Now',
            isActiveNow: true,
            isOffline: false
        };
    }

    const minutes = Math.max(1, Math.floor(elapsedMs / (1000 * 60)));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days >= 1)
        return {
            label: `${days} ${days === 1 ? 'day' : 'days'} ago`,
            isActiveNow: false,
            isOffline: false
        };

    if (hours >= 1)
        return {
            label: `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`,
            isActiveNow: false,
            isOffline: false
        };

    return {
        label: `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`,
        isActiveNow: false,
        isOffline: false
    };
}

function toIso(value: Date | null): string {
    if (!value)
        return '';

    return value.toISOString();
}

function serialiseForScript(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

export default async function adminUsersHelper(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId)
            return res.redirect('/login');

        const currentUser = await prisma.user.findUnique({
            where: {
                id: req.session.userId
            },
            select: {
                role: true
            }
        });

        if (currentUser?.role !== 'ADMIN') {
            return req.session.accountType === 2
                ? res.redirect('/employer/home')
                : res.redirect('/candidate/home');
        }

        const searchQuery = String(req.query.search || '').trim();
        const requestedPage = Number(req.query.page || 1);
        const currentPage = Number.isFinite(requestedPage) && requestedPage > 0
            ? Math.floor(requestedPage)
            : 1;
        const where = searchQuery
            ? {
                OR: [
                    {
                        firstName: {
                            contains: searchQuery,
                            mode: 'insensitive'
                        }
                    },
                    {
                        lastName: {
                            contains: searchQuery,
                            mode: 'insensitive'
                        }
                    },
                    {
                        email: {
                            contains: searchQuery,
                            mode: 'insensitive'
                        }
                    }
                ]
            }
            : undefined;
        const now = new Date();
        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatarHash: true,
                role: true,
                accountStatus: true,
                isMember: true,
                theme: true,
                lastLoginAt: true,
                throttledUntil: true,
                failedLoginAttempts: true,
                failedLoginWindowStartedAt: true,
                createdAt: true,
                updatedAt: true,
                sessions: {
                    where: {
                        expire: {
                            gt: now
                        }
                    },
                    select: {
                        updatedAt: true,
                        expire: true
                    },
                    orderBy: {
                        updatedAt: 'desc'
                    }
                },
                suspensions: {
                    where: {
                        issuedById: {
                            not: null
                        },
                        datetimeEnd: {
                            gt: now
                        }
                    },
                    select: {
                        reason: true,
                        datetimeAdded: true,
                        datetimeEnd: true,
                        issuedBy: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        }
                    },
                    orderBy: {
                        datetimeAdded: 'desc'
                    },
                    take: 1
                },
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
            },
        });

        const sortedUsers = (users as SiteUser[]).sort((first, second) => {
            const firstLastActive = first.sessions[0]?.updatedAt?.getTime() || 0;
            const secondLastActive = second.sessions[0]?.updatedAt?.getTime() || 0;

            if (firstLastActive !== secondLastActive)
                return secondLastActive - firstLastActive;

            const firstName = `${first.lastName} ${first.firstName}`.trim();
            const secondName = `${second.lastName} ${second.firstName}`.trim();

            return firstName.localeCompare(secondName);
        });
        const totalUsers = sortedUsers.length;
        const pageCount = Math.max(1, Math.ceil(totalUsers / USERS_PER_PAGE));
        const safePage = Math.min(currentPage, pageCount);
        const pagedUsers = sortedUsers.slice(
            (safePage - 1) * USERS_PER_PAGE,
            safePage * USERS_PER_PAGE
        );
        const formattedUsers = pagedUsers.map(user => {
            const lastActive = getLastActiveLabel(user.sessions[0]?.updatedAt || null);
            const accountType = getAccountType(user);
            const activeSuspension = user.accountStatus === 'SUSPENDED'
                ? user.suspensions[0] || null
                : null;
            const issuedByName = activeSuspension?.issuedBy
                ? `${activeSuspension.issuedBy.firstName} ${activeSuspension.issuedBy.lastName}`.trim() || activeSuspension.issuedBy.email
                : 'Unknown admin';

            return {
                id: user.id,
                name: `${user.firstName} ${user.lastName}`.trim(),
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                avatarHash: user.avatarHash || '',
                avatarUrl: user.avatarHash ? `/images/avatars/${user.avatarHash}` : '/images/avatar/default.png',
                role: user.role,
                type: accountType,
                accountStatus: user.accountStatus,
                isCurrentUser: user.id === req.session.userId,
                isSuspended: user.accountStatus === 'SUSPENDED',
                isMember: user.isMember,
                theme: user.theme,
                lastLoginAt: toIso(user.lastLoginAt),
                throttledUntil: toIso(user.throttledUntil),
                failedLoginAttempts: user.failedLoginAttempts,
                failedLoginWindowStartedAt: toIso(user.failedLoginWindowStartedAt),
                createdAt: toIso(user.createdAt),
                updatedAt: toIso(user.updatedAt),
                activeSessionsCount: user.sessions.length,
                lastActiveLabel: lastActive.label,
                isActiveNow: lastActive.isActiveNow,
                isOffline: lastActive.isOffline,
                activeSuspension: activeSuspension
                    ? {
                        reason: activeSuspension.reason,
                        issuedBy: issuedByName,
                        datetimeEnd: toIso(activeSuspension.datetimeEnd),
                        startedAt: toIso(activeSuspension.datetimeAdded)
                    }
                    : null,
                canSuspend: user.id !== req.session.userId,
                canImpersonate: user.id !== req.session.userId && user.role !== 'ADMIN'
            };
        });

        return res.render('pages/admin/users', {
            ...res.payload,
            searchQuery,
            users: formattedUsers,
            currentPage: safePage,
            pageCount,
            totalUsers,
            showingCount: formattedUsers.length,
            usersJson: serialiseForScript(formattedUsers)
        });
    } catch (err) {
        return next(err);
    }
}
