import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

export default async function employerCompaniesHelper(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId)
            return res.redirect('/login');

        if (req.session.accountType === 1)
            return res.redirect('/candidate/home');

        const employer = await prisma.employer.findUnique({
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
                                ownedById: true,
                                name: true,
                                description: true,
                                industry: true,
                                location: true,
                                email: true,
                                phone: true,
                                website: true,
                                size: true,
                                organisationType: true,
                                brandColour: true,
                                avatarHash: true,
                                employers: {
                                    select: {
                                        role: true,
                                        employer: {
                                            select: {
                                                id: true,
                                                user: {
                                                    select: {
                                                        id: true,
                                                        firstName: true,
                                                        lastName: true,
                                                        email: true
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    orderBy: {
                                        createdAt: 'asc'
                                    }
                                },
                                invitations: {
                                    where: {
                                        status: 'PENDING'
                                    },
                                    select: {
                                        id: true,
                                        role: true,
                                        recipientEmployer: {
                                            select: {
                                                id: true,
                                                user: {
                                                    select: {
                                                        id: true,
                                                        firstName: true,
                                                        lastName: true,
                                                        email: true
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    orderBy: {
                                        createdAt: 'asc'
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
                        role: true,
                        company: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                industry: true,
                                location: true,
                                email: true,
                                phone: true,
                                website: true,
                                avatarHash: true,
                                ownedBy: {
                                    select: {
                                        firstName: true,
                                        lastName: true
                                    }
                                }
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
                    }
                }
            }
        });

        if (!employer)
            return res.redirect('/employer/home');

        const companies = employer.companies.map((membership: any) => ({
            currentEmployerId: employer.id,
            role: membership.role,
            isOwner: membership.company.ownedById === req.session.userId,
            company: {
                ...membership.company,
                logoUrl: membership.company.avatarHash
                    ? `/images/companies/${membership.company.avatarHash}`
                    : ''
            }
        }));

        const invitations = employer.receivedCompanyInvitations.map((invitation: any) => ({
            id: invitation.id,
            role: invitation.role,
            company: {
                ...invitation.company,
                logoUrl: invitation.company.avatarHash
                    ? `/images/companies/${invitation.company.avatarHash}`
                    : ''
            },
            invitedByName: `${invitation.invitedByEmployer.user.firstName} ${invitation.invitedByEmployer.user.lastName}`.trim()
        }));
        const activeCompanyName = typeof req.params.companyName === 'string'
            ? req.params.companyName.trim()
            : '';
        const activeCompany = activeCompanyName
            ? companies.find((item: any) => item.company.name === activeCompanyName)
            : null;
        const activeCompanyMode = req.path.endsWith('/edit')
            ? 'edit'
            : 'view';

        if (activeCompanyName && !activeCompany)
            return res.redirect('/employer/companies');

        if (activeCompanyMode === 'edit' && activeCompany && activeCompany.role !== 'ADMIN')
            return res.redirect(`/employer/companies/${encodeURIComponent(activeCompany.company.name)}/view`);

        return res.render('pages/employer/companies', {
            ...res.payload,
            userId: req.session.userId,
            activeCompany,
            activeCompanyMode,
            employerCompaniesJson: JSON.stringify({
                companies,
                invitations,
                activeCompany,
                activeCompanyMode
            }).replace(/</g, '\\u003c')
        });
    } catch (err) {
        return next(err);
    }
}
