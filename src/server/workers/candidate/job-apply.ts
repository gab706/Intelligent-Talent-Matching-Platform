/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import type { Prisma } from '../../../../prisma/generated/client.js';
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
                    id: true,
                    userId: true
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
                    id: true,
                    jobTitle: true,
                    company: {
                        select: {
                            name: true
                        }
                    }
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

        const application = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const createdApplication = await tx.jobApplication.create({
                data: {
                    candidateId: candidate.id,
                    jobId: job.id
                },
                select: {
                    createdAt: true
                }
            });

            await tx.notification.create({
                data: {
                    recipientId: candidate.userId,
                    type: 'APPLICATION',
                    title: 'Application Submitted',
                    message: `Thank you for applying for the ${job.jobTitle} role at ${job.company.name}.`
                }
            });

            return createdApplication;
        });

        return res.json({
            success: true,
            message: 'Application submitted.',
            appliedAt: application.createdAt.toISOString()
        });
    } catch (err) {
        return next(err);
    }
}
