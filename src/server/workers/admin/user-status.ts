/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';
import { getRequestIp } from '../../helpers/request-ip.js';
import { revokeUserSessions } from '../../helpers/session-links.js';

const PERMANENT_SUSPENSION_END = new Date('9999-12-31T23:59:59.999Z');
const DURATION_MS: Record<string, number> = {
    '1h': 1000 * 60 * 60,
    '6h': 1000 * 60 * 60 * 6,
    '12h': 1000 * 60 * 60 * 12,
    '24h': 1000 * 60 * 60 * 24,
    '7d': 1000 * 60 * 60 * 24 * 7,
    '30d': 1000 * 60 * 60 * 24 * 30
};

function getSuspensionEnd(duration: string): Date | null {
    if (duration === 'permanent')
        return PERMANENT_SUSPENSION_END;

    const durationMs = DURATION_MS[duration];

    if (!durationMs)
        return null;

    return new Date(Date.now() + durationMs);
}

export default async function adminUserStatusWorker(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId) {
            return res.json({
                success: false,
                message: 'Please login as an admin.'
            });
        }

        const action = String(req.body?.action || '');
        const [admin, targetUser] = await Promise.all([
            prisma.user.findUnique({
                where: {
                    id: req.session.userId
                },
                select: {
                    id: true,
                    role: true
                }
            }),
            prisma.user.findUnique({
                where: {
                    id: String(req.body?.userId || '')
                },
                select: {
                    id: true,
                    accountStatus: true
                }
            })
        ]);

        if (admin?.role !== 'ADMIN') {
            return res.json({
                success: false,
                message: 'Only admins can manage user status.'
            });
        }

        if (!targetUser) {
            return res.json({
                success: false,
                message: 'User could not be found.'
            });
        }

        if (targetUser.id === req.session.userId) {
            return res.json({
                success: false,
                message: 'You cannot suspend your own account.'
            });
        }

        if (targetUser.accountStatus === 'DELETED') {
            return res.json({
                success: false,
                message: 'Deleted accounts cannot be managed here.'
            });
        }

        const isUnsuspend = action === 'unsuspend' || (action !== 'suspend' && targetUser.accountStatus === 'SUSPENDED');
        const accountStatus = isUnsuspend ? 'ACTIVE' : 'SUSPENDED';
        const reason = String(req.body?.reason || '').trim().slice(0, 1000);
        const duration = String(req.body?.duration || '');
        const datetimeEnd = accountStatus === 'SUSPENDED'
            ? getSuspensionEnd(duration)
            : null;

        if (accountStatus === 'SUSPENDED' && (!reason || !datetimeEnd)) {
            return res.json({
                success: false,
                message: 'Please provide a suspension reason and duration.'
            });
        }

        const now = new Date();

        await prisma.$transaction([
            prisma.user.update({
                where: {
                    id: targetUser.id
                },
                data: {
                    accountStatus
                }
            }),
            ...(accountStatus === 'SUSPENDED'
                ? [
                    prisma.suspension.create({
                        data: {
                            ipAddress: getRequestIp(req),
                            userId: targetUser.id,
                            reason,
                            issuedById: admin.id,
                            datetimeEnd: datetimeEnd as Date
                        }
                    })
                ]
                : [
                    prisma.suspension.updateMany({
                        where: {
                            userId: targetUser.id,
                            issuedById: {
                                not: null
                            },
                            datetimeEnd: {
                                gt: now
                            }
                        },
                        data: {
                            datetimeEnd: now
                        }
                    })
                ])
        ]);

        if (accountStatus === 'SUSPENDED')
            await revokeUserSessions(targetUser.id);

        return res.json({
            success: true,
            accountStatus,
            isSuspended: accountStatus === 'SUSPENDED',
            activeSuspension: accountStatus === 'SUSPENDED' && datetimeEnd
                ? {
                    reason,
                    issuedBy: 'You',
                    datetimeEnd: datetimeEnd.toISOString(),
                    startedAt: now.toISOString()
                }
                : null,
            message: accountStatus === 'SUSPENDED'
                ? 'Account suspended.'
                : 'Account reactivated.'
        });
    } catch (err) {
        return next(err);
    }
}
