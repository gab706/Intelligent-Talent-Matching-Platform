/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
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

function statusLabel(value: string): string {
    const labels: Record<string, string> = {
        APPLIED: 'Applied',
        SHORTLISTED: 'Shortlisted',
        HIRED: 'Accepted',
        REJECTED: 'Rejected'
    };

    return labels[value] || value;
}

function formatJob(job: any) {
    return {
        id: job.id,
        jobTitle: job.jobTitle,
        companyName: job.company?.name || '',
        companyIndustry: job.company?.industry || '',
        companyInformation: job.companyInformation || '',
        jobDescription: job.jobDescription || '',
        jobLocation: job.jobLocation,
        workMode: job.workMode,
        jobType: job.jobType || '',
        requiredExperience: job.requiredExperience,
        requiredEducationLevel: job.requiredEducationLevel,
        requiredEducationLabel: QUALIFICATION_LABELS[job.requiredEducationLevel] || job.requiredEducationLevel,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryRange: job.salaryMin || job.salaryMax
            ? [job.salaryMin ? `$${job.salaryMin.toLocaleString('en-AU')}` : '', job.salaryMax ? `$${job.salaryMax.toLocaleString('en-AU')}` : ''].filter(Boolean).join(' - ')
            : '',
        closingDate: job.closingDate ? job.closingDate.toISOString().slice(0, 10) : '',
        closingDateLabel: job.closingDate ? job.closingDate.toISOString() : '',
        status: job.status,
        isActive: job.isActive,
        skills: job.skills.map((item: any) => item.skill.name)
    };
}

function formatApplication(application: any) {
    return {
        id: application.id,
        status: application.status,
        statusLabel: statusLabel(application.status),
        coverLetter: application.coverLetter || '',
        appliedAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
        canWithdraw: false,
        job: formatJob(application.job)
    };
}

function formatSavedJob(savedJob: any) {
    return {
        id: savedJob.id,
        savedAt: savedJob.createdAt.toISOString(),
        job: formatJob(savedJob.job)
    };
}

export default async function candidateApplicationsHelper(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId)
            return res.redirect('/login');

        if (req.session.accountType === 2)
            return res.redirect('/employer/home');

        const [candidate, savedJobs] = await Promise.all([
            prisma.candidate.findUnique({
                where: {
                    userId: req.session.userId
                },
                select: {
                    id: true,
                    applications: {
                        select: {
                            id: true,
                            status: true,
                            coverLetter: true,
                            createdAt: true,
                            updatedAt: true,
                            job: {
                                select: {
                                    id: true,
                                    jobTitle: true,
                                    companyInformation: true,
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
                                    isActive: true,
                                    company: {
                                        select: {
                                            name: true,
                                            industry: true
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
                                }
                            }
                        },
                        orderBy: {
                            updatedAt: 'desc'
                        }
                    }
                }
            }),
            prisma.savedJob.findMany({
                where: {
                    userId: req.session.userId
                },
                select: {
                    id: true,
                    createdAt: true,
                    job: {
                        select: {
                            id: true,
                            jobTitle: true,
                            companyInformation: true,
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
                            isActive: true,
                            company: {
                                select: {
                                    name: true,
                                    industry: true
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
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            })
        ]);

        if (!candidate)
            return res.redirect('/candidate/profile');

        const applications = candidate.applications.map(formatApplication);
        const appliedJobIds = new Set(applications.map((application: { job: { id: string } }) => application.job.id));
        const formattedSavedJobs = savedJobs
            .map(formatSavedJob)
            .filter((savedJob: { job: { id: string } }) => !appliedJobIds.has(savedJob.job.id));
        const statusCounts = applications.reduce((counts: Record<string, number>, application: { status: string }) => {
            counts[application.status] = (counts[application.status] || 0) + 1;
            return counts;
        }, {});

        return res.render('pages/candidate/applications', {
            ...res.payload,
            userId: req.session.userId,
            applications,
            savedJobs: formattedSavedJobs,
            statusCounts,
            candidateApplicationsJson: JSON.stringify({
                applications,
                savedJobs: formattedSavedJobs,
                statusCounts
            }).replace(/</g, '\\u003c')
        });
    } catch (err) {
        return next(err);
    }
}
