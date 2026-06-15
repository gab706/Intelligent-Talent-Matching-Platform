/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

function clean(value: unknown, max = 120): string {
    return String(value || '').trim().slice(0, max);
}

export default async function candidateRecommendWorker(
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

        const candidateId = clean(req.body?.candidateId, 80);
        const postingId = clean(req.body?.postingId, 80);

        if (!candidateId || !postingId) {
            return res.json({
                success: false,
                message: 'Please select a candidate and active posting.'
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

        const allowedCompanyIds = employer.companies.map((company: { companyId: string }) =>
            company.companyId);
        const [candidate, posting] = await Promise.all([
            prisma.candidate.findFirst({
                where: {
                    id: candidateId,
                    user: {
                        accountStatus: 'ACTIVE'
                    }
                },
                select: {
                    userId: true
                }
            }),
            prisma.jobPosting.findFirst({
                where: {
                    id: postingId,
                    companyId: {
                        in: allowedCompanyIds
                    },
                    status: 'ACTIVE',
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
                message: 'Candidate could not be found.'
            });
        }

        if (!posting) {
            return res.json({
                success: false,
                message: 'Please select an active posting from one of your companies.'
            });
        }

        await prisma.notification.create({
            data: {
                recipientId: candidate.userId,
                senderId: req.session.userId,
                type: 'RECOMMENDATION',
                title: 'Role Recommendation',
                message: `A recruiter from ${posting.company.name} thinks you might be a fit for the ${posting.jobTitle} role.`
            }
        });

        return res.json({
            success: true,
            message: 'Recommendation sent.'
        });
    } catch (err) {
        return next(err);
    }
}
