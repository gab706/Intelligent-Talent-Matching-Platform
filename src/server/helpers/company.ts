import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma.js';

function isOpenPosting(posting: {
    status: string;
    closingDate: Date | null;
}): boolean {
    if (posting.status !== 'ACTIVE')
        return false;

    if (!posting.closingDate)
        return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return posting.closingDate > today;
}

function cleanBrandColour(value: string | null): string {
    const colour = String(value || '').trim();

    return /^#[0-9a-fA-F]{6}$/.test(colour)
        ? colour
        : '';
}

function organisationLabel(value: string | null): string {
    return String(value || '')
        .split('_')
        .filter(Boolean)
        .map(word => `${word.charAt(0)}${word.slice(1).toLowerCase()}`)
        .join(' ');
}

type PublicPosting = {
    id: string;
    jobTitle: string;
    workMode: string;
    jobLocation: string;
    closingDate: Date | null;
    status: string;
};

type PublicStaffMember = {
    employer: {
        user: {
            firstName: string;
            lastName: string;
            avatarHash: string | null;
        };
    };
};

export default async function companyHelper(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const companyName = String(req.params.companyName || '').trim();

        if (!companyName)
            return res.redirect('/companies');

        const company = await prisma.company.findUnique({
            where: {
                name: companyName
            },
            select: {
                name: true,
                email: true,
                phone: true,
                website: true,
                location: true,
                industry: true,
                description: true,
                avatarHash: true,
                brandColour: true,
                size: true,
                organisationType: true,
                values: true,
                employers: {
                    select: {
                        employer: {
                            select: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        avatarHash: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'asc'
                    }
                },
                jobPostings: {
                    select: {
                        id: true,
                        jobTitle: true,
                        workMode: true,
                        jobLocation: true,
                        closingDate: true,
                        status: true
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            }
        });

        if (!company)
            return res.status(404).render('pages/company', {
                ...res.payload,
                company: null,
                opportunities: []
            });

        const opportunities = company.jobPostings
            .filter(isOpenPosting)
            .map((posting: PublicPosting) => ({
                id: posting.id,
                jobTitle: posting.jobTitle,
                workMode: posting.workMode,
                jobLocation: posting.jobLocation,
                closingDate: posting.closingDate ? posting.closingDate.toISOString().slice(0, 10) : ''
            }));

        return res.render('pages/company', {
            ...res.payload,
            company: {
                ...company,
                brandColour: cleanBrandColour(company.brandColour),
                organisationLabel: organisationLabel(company.organisationType),
                logoUrl: company.avatarHash
                    ? `/images/companies/${company.avatarHash}`
                    : ''
            },
            opportunities,
            staff: company.employers.map((member: PublicStaffMember) => ({
                fullName: `${member.employer.user.firstName} ${member.employer.user.lastName}`.trim(),
                avatarPath: member.employer.user.avatarHash
                    ? `/images/avatars/${member.employer.user.avatarHash}`
                    : '/images/avatar/default.png'
            }))
        });
    } catch (err) {
        return next(err);
    }
}
