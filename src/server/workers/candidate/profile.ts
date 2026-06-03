import { Request, Response, NextFunction } from 'express';
import type { Prisma } from '../../../../prisma/generated/client.js';
import { prisma } from '../../database/prisma.js';

const EDUCATION_TYPES = new Set([
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

const WORKING_MODES = new Set(['REMOTE', 'ONSITE', 'HYBRID']);
const JOB_TYPES = new Set(['FULL_TIME', 'PART_TIME', 'CASUAL', 'CONTRACT', 'INTERNSHIP']);
const FLUENCY_LEVELS = new Set(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'NATIVE']);

function cleanString(value: unknown, maxLength = 500): string {
    return String(value || '').trim().slice(0, maxLength);
}

function cleanList(value: unknown): unknown[] {
    return Array.isArray(value)
        ? value
        : [];
}

function cleanUniqueStrings(value: unknown, maxItems = 50): string[] {
    const seen = new Set<string>();

    return cleanList(value)
        .map(item => cleanString(item, 120))
        .filter(item => {
            const key = item.toLowerCase();

            if (!item || seen.has(key))
                return false;

            seen.add(key);
            return true;
        })
        .slice(0, maxItems);
}

function parseOptionalDate(value: unknown): Date | null {
    const raw = cleanString(value, 20);

    if (!raw)
        return null;

    const date = /^\d{4}-\d{2}$/.test(raw)
        ? new Date(`${raw}-01T00:00:00.000Z`)
        : new Date(`${raw}T00:00:00.000Z`);

    return Number.isNaN(date.getTime())
        ? null
        : date;
}

function startOfCurrentMonth(): Date {
    const now = new Date();

    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function isValidUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol);
    } catch {
        return false;
    }
}

function normaliseEducation(value: unknown) {
    return cleanList(value)
        .slice(0, 20)
        .map(item => {
            const source = item as Record<string, unknown>;
            const school = cleanString(source.school, 180);
            const qualificationType = cleanString(source.qualificationType, 60);
            const isCurrent = source.isCurrent === true;

            return {
                school,
                qualificationType,
                major: cleanString(source.major, 180) || null,
                fromDate: parseOptionalDate(source.fromDate),
                toDate: isCurrent ? null : parseOptionalDate(source.toDate),
                isCurrent
            };
        })
        .filter(item => item.school || item.qualificationType || item.major);
}

function normaliseExperience(value: unknown) {
    return cleanList(value)
        .slice(0, 30)
        .map(item => {
            const source = item as Record<string, unknown>;
            const isCurrent = source.isCurrent === true;

            return {
                company: cleanString(source.company, 180),
                jobTitle: cleanString(source.jobTitle, 180),
                workType: cleanString(source.workType, 30),
                location: cleanString(source.location, 180) || null,
                duties: cleanString(source.duties, 3000) || null,
                fromDate: parseOptionalDate(source.fromDate),
                toDate: isCurrent ? null : parseOptionalDate(source.toDate),
                isCurrent
            };
        })
        .filter(item => item.company || item.jobTitle || item.workType || item.location || item.duties);
}

function normalisePortfolio(value: unknown) {
    return cleanList(value)
        .slice(0, 20)
        .map(item => {
            const source = item as Record<string, unknown>;

            return {
                label: cleanString(source.label, 100),
                url: cleanString(source.url, 500)
            };
        })
        .filter(item => item.label || item.url);
}

function normaliseLanguages(value: unknown) {
    return cleanList(value)
        .slice(0, 30)
        .map(item => {
            const source = item as Record<string, unknown>;

            return {
                name: cleanString(source.name, 100),
                fluency: cleanString(source.fluency, 30)
            };
        })
        .filter(item => item.name || item.fluency);
}

function validateEducation(items: ReturnType<typeof normaliseEducation>): string | null {
    const currentMonth = startOfCurrentMonth();

    for (const item of items) {
        if (!item.school || !item.qualificationType)
            return 'Each education record needs a school and qualification.';

        if (!EDUCATION_TYPES.has(item.qualificationType))
            return 'Please select a valid education qualification.';

        if (item.fromDate && item.fromDate > currentMonth)
            return 'Education from dates cannot be in the future.';

        if (item.toDate && item.toDate > currentMonth)
            return 'Education to dates cannot be in the future.';
    }

    return null;
}

function validateExperience(items: ReturnType<typeof normaliseExperience>): string | null {
    const currentMonth = startOfCurrentMonth();

    for (const item of items) {
        if (!item.company || !item.jobTitle || !item.workType)
            return 'Each experience record needs a company, job title, and work type.';

        if (!WORKING_MODES.has(item.workType))
            return 'Please select a valid work type.';

        if (item.fromDate && item.fromDate > currentMonth)
            return 'Experience from dates cannot be in the future.';

        if (item.toDate && item.toDate > currentMonth)
            return 'Experience to dates cannot be in the future.';
    }

    return null;
}

function validatePortfolio(items: ReturnType<typeof normalisePortfolio>): string | null {
    for (const item of items) {
        if (!item.label || !item.url)
            return 'Each portfolio link needs a label and URL.';

        if (!isValidUrl(item.url))
            return 'Portfolio links must start with http:// or https://.';
    }

    return null;
}

function validateLanguages(items: ReturnType<typeof normaliseLanguages>): string | null {
    for (const item of items) {
        if (!item.name || !item.fluency)
            return 'Each language needs a name and fluency level.';

        if (!FLUENCY_LEVELS.has(item.fluency))
            return 'Please select a valid language fluency level.';
    }

    return null;
}

async function replaceSkills(
    tx: Prisma.TransactionClient,
    candidateId: string,
    skills: string[]
) {
    await tx.candidateSkill.deleteMany({
        where: {
            candidateId
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
            },
            select: {
                id: true
            }
        });

        await tx.candidateSkill.create({
            data: {
                candidateId,
                skillId: skill.id
            }
        });
    }
}

export default async function candidateProfileWorker(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId) {
            return res.status(401).json({
                success: false,
                message: 'Please login to update your candidate profile.'
            });
        }

        if (req.session.accountType === 2) {
            return res.status(403).json({
                success: false,
                message: 'Employer accounts cannot update candidate profiles.'
            });
        }

        const candidate = await prisma.candidate.findUnique({
            where: {
                userId: req.session.userId
            },
            select: {
                id: true
            }
        });

        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'Candidate profile could not be found.'
            });
        }

        const preferences = (req.body?.preferences || {}) as Record<string, unknown>;
        const preferredWorkingMode = cleanString(preferences.preferredWorkingMode, 30);
        const preferredJobType = cleanString(preferences.preferredJobType, 30);
        const education = normaliseEducation(req.body?.education);
        const experience = normaliseExperience(req.body?.experience);
        const portfolioLinks = normalisePortfolio(req.body?.portfolioLinks);
        const languages = normaliseLanguages(req.body?.languages);
        const certifications = cleanUniqueStrings(req.body?.certifications, 50);
        const skills = cleanUniqueStrings(req.body?.skills, 80);

        const validationMessage =
            validateEducation(education) ||
            validateExperience(experience) ||
            validatePortfolio(portfolioLinks) ||
            validateLanguages(languages);

        if (validationMessage) {
            return res.json({
                success: false,
                message: validationMessage
            });
        }

        if (preferredWorkingMode && !WORKING_MODES.has(preferredWorkingMode)) {
            return res.json({
                success: false,
                message: 'Please select a valid preferred working mode.'
            });
        }

        if (preferredJobType && !JOB_TYPES.has(preferredJobType)) {
            return res.json({
                success: false,
                message: 'Please select a valid preferred job type.'
            });
        }

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.candidate.update({
                where: {
                    id: candidate.id
                },
                data: {
                    profileSummary: cleanString(preferences.profileSummary, 3000) || null,
                    preferredWorkingMode: (preferredWorkingMode || null) as never,
                    preferredLocation: cleanString(preferences.preferredLocation, 180) || null,
                    preferredJobType: (preferredJobType || null) as never,
                    availability: cleanString(preferences.availability, 180) || null
                }
            });

            await Promise.all([
                tx.candidateEducation.deleteMany({
                    where: {
                        candidateId: candidate.id
                    }
                }),
                tx.candidateExperience.deleteMany({
                    where: {
                        candidateId: candidate.id
                    }
                }),
                tx.candidatePortfolioLink.deleteMany({
                    where: {
                        candidateId: candidate.id
                    }
                }),
                tx.candidateCertification.deleteMany({
                    where: {
                        candidateId: candidate.id
                    }
                }),
                tx.candidateLanguage.deleteMany({
                    where: {
                        candidateId: candidate.id
                    }
                })
            ]);

            if (education.length) {
                await tx.candidateEducation.createMany({
                    data: education.map(item => ({
                        candidateId: candidate.id,
                        school: item.school,
                        qualificationType: item.qualificationType as never,
                        major: item.major,
                        fromDate: item.fromDate,
                        toDate: item.toDate,
                        isCurrent: item.isCurrent
                    }))
                });
            }

            if (experience.length) {
                await tx.candidateExperience.createMany({
                    data: experience.map(item => ({
                        candidateId: candidate.id,
                        company: item.company,
                        jobTitle: item.jobTitle,
                        workType: item.workType as never,
                        location: item.location,
                        duties: item.duties,
                        fromDate: item.fromDate,
                        toDate: item.toDate,
                        isCurrent: item.isCurrent
                    }))
                });
            }

            if (portfolioLinks.length) {
                await tx.candidatePortfolioLink.createMany({
                    data: portfolioLinks.map(item => ({
                        candidateId: candidate.id,
                        label: item.label,
                        url: item.url
                    }))
                });
            }

            if (certifications.length) {
                await tx.candidateCertification.createMany({
                    data: certifications.map(name => ({
                        candidateId: candidate.id,
                        name
                    }))
                });
            }

            if (languages.length) {
                await tx.candidateLanguage.createMany({
                    data: languages.map(item => ({
                        candidateId: candidate.id,
                        name: item.name,
                        fluency: item.fluency as never
                    }))
                });
            }

            await replaceSkills(tx, candidate.id, skills);
        });

        return res.json({
            success: true,
            message: 'Candidate Profile updated successfully.'
        });
    } catch (err) {
        return next(err);
    }
}
