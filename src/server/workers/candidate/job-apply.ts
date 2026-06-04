import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

function clean(value: unknown, max = 120): string {
    return String(value || '').trim().slice(0, max);
}

export default async function candidateJobApplyWorker(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId || req.session.accountType === 2) {
            return res.json({
                success: false,
                message: 'Please login as a candidate.'
            });
        }

        const jobId = clean(req.params.jobId, 80);
        const [candidate, job] = await Promise.all([
            prisma.candidate.findUnique({
                where: {
                    userId: req.session.userId
                },
                select: {
                    id: true
                }
            }),
            prisma.jobPosting.findFirst({
                where: {
                    id: jobId,
                    status: 'ACTIVE',
                    isActive: true,
                    OR: [
                        {
                            closingDate: null
                        },
                        {
                            closingDate: {
                                gt: new Date()
                            }
                        }
                    ]
                },
                select: {
                    id: true
                }
            })
        ]);

        if (!candidate) {
            return res.json({
                success: false,
                message: 'Candidate profile could not be found.'
            });
        }

        if (!job) {
            return res.json({
                success: false,
                message: 'Job posting could not be found.'
            });
        }

        const existingApplication = await prisma.jobApplication.findUnique({
            where: {
                candidateId_jobId: {
                    candidateId: candidate.id,
                    jobId: job.id
                }
            },
            select: {
                id: true
            }
        });

        if (existingApplication) {
            return res.json({
                success: true,
                message: 'You have already applied for this job.'
            });
        }

        await prisma.jobApplication.create({
            data: {
                candidateId: candidate.id,
                jobId: job.id
            }
        });

        return res.json({
            success: true,
            message: 'Application submitted.'
        });
    } catch (err) {
        return next(err);
    }
}
