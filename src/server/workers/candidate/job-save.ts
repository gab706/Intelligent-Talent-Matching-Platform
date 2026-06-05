import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

function clean(value: unknown, max = 120): string {
    return String(value || '').trim().slice(0, max);
}

export default async function candidateJobSaveWorker(
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
        const candidate = await prisma.candidate.findUnique({
            where: {
                userId: req.session.userId
            },
            select: {
                id: true
            }
        });

        if (!candidate) {
            return res.json({
                success: false,
                message: 'Candidate profile could not be found.'
            });
        }

        if (req.method === 'DELETE') {
            await prisma.savedJob.deleteMany({
                where: {
                    userId: req.session.userId,
                    jobId
                }
            });

            return res.json({
                success: true,
                message: 'Job unsaved.'
            });
        }

        const job = await prisma.jobPosting.findFirst({
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
        });

        if (!job) {
            return res.json({
                success: false,
                message: 'Job posting could not be found.'
            });
        }

        await prisma.savedJob.upsert({
            where: {
                userId_jobId: {
                    userId: req.session.userId,
                    jobId: job.id
                }
            },
            update: {},
            create: {
                userId: req.session.userId,
                jobId: job.id
            }
        });

        return res.json({
            success: true,
            message: 'Job saved.'
        });
    } catch (err) {
        return next(err);
    }
}
