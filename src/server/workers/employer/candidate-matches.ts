/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

const QUALIFICATION_ORDER = [
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

function clean(value: unknown, max = 500): string {
    return String(value || '').trim().slice(0, max);
}

function tokens(value: string): string[] {
    return Array.from(new Set(clean(value, 6000)
        .toLowerCase()
        .replace(/[^a-z0-9\s+#.-]/g, ' ')
        .split(/\s+/)
        .filter(token => token.length >= 3)));
}

function overlap(a: string[], b: string[]): string[] {
    const set = new Set(b);
    return a.filter(item => set.has(item));
}

function parseMonth(value: Date | null): Date | null {
    return value && !Number.isNaN(value.getTime()) ? value : null;
}

function calculateYears(experience: Array<{ fromDate: Date | null; toDate: Date | null; isCurrent: boolean }>): number {
    const ranges = experience.map(item => {
        const from = parseMonth(item.fromDate);
        const to = item.isCurrent ? new Date() : parseMonth(item.toDate);

        if (!from || !to || to <= from)
            return null;

        return [from.getTime(), to.getTime()];
    }).filter(Boolean).sort((a: any, b: any) => a[0] - b[0]) as number[][];
    const merged: number[][] = [];

    ranges.forEach(range => {
        const last = merged[merged.length - 1];

        if (!last || range[0] > last[1]) {
            merged.push([...range]);
            return;
        }

        last[1] = Math.max(last[1], range[1]);
    });

    const totalMs = merged.reduce((total, range) => total + (range[1] - range[0]), 0);
    return Math.round((totalMs / (1000 * 60 * 60 * 24 * 365.25)) * 10) / 10;
}

function rankEducation(value: string): number {
    return QUALIFICATION_ORDER.indexOf(value);
}

function scoreCandidate(posting: any, candidate: any) {
    const jobSkills = posting.skills.map((item: any) => item.skill.name.toLowerCase());
    const candidateSkills = candidate.skills.map((item: any) => item.skill.name.toLowerCase());
    const matchedSkills = overlap(jobSkills, candidateSkills);
    const years = calculateYears(candidate.experienceRecords);
    const highestEducation = [...candidate.educationRecords].sort((a: any, b: any) =>
        rankEducation(b.qualificationType) - rankEducation(a.qualificationType)
    )[0];
    const educationMet = highestEducation && rankEducation(highestEducation.qualificationType) >= rankEducation(posting.requiredEducationLevel);
    const textMatches = overlap(tokens(posting.jobDescription), tokens([
        candidate.profileSummary,
        candidate.workExperience,
        ...candidate.experienceRecords.map((item: any) => `${item.jobTitle} ${item.company} ${item.duties || ''}`),
        ...candidate.educationRecords.map((item: any) => `${item.major || ''} ${item.school}`)
    ].join(' ')));
    let score = 0;
    const reasons: string[] = [];

    if (jobSkills.length) {
        score += Math.min(40, (matchedSkills.length / jobSkills.length) * 40);
        if (matchedSkills.length)
            reasons.push(`matched on ${matchedSkills.slice(0, 4).join(', ')}`);
    }

    if (posting.requiredExperience <= 0) {
        score += 20;
    } else {
        score += Math.min(1, years / posting.requiredExperience) * 20;
        if (years >= posting.requiredExperience)
            reasons.push(`${years}+ years experience`);
    }

    if (educationMet) {
        score += 15;
        reasons.push(highestEducation?.major
            ? `${highestEducation.major} education`
            : 'education requirement');
    }

    if (candidate.preferredWorkingMode === posting.workMode) {
        score += 5;
        reasons.push(`${posting.workMode.toLowerCase()} preference`);
    }

    if (
        candidate.preferredLocation &&
        posting.jobLocation.toLowerCase().includes(candidate.preferredLocation.toLowerCase())
    ) {
        score += 5;
        reasons.push(candidate.preferredLocation);
    }

    if (candidate.preferredJobType === posting.jobType) {
        score += 5;
        reasons.push(`${posting.jobType.toLowerCase().replace('_', ' ')} preference`);
    }

    if (textMatches.length) {
        score += Math.min(10, textMatches.length * 2);
        reasons.push(`keyword overlap: ${textMatches.slice(0, 3).join(', ')}`);
    }

    return {
        candidateId: candidate.id,
        fullName: `${candidate.user.firstName} ${candidate.user.lastName}`.trim(),
        percentage: Math.round(Math.min(100, score)),
        explanation: reasons.length
            ? `Matched on ${reasons.join(', ')}.`
            : 'Limited profile overlap found.'
    };
}

export default async function candidateMatchesWorker(
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

        const postingId = clean(req.body?.postingId, 80);
        const employer = await prisma.employer.findUnique({
            where: {
                userId: req.session.userId
            },
            select: {
                id: true,
                user: {
                    select: {
                        isMember: true
                    }
                },
                companies: {
                    select: {
                        companyId: true
                    }
                }
            }
        });

        if (!employer)
            return res.json({ success: false, message: 'Employer account could not be found.' });

        const allowedCompanyIds = employer.companies.map((item: any) => item.companyId);
        const posting = await prisma.jobPosting.findFirst({
            where: {
                id: postingId,
                companyId: {
                    in: allowedCompanyIds
                },
                status: 'ACTIVE'
            },
            select: {
                id: true,
                jobDescription: true,
                requiredEducationLevel: true,
                requiredExperience: true,
                workMode: true,
                jobLocation: true,
                jobType: true,
                skills: {
                    select: {
                        skill: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            }
        });

        if (!posting)
            return res.json({ success: false, message: 'Please select an active posting.' });

        const candidates = await prisma.candidate.findMany({
            where: {
                user: {
                    accountStatus: 'ACTIVE'
                }
            },
            select: {
                id: true,
                profileSummary: true,
                workExperience: true,
                preferredWorkingMode: true,
                preferredLocation: true,
                preferredJobType: true,
                user: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                },
                skills: {
                    select: {
                        skill: {
                            select: {
                                name: true
                            }
                        }
                    }
                },
                educationRecords: true,
                experienceRecords: true
            }
        });
        const matches = candidates
            .map((candidate: any) => scoreCandidate(posting, candidate))
            .sort((a: any, b: any) => b.percentage - a.percentage);

        return res.json({
            success: true,
            matches: employer.user.isMember ? matches : matches.slice(0, 10),
            isMember: employer.user.isMember
        });
    } catch (err) {
        return next(err);
    }
}
