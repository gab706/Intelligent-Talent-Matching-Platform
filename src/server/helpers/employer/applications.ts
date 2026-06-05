import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

const QUALIFICATION_LABELS: Record<string, string> = {
    CERTIFICATE_I: 'Certificate I',
    CERTIFICATE_II: 'Certificate II',
    CERTIFICATE_III: 'Certificate III',
    CERTIFICATE_IV: 'Certificate IV',
    DIPLOMA: 'Diploma',
    ADVANCED_DIPLOMA: 'Advanced Diploma',
    ASSOCIATE_DEGREE: 'Associate Degree',
    BACHELORS_DEGREE: "Bachelor's Degree",
    GRADUATE_CERTIFICATE: 'Graduate Certificate',
    GRADUATE_DIPLOMA: 'Graduate Diploma',
    MASTERS_DEGREE: "Master's Degree",
    DOCTORAL_DEGREE: 'Doctoral Degree'
};
const QUALIFICATION_ORDER = Object.keys(QUALIFICATION_LABELS);

function toMonth(value: Date | null): string {
    return value ? value.toISOString().slice(0, 7) : '';
}

function parseMonth(value: string): Date | null {
    if (!value)
        return null;

    const date = new Date(`${value}-01T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function calculateYearsOfExperience(experience: Array<{ fromDate: string; toDate: string; isCurrent: boolean }>): number {
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

function formatHighestEducation(education: Array<{ qualificationType: string; major: string; fromDate: string }>): string {
    const highest = [...education].sort((a, b) => {
        const rankA = QUALIFICATION_ORDER.indexOf(a.qualificationType);
        const rankB = QUALIFICATION_ORDER.indexOf(b.qualificationType);

        if (rankA !== rankB)
            return rankB - rankA;

        return String(b.fromDate || '').localeCompare(String(a.fromDate || ''));
    })[0];

    if (!highest)
        return '';

    return [
        QUALIFICATION_LABELS[highest.qualificationType] || highest.qualificationType,
        highest.major ? `in ${highest.major}` : ''
    ].filter(Boolean).join(' ');
}

function formatCandidate(candidate: any) {
    const education = candidate.educationRecords.map((record: any) => ({
        school: record.school,
        qualificationType: record.qualificationType,
        qualificationLabel: QUALIFICATION_LABELS[record.qualificationType] || record.qualificationType,
        major: record.major || '',
        fromDate: toMonth(record.fromDate),
        toDate: toMonth(record.toDate),
        isCurrent: record.isCurrent
    }));
    const experience = candidate.experienceRecords.map((record: any) => ({
        company: record.company,
        jobTitle: record.jobTitle,
        workType: record.workType,
        location: record.location || '',
        duties: record.duties || '',
        fromDate: toMonth(record.fromDate),
        toDate: toMonth(record.toDate),
        isCurrent: record.isCurrent
    }));

    return {
        id: candidate.id,
        fullName: `${candidate.user.firstName} ${candidate.user.lastName}`.trim(),
        email: candidate.user.email,
        phone: candidate.user.phone,
        avatarPath: candidate.user.avatarHash
            ? `/images/avatars/${candidate.user.avatarHash}`
            : '/images/avatar/default.png',
        summary: candidate.profileSummary || '',
        highestEducation: formatHighestEducation(education),
        yearsOfExperience: calculateYearsOfExperience(experience),
        availability: candidate.availability || '',
        preferredLocation: candidate.preferredLocation || '',
        preferredWorkingMode: candidate.preferredWorkingMode || '',
        preferredJobType: candidate.preferredJobType || '',
        skills: candidate.skills.map((item: any) => item.skill.name),
        education,
        experience,
        certifications: candidate.certifications.map((item: any) => item.name),
        languages: candidate.languages.map((item: any) => ({
            name: item.name,
            fluency: item.fluency
        })),
        portfolioLinks: [
            candidate.portfolioUrl ? { label: 'Portfolio', url: candidate.portfolioUrl } : null,
            candidate.linkedinUrl ? { label: 'LinkedIn', url: candidate.linkedinUrl } : null,
            ...candidate.portfolioLinks.map((item: any) => ({
                label: item.label,
                url: item.url
            }))
        ].filter(Boolean)
    };
}

export default async function employerApplicationsHelper(
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
                        company: {
                            select: {
                                id: true,
                                name: true,
                                jobPostings: {
                                    where: {
                                        status: {
                                            not: 'DRAFT'
                                        }
                                    },
                                    select: {
                                        id: true,
                                        jobTitle: true,
                                        status: true,
                                        applications: {
                                            select: {
                                                id: true,
                                                status: true,
                                                coverLetter: true,
                                                createdAt: true,
                                                candidate: {
                                                    select: {
                                                        id: true,
                                                        profileSummary: true,
                                                        preferredWorkingMode: true,
                                                        preferredLocation: true,
                                                        preferredJobType: true,
                                                        availability: true,
                                                        portfolioUrl: true,
                                                        linkedinUrl: true,
                                                        user: {
                                                            select: {
                                                                firstName: true,
                                                                lastName: true,
                                                                email: true,
                                                                phone: true,
                                                                avatarHash: true
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
                                                        },
                                                        educationRecords: {
                                                            orderBy: {
                                                                createdAt: 'asc'
                                                            }
                                                        },
                                                        experienceRecords: {
                                                            orderBy: {
                                                                createdAt: 'asc'
                                                            }
                                                        },
                                                        portfolioLinks: {
                                                            orderBy: {
                                                                createdAt: 'asc'
                                                            }
                                                        },
                                                        certifications: {
                                                            orderBy: {
                                                                createdAt: 'asc'
                                                            }
                                                        },
                                                        languages: {
                                                            orderBy: {
                                                                createdAt: 'asc'
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            orderBy: {
                                                updatedAt: 'desc'
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
            return res.redirect('/login');

        const postings = employer.companies.flatMap((membership: any) =>
            membership.company.jobPostings.map((posting: any) => ({
                id: posting.id,
                title: posting.jobTitle,
                companyId: membership.company.id,
                companyName: membership.company.name,
                status: posting.status,
                applications: posting.applications.map((application: any) => ({
                    id: application.id,
                    status: application.status,
                    coverLetter: application.coverLetter || '',
                    appliedAt: application.createdAt.toISOString(),
                    candidate: formatCandidate(application.candidate)
                }))
            }))
        );

        return res.render('pages/employer/applications', {
            ...res.payload,
            userId: req.session.userId,
            postings,
            employerApplicationsJson: JSON.stringify({
                postings
            }).replace(/</g, '\\u003c')
        });
    } catch (err) {
        return next(err);
    }
}
