import { Request, Response, NextFunction } from 'express';
import type { Prisma } from '../../../../prisma/generated/client.js';
import { prisma } from '../../database/prisma.js';

export default async function companyActionWorker(
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

        const companyId = String(req.body?.companyId || '');
        const action = String(req.body?.action || '');
        const employer = await prisma.employer.findUnique({
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

        if (!employer || !companyId) {
            return res.json({
                success: false,
                message: 'Invalid company action.'
            });
        }

        const company = await prisma.company.findUnique({
            where: {
                id: companyId
            },
            select: {
                id: true,
                name: true,
                ownedById: true,
                employers: {
                    select: {
                        employerId: true,
                        employer: {
                            select: {
                                userId: true
                            }
                        }
                    }
                },
                invitations: {
                    where: {
                        status: 'PENDING'
                    },
                    select: {
                        recipientEmployer: {
                            select: {
                                userId: true
                            }
                        }
                    }
                }
            }
        });

        if (!company) {
            return res.json({
                success: false,
                message: 'Company could not be found.'
            });
        }

        const actorName = `${employer.user.firstName} ${employer.user.lastName}`.trim();

        if (action === 'leave') {
            if (company.ownedById === req.session.userId) {
                return res.json({
                    success: false,
                    message: 'Company owners cannot leave their own company.'
                });
            }

            await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                await tx.employerCompany.deleteMany({
                    where: {
                        companyId,
                        employerId: employer.id
                    }
                });

                await tx.notification.create({
                    data: {
                        recipientId: company.ownedById,
                        senderId: req.session.userId,
                        type: 'USER',
                        title: 'Company Member Left',
                        message: `${actorName} has left ${company.name}.`
                    }
                });
            });

            return res.json({
                success: true,
                message: 'You have left the company.'
            });
        }

        if (action === 'delete') {
            if (company.ownedById !== req.session.userId) {
                return res.json({
                    success: false,
                    message: 'Only the company owner can delete this company.'
                });
            }

            await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                const attachedRecipients = company.employers
                    .map((member: any) => member.employer.userId)
                    .filter((userId: string) => userId !== req.session.userId);
                const pendingRecipients = company.invitations
                    .map((invitation: any) => invitation.recipientEmployer.userId)
                    .filter((userId: string) => userId !== req.session.userId);
                const notificationRecipients = Array.from(new Set([
                    ...attachedRecipients,
                    ...pendingRecipients
                ]));

                if (notificationRecipients.length) {
                    await tx.notification.createMany({
                        data: notificationRecipients.map((recipientId: string) => ({
                            recipientId,
                            senderId: req.session.userId,
                            type: 'USER' as const,
                            title: 'Company Deleted',
                            message: pendingRecipients.includes(recipientId)
                                ? `Your invitation to join ${company.name} was cancelled because the company was deleted.`
                                : `${company.name} has been deleted by the company owner.`
                        }))
                    });
                }

                await tx.company.delete({
                    where: {
                        id: companyId
                    }
                });
            });

            return res.json({
                success: true,
                message: 'Company deleted.'
            });
        }

        return res.json({
            success: false,
            message: 'Invalid company action.'
        });
    } catch (err) {
        return next(err);
    }
}
