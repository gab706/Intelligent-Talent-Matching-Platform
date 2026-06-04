import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';
import {
    getRecommendedJobsForCandidate,
    loadActiveJobs,
    normaliseFilters,
    searchJobs
} from './job-search.js';

export default async function candidateFindJobHelper(
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
                firstName: true,
                lastName: true,
                email: true,
                isMember: true,
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
                        }
                    }
                },
                savedJobs: {
                    select: {
                        jobId: true
                    }
                }
            }
        });

        if (!user)
            return res.redirect('/login');

        if (!user.candidate)
            return res.redirect('/candidate/profile');

        const filters = normaliseFilters(req.query as Record<string, unknown>);
        const [activeJobs, applications, recommendedJobs] = await Promise.all([
            loadActiveJobs(),
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
        const jobs = searchJobs(activeJobs, filters);
        const savedJobIds = user.savedJobs.map((savedJob: { jobId: string }) => savedJob.jobId);
        const appliedJobIds = applications.map((application: { jobId: string }) => application.jobId);
        const candidateProfileIncomplete =
            !user.candidate.profileSummary ||
            !user.candidate.preferredWorkingMode ||
            !user.candidate.preferredLocation ||
            !user.candidate.preferredJobType ||
            !user.candidate.skills.length;

        return res.render('pages/candidate/find-a-job', {
            ...res.payload,
            user,
            candidate: user.candidate,
            jobs,
            recommendedJobs,
            savedJobIds,
            appliedJobIds,
            filters,
            searchQuery: filters.keyword,
            isMember: user.isMember,
            candidateProfileIncomplete,
            findJobJson: JSON.stringify({
                jobs,
                recommendedJobs,
                savedJobIds,
                appliedJobIds
            }).replace(/</g, '\\u003c')
        });
    } catch (err) {
        return next(err);
    }
}
