import { Request, Response, NextFunction } from 'express';
import type { Prisma } from '../../../../prisma/generated/client.js';
import { prisma } from '../../database/prisma.js';

const EDUCATION_OPTIONS = new Set([
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
]);
const WORK_MODES = new Set(['REMOTE', 'HYBRID', 'ONSITE']);
const JOB_TYPES = new Set(['FULL_TIME', 'PART_TIME', 'CASUAL', 'CONTRACT', 'INTERNSHIP']);
const STATUSES = new Set(['DRAFT', 'ACTIVE', 'CLOSED']);

function clean(value: unknown, max = 1000): string {
    return String(value || '').trim().slice(0, max);
}

function parseNumber(value: unknown): number | null {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0
        ? Math.round(number)
        : null;
}

function parseDate(value: unknown): Date | null {
    const raw = clean(value, 20);

    if (!raw)
        return null;

    const date = new Date(`${raw}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function normaliseStatus(status: string, closingDate: Date | null): 'DRAFT' | 'ACTIVE' | 'CLOSED' {
    if (status === 'CLOSED')
        return 'CLOSED';

    if (status === 'DRAFT')
        return 'DRAFT';

    if (closingDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (closingDate <= today)
            return 'CLOSED';
    }

    return 'ACTIVE';
}

function getSkills(value: unknown): string[] {
    const rawSkills = Array.isArray(value)
        ? value
        : String(value || '').split(',');

    return Array.from(new Set(rawSkills
        .map(skill => clean(skill, 80))
        .filter(Boolean)
        .map(skill => skill.replace(/\s+/g, ' '))));
}

async function getEmployer(userId: string) {
    return prisma.employer.findUnique({
        where: {
            userId
        },
        select: {
            id: true,
            companies: {
                select: {
                    role: true,
                    companyId: true,
                    company: {
                        select: {
                            id: true,
                            name: true,
                            description: true
                        }
                    }
                }
            }
        }
    });
}

async function findPosting(postingId: string, employerId: string) {
    return prisma.jobPosting.findUnique({
        where: {
            id: postingId
        },
        select: {
            id: true,
            employerId: true,
            companyId: true,
            status: true,
            company: {
                select: {
                    employers: {
                        where: {
                            employerId
                        },
                        select: {
                            role: true
                        }
                    }
                }
            }
        }
    });
}

function canManagePosting(posting: Awaited<ReturnType<typeof findPosting>>, employerId: string): boolean {
    if (!posting)
        return false;

    return posting.employerId === employerId || posting.company.employers[0]?.role === 'ADMIN';
}

export default async function postingWorker(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId || req.session.accountType === 1) {
            return res.json({
                success: false,
                message: 'Please login as an employer.'
            });
        }

        const action = clean(req.body?.action, 40);
        const employer = await getEmployer(req.session.userId);

        if (!employer) {
            return res.json({
                success: false,
                message: 'Employer account could not be found.'
            });
        }

        if (action === 'delete' || action === 'status') {
            const postingId = clean(req.body?.postingId, 80);
            const posting = await findPosting(postingId, employer.id);

            if (!posting || !canManagePosting(posting, employer.id)) {
                return res.json({
                    success: false,
                    message: 'You do not have permission to manage this posting.'
                });
            }

            if (action === 'delete') {
                await prisma.jobPosting.delete({
                    where: {
                        id: posting.id
                    }
                });

                return res.json({
                    success: true,
                    message: 'Posting removed.'
                });
            }

            const nextStatus = clean(req.body?.status, 20);

            if (!STATUSES.has(nextStatus)) {
                return res.json({
                    success: false,
                    message: 'Invalid posting status.'
                });
            }

            await prisma.jobPosting.update({
                where: {
                    id: posting.id
                },
                data: {
                    status: nextStatus as never,
                    isActive: nextStatus === 'ACTIVE'
                }
            });

            return res.json({
                success: true,
                message: 'Posting status updated.'
            });
        }

        if (action !== 'create' && action !== 'update') {
            return res.json({
                success: false,
                message: 'Invalid posting action.'
            });
        }

        const companyId = clean(req.body?.companyId, 80);
        const membership = employer.companies.find((item: any) => item.companyId === companyId);

        if (!membership) {
            return res.json({
                success: false,
                message: 'You must be attached to the selected company.'
            });
        }

        const jobTitle = clean(req.body?.jobTitle, 180);
        const jobDescription = clean(req.body?.jobDescription, 4000);
        const requiredEducationLevel = clean(req.body?.requiredEducationLevel, 80);
        const requiredExperience = parseNumber(req.body?.requiredExperience);
        const workMode = clean(req.body?.workMode, 20);
        const jobLocation = clean(req.body?.jobLocation, 180);
        const jobType = clean(req.body?.jobType, 30);
        const salaryMin = parseNumber(req.body?.salaryMin);
        const salaryMax = parseNumber(req.body?.salaryMax);
        const closingDate = parseDate(req.body?.closingDate);
        const status = normaliseStatus(clean(req.body?.status, 20), closingDate);
        const skills = getSkills(req.body?.skills);

        if (
            !jobTitle ||
            !jobDescription ||
            !companyId ||
            !requiredEducationLevel ||
            requiredExperience === null ||
            !workMode ||
            !jobLocation ||
            !jobType ||
            salaryMin === null ||
            salaryMax === null ||
            !STATUSES.has(clean(req.body?.status, 20)) ||
            !skills.length
        ) {
            return res.json({
                success: false,
                message: 'Please complete all required posting fields.'
            });
        }

        if (!EDUCATION_OPTIONS.has(requiredEducationLevel) || !WORK_MODES.has(workMode) || !JOB_TYPES.has(jobType)) {
            return res.json({
                success: false,
                message: 'Please select valid posting options.'
            });
        }

        if (salaryMin > salaryMax) {
            return res.json({
                success: false,
                message: 'Minimum salary cannot be greater than maximum salary.'
            });
        }

        if (action === 'update') {
            const posting = await findPosting(clean(req.body?.postingId, 80), employer.id);

            if (!posting || !canManagePosting(posting, employer.id)) {
                return res.json({
                    success: false,
                    message: 'You do not have permission to edit this posting.'
                });
            }
        }

        const posting = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const data = {
                employerId: employer.id,
                companyId,
                jobTitle,
                companyInformation: membership.company.description || membership.company.name,
                jobDescription,
                requiredEducationLevel,
                requiredExperience,
                workMode: workMode as never,
                jobLocation,
                salaryMin,
                salaryMax,
                jobType: jobType as never,
                closingDate,
                status: status as never,
                isActive: status === 'ACTIVE'
            };
            const savedPosting = action === 'create'
                ? await tx.jobPosting.create({
                    data
                })
                : await tx.jobPosting.update({
                    where: {
                        id: clean(req.body?.postingId, 80)
                    },
                    data
                });

            await tx.jobPostingSkill.deleteMany({
                where: {
                    jobPostingId: savedPosting.id
                }
            });

            for (const skillName of skills) {
                const skill = await tx.skill.upsert({
                    where: {
                        name: skillName
                    },
                    update: {},
                    create: {
                        name: skillName
                    }
                });

                await tx.jobPostingSkill.create({
                    data: {
                        jobPostingId: savedPosting.id,
                        skillId: skill.id
                    }
                });
            }

            return savedPosting;
        });

        return res.json({
            success: true,
            message: action === 'create' ? 'Posting created.' : 'Posting updated.',
            postingId: posting.id
        });
    } catch (err) {
        return next(err);
    }
}
