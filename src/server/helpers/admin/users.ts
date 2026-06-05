import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const USERS_PER_PAGE = 10;

type SiteUser = {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    accountStatus: string;
    isMember: boolean;
    lastLoginAt: Date | null;
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

function getLastActiveLabel(value: Date | null): { label: string; isActiveNow: boolean } {
    if (!value)
        return {
            label: 'Never',
            isActiveNow: false
        };

    const elapsedMs = Date.now() - value.getTime();

    if (elapsedMs <= FIVE_MINUTES_MS) {
        return {
            label: 'Active Now',
            isActiveNow: true
        };
    }

    const minutes = Math.max(1, Math.floor(elapsedMs / (1000 * 60)));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days >= 1)
        return {
            label: `${days} ${days === 1 ? 'day' : 'days'} ago`,
            isActiveNow: false
        };

    if (hours >= 1)
        return {
            label: `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`,
            isActiveNow: false
        };

    return {
        label: `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`,
        isActiveNow: false
    };
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
        const totalUsers = await prisma.user.count({
            where
        });
        const pageCount = Math.max(1, Math.ceil(totalUsers / USERS_PER_PAGE));
        const safePage = Math.min(currentPage, pageCount);
        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
                accountStatus: true,
                isMember: true,
                lastLoginAt: true,
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
            orderBy: [
                {
                    lastName: 'asc'
                },
                {
                    firstName: 'asc'
                }
            ],
            skip: (safePage - 1) * USERS_PER_PAGE,
            take: USERS_PER_PAGE
        });

        const formattedUsers = (users as SiteUser[]).map(user => {
            const lastActive = getLastActiveLabel(user.lastLoginAt);

            return {
                id: user.id,
                name: `${user.firstName} ${user.lastName}`.trim(),
                role: user.role,
                type: getAccountType(user),
                isCurrentUser: user.id === req.session.userId,
                isSuspended: user.accountStatus === 'SUSPENDED',
                isMember: user.isMember,
                lastActiveLabel: lastActive.label,
                isActiveNow: lastActive.isActiveNow
            };
        });

        return res.render('pages/admin/users', {
            ...res.payload,
            searchQuery,
            users: formattedUsers,
            currentPage: safePage,
            pageCount,
            totalUsers,
            showingCount: formattedUsers.length
        });
    } catch (err) {
        return next(err);
    }
}
