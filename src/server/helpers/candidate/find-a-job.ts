/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
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
                    jobId: true,
                    createdAt: true
                }
            }),
            getRecommendedJobsForCandidate(user.candidate.id, user.isMember)
        ]);
        const jobs = searchJobs(activeJobs, filters);
        const savedJobIds = user.savedJobs.map((savedJob: { jobId: string }) => savedJob.jobId);
        const appliedJobs = applications.reduce((result: Record<string, { appliedAt: string }>, application: { jobId: string; createdAt: Date }) => {
            result[application.jobId] = {
                appliedAt: application.createdAt.toISOString()
            };
            return result;
        }, {});
        const appliedJobIds = Object.keys(appliedJobs);
        return res.render('pages/candidate/find-a-job', {
            ...res.payload,
            user,
            candidate: user.candidate,
            jobs,
            recommendedJobs,
            savedJobIds,
            appliedJobIds,
            appliedJobs,
            filters,
            searchQuery: filters.keyword,
            isMember: user.isMember,
            findJobJson: JSON.stringify({
                jobs,
                recommendedJobs,
                savedJobIds,
                appliedJobIds,
                appliedJobs,
                filters
            }).replace(/</g, '\\u003c')
        });
    } catch (err) {
        return next(err);
    }
}
