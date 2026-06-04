import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

const EDUCATION_OPTIONS = [
    'CERTIFICATE_I',
    'CERTIFICATE_II',
    'CERTIFICATE_III',
    'CERTIFICATE_IV',
    'DIPLOMA',
    'ADVANCED_DIPLOMA',
    'ASSOCIATE_DEGREE',
    'BACHELORS_DEGREE',
    'GRADUATE_CERTIFICATE',
    'GRADUATE_DIPLOMA',
    'MASTERS_DEGREE',
    'DOCTORAL_DEGREE'
];

export default async function employerPostingsHelper(
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
                                name: true,
                                ownedById: true,
                                description: true,
                                jobPostings: {
                                    select: {
                                        id: true,
                                        employerId: true,
                                        companyId: true,
                                        jobTitle: true,
                                        jobDescription: true,
                                        requiredEducationLevel: true,
                                        requiredExperience: true,
                                        workMode: true,
                                        jobLocation: true,
                                        salaryMin: true,
                                        salaryMax: true,
                                        jobType: true,
                                        closingDate: true,
                                        status: true,
                                        createdAt: true,
                                        updatedAt: true,
                                        employer: {
                                            select: {
                                                userId: true,
                                                user: {
                                                    select: {
                                                        firstName: true,
                                                        lastName: true
                                                    }
                                                }
                                            }
                                        },
                                        skills: {
                                            select: {
                                                skill: {
                                                    select: {
                                                        name: true
                                                    }
                                                }
                                            },
                                            orderBy: {
                                                skill: {
                                                    name: 'asc'
                                                }
                                            }
                                        }
                                    },
                                    orderBy: {
                                        updatedAt: 'desc'
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

        const now = new Date();
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

        const companies = employer.companies.map((membership: any) => ({
            id: membership.company.id,
            name: membership.company.name,
            role: membership.role,
            isOwner: membership.company.ownedById === req.session.userId,
            description: membership.company.description || ''
        }));

        const postings = employer.companies.flatMap((membership: any) => {
            const company = membership.company;
            const canManageCompany = membership.role === 'ADMIN';

            return company.jobPostings.map((posting: any) => {
                const isOwner = posting.employer.userId === req.session.userId;
                const canManage = canManageCompany || isOwner;
                const status =
                    posting.status === 'ACTIVE' && posting.closingDate && posting.closingDate <= now
                        ? 'CLOSED'
                        : posting.status;

                return {
                    id: posting.id,
                    companyId: company.id,
                    companyName: company.name,
                    role: membership.role,
                    canManage,
                    isOwner,
                    createdByName: `${posting.employer.user.firstName} ${posting.employer.user.lastName}`.trim(),
                    jobTitle: posting.jobTitle,
                    jobDescription: posting.jobDescription,
                    requiredEducationLevel: posting.requiredEducationLevel,
                    requiredExperience: posting.requiredExperience,
                    workMode: posting.workMode,
                    jobLocation: posting.jobLocation,
                    salaryMin: posting.salaryMin,
                    salaryMax: posting.salaryMax,
                    jobType: posting.jobType,
                    closingDate: posting.closingDate ? posting.closingDate.toISOString().slice(0, 10) : '',
                    status,
                    skills: posting.skills.map((item: any) => item.skill.name),
                    updatedAt: posting.updatedAt.toISOString()
                };
            });
        });

        return res.render('pages/employer/postings', {
            ...res.payload,
            userId: req.session.userId,
            hasCompanies: companies.length > 0,
            employerPostingsJson: JSON.stringify({
                companies,
                postings,
                educationOptions: EDUCATION_OPTIONS
            }).replace(/</g, '\\u003c')
        });
    } catch (err) {
        return next(err);
    }
}
