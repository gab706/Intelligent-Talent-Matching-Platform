import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

function toInputMonth(value: Date | null): string {
    if (!value)
        return '';

    return value.toISOString().slice(0, 7);
}

export default async function candidateProfileHelper(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId)
            return res.redirect('/login');

        if (req.session.accountType === 2)
            return res.redirect('/employer/home');

        const candidate = await prisma.candidate.findUnique({
            where: {
                userId: req.session.userId
            },
            select: {
                id: true,
                profileSummary: true,
                preferredWorkingMode: true,
                preferredLocation: true,
                preferredJobType: true,
                availability: true,
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true
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
        });

        if (!candidate)
            return res.redirect('/candidate/home');

        const candidateProfile = {
            personal: candidate.user,
            preferences: {
                preferredWorkingMode: candidate.preferredWorkingMode || '',
                preferredLocation: candidate.preferredLocation || '',
                preferredJobType: candidate.preferredJobType || '',
                availability: candidate.availability || '',
                profileSummary: candidate.profileSummary || ''
            },
            skills: candidate.skills.map((candidateSkill: { skill: { name: string } }) => candidateSkill.skill.name),
            education: candidate.educationRecords.map((record: {
                school: string;
                qualificationType: string;
                major: string | null;
                fromDate: Date | null;
                toDate: Date | null;
                isCurrent: boolean;
            }) => ({
                school: record.school,
                qualificationType: record.qualificationType,
                major: record.major || '',
                fromDate: toInputMonth(record.fromDate),
                toDate: toInputMonth(record.toDate),
                isCurrent: record.isCurrent
            })),
            experience: candidate.experienceRecords.map((record: {
                company: string;
                jobTitle: string;
                workType: string;
                location: string | null;
                duties: string | null;
                fromDate: Date | null;
                toDate: Date | null;
                isCurrent: boolean;
            }) => ({
                company: record.company,
                jobTitle: record.jobTitle,
                workType: record.workType,
                location: record.location || '',
                duties: record.duties || '',
                fromDate: toInputMonth(record.fromDate),
                toDate: toInputMonth(record.toDate),
                isCurrent: record.isCurrent
            })),
            portfolioLinks: candidate.portfolioLinks.map((record: {
                label: string;
                url: string;
            }) => ({
                label: record.label,
                url: record.url
            })),
            certifications: candidate.certifications.map((record: { name: string }) => record.name),
            languages: candidate.languages.map((record: {
                name: string;
                fluency: string;
            }) => ({
                name: record.name,
                fluency: record.fluency
            }))
        };

        return res.render('pages/candidate/profile', {
            ...res.payload,
            userId: req.session.userId,
            candidateProfile,
            candidateProfileJson: JSON.stringify(candidateProfile).replace(/</g, '\\u003c')
        });
    } catch (err) {
        return next(err);
    }
}
