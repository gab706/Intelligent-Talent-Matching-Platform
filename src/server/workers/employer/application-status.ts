/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import type { Prisma } from '../../../../prisma/generated/client.js';
import { prisma } from '../../database/prisma.js';

const STATUSES = new Set(['APPLIED', 'SHORTLISTED', 'HIRED', 'REJECTED']);

function clean(value: unknown, max = 120): string {
    return String(value || '').trim().slice(0, max);
}

function statusMessage(status: string, role: string, company: string): string {
    const messages: Record<string, string> = {
        APPLIED: `Thank you for applying for the ${role} role at ${company}.`,
        SHORTLISTED: `Congratulations, you have been shortlisted for the ${role} role at ${company}. Someone will be in touch soon.`,
        HIRED: `Congratulations!! ${company} would like to offer you the role of ${role}`,
        REJECTED: `Thank you for taking the time to apply for the ${role} role at ${company}. Unfortunately you have been unsuccessful this time.`
    };

    return messages[status] || `Your application for the ${role} role at ${company} has been updated.`;
}

export default async function applicationStatusWorker(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId || req.session.accountType === 1) {
            return res.json({
                success: false,
                message: 'Please login as an employer.'
            });
        }

        const applicationId = clean(req.body?.applicationId, 80);
        const status = clean(req.body?.status, 30);

        if (!applicationId || !STATUSES.has(status)) {
            return res.json({
                success: false,
                message: 'Invalid application status.'
            });
        }

        const employer = await prisma.employer.findUnique({
            where: {
                userId: req.session.userId
            },
            select: {
                id: true,
                companies: {
                    select: {
                        companyId: true
                    }
                }
            }
        });

        if (!employer) {
            return res.json({
                success: false,
                message: 'Employer account could not be found.'
            });
        }

        const allowedCompanyIds = employer.companies.map((item: { companyId: string }) =>
            item.companyId);
        const application = await prisma.jobApplication.findFirst({
            where: {
                id: applicationId,
                job: {
                    companyId: {
                        in: allowedCompanyIds
                    }
                }
            },
            select: {
                id: true,
                status: true,
                candidate: {
                    select: {
                        userId: true
                    }
                },
                job: {
                    select: {
                        jobTitle: true,
                        status: true,
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

        if (application.job.status === 'CLOSED') {
            return res.json({
                success: false,
                message: 'Closed postings are view only.'
            });
        }

        if (application.status === status) {
            return res.json({
                success: true,
                message: 'Application already has that status.'
            });
        }

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.jobApplication.update({
                where: {
                    id: application.id
                },
                data: {
                    status: status as never
                }
            });

            await tx.notification.create({
                data: {
                    recipientId: application.candidate.userId,
                    senderId: req.session.userId,
                    type: 'APPLICATION',
                    title: 'Application Updated',
                    message: statusMessage(status, application.job.jobTitle, application.job.company.name)
                }
            });
        });

        return res.json({
            success: true,
            message: 'Application moved.',
            status
        });
    } catch (err) {
        return next(err);
    }
}
