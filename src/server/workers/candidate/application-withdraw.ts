import { Request, Response, NextFunction } from 'express';
import type { Prisma } from '../../../../prisma/generated/client.js';
import { prisma } from '../../database/prisma.js';

function clean(value: unknown, max = 120): string {
    return String(value || '').trim().slice(0, max);
}

export default async function candidateApplicationWithdrawWorker(
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

        const applicationId = clean(req.body?.applicationId, 80);
        const candidate = await prisma.candidate.findUnique({
            where: {
                userId: req.session.userId
            },
            select: {
                id: true,
                user: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        if (!candidate) {
            return res.json({
                success: false,
                message: 'Candidate profile could not be found.'
            });
        }

        const application = await prisma.jobApplication.findFirst({
            where: {
                id: applicationId,
                candidateId: candidate.id
            },
            select: {
                id: true,
                status: true,
                job: {
                    select: {
                        jobTitle: true,
                        employer: {
                            select: {
                                userId: true
                            }
                        },
                        company: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            }
        });

        if (!application) {
            return res.json({
                success: false,
                message: 'Application could not be found.'
            });
        }

        if (['HIRED', 'REJECTED', 'WITHDRAWN'].includes(application.status)) {
            return res.json({
                success: false,
                message: 'This application can no longer be withdrawn.'
            });
        }

        const candidateName = `${candidate.user.firstName} ${candidate.user.lastName}`.trim();

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.jobApplication.update({
                where: {
                    id: application.id
                },
                data: {
                    status: 'WITHDRAWN'
                }
            });

            await tx.notification.create({
                data: {
                    recipientId: application.job.employer.userId,
                    senderId: req.session.userId,
                    type: 'APPLICATION',
                    title: 'Application Withdrawn',
                    message: `${candidateName} withdrew their application for ${application.job.jobTitle} at ${application.job.company.name}.`
                }
            });
        });

        return res.json({
            success: true,
            message: 'Application withdrawn.',
            status: 'WITHDRAWN',
            statusLabel: 'Withdrawn'
        });
    } catch (err) {
        return next(err);
    }
}
