/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import type { Prisma } from '../../../../prisma/generated/client.js';
import { prisma } from '../../database/prisma.js';

export default async function companyInvitationWorker(
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

        const invitationId = String(req.body?.invitationId || '');
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

        if (!employer || !invitationId || !['accept', 'decline'].includes(action)) {
            return res.json({
                success: false,
                message: 'Invalid invitation action.'
            });
        }

        const invitation = await prisma.companyInvitation.findFirst({
            where: {
                id: invitationId,
                recipientEmployerId: employer.id,
                status: 'PENDING'
            },
            select: {
                id: true,
                role: true,
                companyId: true,
                company: {
                    select: {
                        name: true,
                        ownedById: true
                    }
                }
            }
        });

        if (!invitation) {
            return res.json({
                success: false,
                message: 'Invitation could not be found.'
            });
        }

        const actorName = `${employer.user.firstName} ${employer.user.lastName}`.trim();

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.companyInvitation.update({
                where: {
                    id: invitation.id
                },
                data: {
                    status: action === 'accept' ? 'ACCEPTED' : 'DECLINED'
                }
            });

            if (action === 'accept') {
                await tx.employerCompany.upsert({
                    where: {
                        employerId_companyId: {
                            employerId: employer.id,
                            companyId: invitation.companyId
                        }
                    },
                    update: {
                        role: invitation.role
                    },
                    create: {
                        employerId: employer.id,
                        companyId: invitation.companyId,
                        role: invitation.role
                    }
                });
            }

            await tx.notification.create({
                data: {
                    recipientId: invitation.company.ownedById,
                    senderId: req.session.userId,
                    type: 'USER',
                    title: action === 'accept' ? 'Company Invitation Accepted' : 'Company Invitation Declined',
                    message: `${actorName} has ${action === 'accept' ? 'accepted' : 'declined'} the invitation to join ${invitation.company.name}.`
                }
            });
        });

        return res.json({
            success: true,
            message: action === 'accept'
                ? 'Invitation accepted.'
                : 'Invitation declined.'
        });
    } catch (err) {
        return next(err);
    }
}
