import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

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

        const [admin, targetUser] = await Promise.all([
            prisma.user.findUnique({
                where: {
                    id: req.session.userId
                },
                select: {
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

        const accountStatus = targetUser.accountStatus === 'SUSPENDED'
            ? 'ACTIVE'
            : 'SUSPENDED';

        await prisma.user.update({
            where: {
                id: targetUser.id
            },
            data: {
                accountStatus
            }
        });

        return res.json({
            success: true,
            accountStatus,
            isSuspended: accountStatus === 'SUSPENDED',
            message: accountStatus === 'SUSPENDED'
                ? 'Account suspended.'
                : 'Account reactivated.'
        });
    } catch (err) {
        return next(err);
    }
}
