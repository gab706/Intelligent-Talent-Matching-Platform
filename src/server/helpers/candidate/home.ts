import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';
import { getRecommendedJobsForCandidate } from './job-search.js';

function dateLabel(value: Date | null): string {
    if (!value)
        return '';

    return new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    }).format(value);
}

function statusLabel(value: string): string {
    const labels: Record<string, string> = {
        APPLIED: 'Applied',
        SHORTLISTED: 'Shortlisted',
        HIRED: 'Accepted',
        REJECTED: 'Rejected'
    };

    return labels[value] || value;
}

export default async function candidateHomeHelper(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId)
            return res.redirect('/login');

        if (req.session.accountType === 2)
            return res.redirect('/employer/home');

        const user = await prisma.user.findUnique({
            where: {
                id: req.session.userId
            },
            select: {
                id: true,
                isMember: true,
                savedJobs: {
                    select: {
                        jobId: true
                    }
                },
                candidate: {
                    select: {
                        id: true,
                        profileSummary: true,
                        preferredWorkingMode: true,
                        preferredLocation: true,
                        preferredJobType: true,
                        skills: {
                            select: {
                                skill: {
                                    select: {
                                        name: true
                                    }
                                }
                            }
                        },
                        educationRecords: {
                            select: {
                                id: true
                            }
                        },
                        experienceRecords: {
                            select: {
                                id: true
                            }
                        },
                        applications: {
                            select: {
                                id: true,
                                status: true,
                                updatedAt: true,
                                job: {
                                    select: {
                                        jobTitle: true,
                                        jobLocation: true,
                                        company: {
                                            select: {
                                                name: true
                                            }
                                        }
                                    }
                                }
                            },
                            orderBy: {
                                updatedAt: 'desc'
                            },
                            take: 4
                        }
                    }
                }
            }
        });

        if (!user)
            return res.redirect('/login');

        if (!user.candidate)
            return res.redirect('/candidate/profile');

        const [applicationCounts, applications, recommendedJobs] = await Promise.all([
            prisma.jobApplication.groupBy({
                by: ['status'],
                where: {
                    candidateId: user.candidate.id
                },
                _count: {
                    status: true
                }
            }),
            prisma.jobApplication.findMany({
                where: {
                    candidateId: user.candidate.id
                },
                select: {
                    jobId: true
                }
            }),
            getRecommendedJobsForCandidate(user.candidate.id, user.isMember)
        ]);
        const statusCounts = applicationCounts.reduce((counts: Record<string, number>, item: { status: string; _count: { status: number } }) => {
            counts[item.status] = item._count.status;
            return counts;
        }, {});
        const profileTasks = [
            user.candidate.profileSummary ? null : 'Add a profile summary',
            user.candidate.skills.length ? null : 'Add skills',
            user.candidate.preferredWorkingMode ? null : 'Set preferred work mode',
            user.candidate.preferredLocation ? null : 'Set preferred location',
            user.candidate.preferredJobType ? null : 'Set preferred job type',
            user.candidate.educationRecords.length ? null : 'Add education',
            user.candidate.experienceRecords.length ? null : 'Add experience'
        ].filter(Boolean);
        const profileCompletion = Math.round(((7 - profileTasks.length) / 7) * 100);
        const recentApplications = user.candidate.applications.map((application: any) => ({
            id: application.id,
            status: application.status,
            statusLabel: statusLabel(application.status),
            updatedAtLabel: dateLabel(application.updatedAt),
            jobTitle: application.job.jobTitle,
            companyName: application.job.company?.name || '',
            jobLocation: application.job.jobLocation
        }));

        const appliedJobIds = new Set(applications.map((application: { jobId: string }) => application.jobId));
        const savedJobCount = user.savedJobs.filter((savedJob: { jobId: string }) => !appliedJobIds.has(savedJob.jobId)).length;

        return res.render('pages/candidate/home', {
            ...res.payload,
            userId: req.session.userId,
            candidateHome: {
                savedJobCount,
                recommendedJobCount: recommendedJobs.length,
                profileCompletion,
                profileTasks,
                statusCounts,
                recentApplications
            }
        });
    } catch (err) {
        return next(err);
    }
}
