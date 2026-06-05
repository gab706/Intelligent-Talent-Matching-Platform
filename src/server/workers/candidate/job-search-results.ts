import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';
import {
    loadActiveJobs,
    normaliseFilters,
    searchJobs
} from '../../helpers/candidate/job-search.js';

function dateLabel(value: Date | null): string {
    if (!value)
        return '';

    return new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(value);
}

export default async function candidateJobSearchResultsWorker(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId || req.session.accountType === 2) {
            return res.status(401).json({
                success: false,
                message: 'Please login as a candidate.'
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                id: req.session.userId
            },
            select: {
                savedJobs: {
                    select: {
                        jobId: true
                    }
                },
                candidate: {
                    select: {
                        id: true
                    }
                }
            }
        });

        if (!user?.candidate) {
            return res.status(404).json({
                success: false,
                message: 'Candidate profile could not be found.'
            });
        }

        const filters = normaliseFilters(req.query as Record<string, unknown>);
        const [activeJobs, applications] = await Promise.all([
            loadActiveJobs(),
            prisma.jobApplication.findMany({
                where: {
                    candidateId: user.candidate.id
                },
                select: {
                    jobId: true,
                    createdAt: true
                }
            })
        ]);
        const jobs = searchJobs(activeJobs, filters);
        const savedJobIds = user.savedJobs.map((savedJob: { jobId: string }) => savedJob.jobId);
        const appliedJobs = applications.reduce((result: Record<string, { appliedAtLabel: string }>, application: { jobId: string; createdAt: Date }) => {
            result[application.jobId] = {
                appliedAtLabel: dateLabel(application.createdAt)
            };
            return result;
        }, {});

        return res.json({
            success: true,
            jobs,
            savedJobIds,
            appliedJobIds: Object.keys(appliedJobs),
            appliedJobs,
            filters
        });
    } catch (err) {
        return next(err);
    }
}
