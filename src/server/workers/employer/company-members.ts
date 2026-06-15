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

export default async function companyMembersWorker(
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

        const action = clean(req.body?.action, 40);
        const companyId = clean(req.body?.companyId, 80);
        const targetEmployerId = clean(req.body?.employerId, 80);
        const invitationId = clean(req.body?.invitationId, 80);
        const requestedRole = clean(req.body?.role, 20) === 'ADMIN'
            ? 'ADMIN'
            : 'USER';

        if (!companyId || !['invite', 'role', 'remove', 'cancel-invitation'].includes(action)) {
            return res.json({
                success: false,
                message: 'Invalid company member action.'
            });
        }

        if (['invite', 'role', 'remove'].includes(action) && !targetEmployerId) {
            return res.json({
                success: false,
                message: 'Invalid company member action.'
            });
        }

        if (action === 'cancel-invitation' && !invitationId) {
            return res.json({
                success: false,
                message: 'Invalid company member action.'
            });
        }

        const actorEmployer = await prisma.employer.findUnique({
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

        if (!actorEmployer) {
            return res.json({
                success: false,
                message: 'Employer account could not be found.'
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
                        role: true,
                        employer: {
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

        const actorMembership = company.employers.find((member: any) =>
            member.employerId === actorEmployer.id);
        const isOwner = company.ownedById === req.session.userId;
        const isAdmin = actorMembership?.role === 'ADMIN';

        if (!actorMembership) {
            return res.json({
                success: false,
                message: 'You are not attached to this company.'
            });
        }

        const actorName = `${actorEmployer.user.firstName} ${actorEmployer.user.lastName}`.trim();

        if (action === 'invite') {
            if (!isOwner && !isAdmin) {
                return res.json({
                    success: false,
                    message: 'Only company admins can invite members.'
                });
            }

            const role = isOwner ? requestedRole : 'USER';

            if (company.employers.some((member: any) => member.employerId === targetEmployerId)) {
                return res.json({
                    success: false,
                    message: 'That employer is already attached to this company.'
                });
            }

            const targetEmployer = await prisma.employer.findUnique({
                where: {
                    id: targetEmployerId
                },
                select: {
                    id: true,
                    userId: true
                }
            });

            if (!targetEmployer) {
                return res.json({
                    success: false,
                    message: 'Employer account could not be found.'
                });
            }

            const pendingInvite = await prisma.companyInvitation.findFirst({
                where: {
                    companyId,
                    recipientEmployerId: targetEmployer.id,
                    status: 'PENDING'
                },
                select: {
                    id: true
                }
            });

            if (pendingInvite) {
                return res.json({
                    success: false,
                    message: 'That employer already has a pending invitation.'
                });
            }

            await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                await tx.companyInvitation.create({
                    data: {
                        companyId,
                        recipientEmployerId: targetEmployer.id,
                        invitedByEmployerId: actorEmployer.id,
                        role
                    }
                });

                await tx.notification.create({
                    data: {
                        recipientId: targetEmployer.userId,
                        senderId: req.session.userId,
                        type: 'USER',
                        title: 'Company Invitation',
                        message: `${actorName} has invited you to join ${company.name}.`
                    }
                });
            });

            return res.json({
                success: true,
                message: 'Company invitation sent.'
            });
        }

        if (action === 'remove') {
            if (!isOwner && !isAdmin) {
                return res.json({
                    success: false,
                    message: 'Only company admins can remove members.'
                });
            }

            const targetMembership = company.employers.find((member: any) =>
                member.employerId === targetEmployerId);

            if (!targetMembership) {
                return res.json({
                    success: false,
                    message: 'That employer is not attached to this company.'
                });
            }

            if (targetMembership.employer.userId === company.ownedById) {
                return res.json({
                    success: false,
                    message: 'The company owner cannot be removed.'
                });
            }

            if (!isOwner && targetMembership.role === 'ADMIN') {
                return res.json({
                    success: false,
                    message: 'Admins cannot remove other admins.'
                });
            }

            await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                await tx.employerCompany.delete({
                    where: {
                        employerId_companyId: {
                            employerId: targetEmployerId,
                            companyId
                        }
                    }
                });

                await tx.notification.create({
                    data: {
                        recipientId: targetMembership.employer.userId,
                        senderId: req.session.userId,
                        type: 'USER',
                        title: 'Company Access Removed',
                        message: `${actorName} has removed you from ${company.name}.`
                    }
                });
            });

            return res.json({
                success: true,
                message: 'Company member removed.'
            });
        }

        if (action === 'cancel-invitation') {
            if (!isOwner && !isAdmin) {
                return res.json({
                    success: false,
                    message: 'Only company admins can cancel invitations.'
                });
            }

            const invitation = await prisma.companyInvitation.findFirst({
                where: {
                    id: invitationId,
                    companyId,
                    status: 'PENDING'
                },
                select: {
                    id: true,
                    recipientEmployer: {
                        select: {
                            userId: true
                        }
                    }
                }
            });

            if (!invitation) {
                return res.json({
                    success: false,
                    message: 'Pending invitation could not be found.'
                });
            }

            await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                await tx.companyInvitation.delete({
                    where: {
                        id: invitation.id
                    }
                });

                await tx.notification.create({
                    data: {
                        recipientId: invitation.recipientEmployer.userId,
                        senderId: req.session.userId,
                        type: 'USER',
                        title: 'Company Invitation Cancelled',
                        message: `${actorName} has cancelled your invitation to join ${company.name}.`
                    }
                });
            });

            return res.json({
                success: true,
                message: 'Company invitation cancelled.'
            });
        }

        if (!isOwner) {
            return res.json({
                success: false,
                message: 'Only the company owner can change member roles.'
            });
        }

        const targetMembership = company.employers.find((member: any) =>
            member.employerId === targetEmployerId);

        if (!targetMembership) {
            return res.json({
                success: false,
                message: 'That employer is not attached to this company.'
            });
        }

        if (targetMembership.employer.userId === company.ownedById) {
            return res.json({
                success: false,
                message: 'The company owner must remain an admin.'
            });
        }

        if (targetMembership.role === requestedRole) {
            return res.json({
                success: true,
                message: 'Member role is already up to date.'
            });
        }

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.employerCompany.update({
                where: {
                    employerId_companyId: {
                        employerId: targetEmployerId,
                        companyId
                    }
                },
                data: {
                    role: requestedRole
                }
            });

            await tx.notification.create({
                data: {
                    recipientId: targetMembership.employer.userId,
                    senderId: req.session.userId,
                    type: 'USER',
                    title: requestedRole === 'ADMIN'
                        ? 'Company Role Updated'
                        : 'Company Role Updated',
                    message: requestedRole === 'ADMIN'
                        ? `${actorName} has promoted you to Admin at ${company.name}.`
                        : `${actorName} has changed your role to User at ${company.name}.`
                }
            });
        });

        return res.json({
            success: true,
            message: 'Company member role updated.'
        });
    } catch (err) {
        return next(err);
    }
}
