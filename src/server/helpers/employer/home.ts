/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

function formatDate(value: Date | null): string {
    if (!value)
        return '';

    return new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    }).format(value);
}

function daysUntil(value: Date | null): number | null {
    if (!value)
        return null;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const target = new Date(value);
    target.setHours(0, 0, 0, 0);

    return Math.ceil((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function employerHomeHelper(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId)
            return res.redirect('/login');

        if (req.session.accountType === 1)
            return res.redirect('/candidate/home');

        const now = new Date();
        const twoWeeksFromNow = new Date();
        twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

        const [employer, candidateCount] = await Promise.all([
            prisma.employer.findUnique({
                where: {
                    userId: req.session.userId
                },
                select: {
                    id: true,
                    companies: {
                        select: {
                            role: true,
                            company: {
                                select: {
                                    id: true,
                                    name: true,
                                    industry: true,
                                    location: true,
                                    ownedById: true,
                                    jobPostings: {
                                        select: {
                                            id: true,
                                            jobTitle: true,
                                            jobDescription: true,
                                            status: true,
                                            workMode: true,
                                            jobLocation: true,
                                            closingDate: true,
                                            updatedAt: true,
                                            _count: {
                                                select: {
                                                    applications: true
                                                }
                                            }
                                        },
                                        orderBy: {
                                            updatedAt: 'desc'
                                        }
                                    },
                                    _count: {
                                        select: {
                                            employers: true
                                        }
                                    }
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
                    },
                    receivedCompanyInvitations: {
                        where: {
                            status: 'PENDING'
                        },
                        select: {
                            id: true,
                            company: {
                                select: {
                                    name: true
                                }
                            },
                            invitedByEmployer: {
                                select: {
                                    user: {
                                        select: {
                                            firstName: true,
                                            lastName: true
                                        }
                                    }
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc'
                        },
                        take: 3
                    }
                }
            }),
            prisma.candidate.count({
                where: {
                    user: {
                        accountStatus: 'ACTIVE'
                    }
                }
            })
        ]);

        if (!employer)
            return res.redirect('/login');

        const companyIds = employer.companies.map((membership: any) => membership.company.id);

        if (companyIds.length) {
            await prisma.jobPosting.updateMany({
                where: {
                    companyId: {
                        in: companyIds
                    },
                    status: 'ACTIVE',
                    closingDate: {
                        lte: now
                    }
                },
                data: {
                    status: 'CLOSED',
                    isActive: false
                }
            });
        }

        const companies = employer.companies.map((membership: any) => {
            const postings = membership.company.jobPostings.map((posting: any) => ({
                ...posting,
                status: posting.status === 'ACTIVE' && posting.closingDate && posting.closingDate <= now
                    ? 'CLOSED'
                    : posting.status
            }));

            return {
                id: membership.company.id,
                name: membership.company.name,
                industry: membership.company.industry || 'Industry not set',
                location: membership.company.location || 'Location not set',
                role: membership.company.ownedById === req.session.userId
                    ? 'Owner'
                    : membership.role === 'ADMIN'
                        ? 'Admin'
                        : 'User',
                memberCount: membership.company._count.employers,
                activePostingCount: postings.filter((posting: any) => posting.status === 'ACTIVE').length,
                draftPostingCount: postings.filter((posting: any) => posting.status === 'DRAFT').length
            };
        });
        const postings = employer.companies.flatMap((membership: any) =>
            membership.company.jobPostings.map((posting: any) => {
                const status = posting.status === 'ACTIVE' && posting.closingDate && posting.closingDate <= now
                    ? 'CLOSED'
                    : posting.status;

                return {
                    id: posting.id,
                    companyName: membership.company.name,
                    jobTitle: posting.jobTitle,
                    jobDescription: posting.jobDescription || '',
                    status,
                    workMode: posting.workMode,
                    jobLocation: posting.jobLocation,
                    closingDate: posting.closingDate,
                    closingDateLabel: formatDate(posting.closingDate),
                    daysUntilClose: daysUntil(posting.closingDate),
                    applicationCount: posting._count.applications,
                    updatedAt: posting.updatedAt
                };
            })
        );
        const activePostings = postings.filter((posting: any) => posting.status === 'ACTIVE');
        const draftPostings = postings.filter((posting: any) => posting.status === 'DRAFT');
        const closedPostings = postings.filter((posting: any) => posting.status === 'CLOSED');
        const closingSoon = activePostings
            .filter((posting: any) =>
                posting.closingDate && posting.closingDate > now && posting.closingDate <= twoWeeksFromNow)
            .sort((a: any, b: any) => a.closingDate.getTime() - b.closingDate.getTime())
            .slice(0, 3);
        const recentPostings = postings
            .filter((posting: any) => posting.status !== 'CLOSED')
            .sort((a: any, b: any) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, 4);
        const totalApplications = postings.reduce((total: number, posting: any) =>
            total + posting.applicationCount, 0);
        const pendingInvitations = employer.receivedCompanyInvitations.map((invitation: any) => ({
            id: invitation.id,
            companyName: invitation.company.name,
            senderName: `${invitation.invitedByEmployer.user.firstName} ${invitation.invitedByEmployer.user.lastName}`.trim()
        }));

        return res.render('pages/employer/home', {
            ...res.payload,
            userId: req.session.userId,
            employerHome: {
                candidateCount,
                companies,
                activePostings,
                draftPostings,
                closedPostings,
                recentPostings,
                closingSoon,
                pendingInvitations,
                stats: {
                    companyCount: companies.length,
                    activePostingCount: activePostings.length,
                    draftPostingCount: draftPostings.length,
                    closedPostingCount: closedPostings.length,
                    totalApplications,
                    pendingInvitationCount: pendingInvitations.length
                }
            }
        });
    } catch (err) {
        return next(err);
    }
}
