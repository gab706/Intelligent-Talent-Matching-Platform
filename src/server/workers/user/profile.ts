/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Prisma } from '../../../../prisma/generated/client.js';
import { prisma } from '../../database/prisma.js';
import { parseMultipart, type MultipartFile } from '../../helpers/multipart.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const avatarsDir = path.join(__dirname, '../../../web/images/avatars');
const MAX_PROFILE_UPLOAD_BYTES = 1024 * 1024 * 8;

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getAllowedAvatarExtension(file: MultipartFile): string | null {
    const filenameExtension = path.extname(file.filename).toLowerCase().replace('.', '');

    if (['jpg', 'jpeg'].includes(filenameExtension))
        return 'jpg';

    if (filenameExtension === 'png')
        return 'png';

    if (['heic', 'hiec'].includes(filenameExtension))
        return 'heic';

    if (file.mimeType === 'image/jpeg')
        return 'jpg';

    if (file.mimeType === 'image/png')
        return 'png';

    if (['image/heic', 'image/heif'].includes(file.mimeType))
        return 'heic';

    return null;
}

export default async function profileWorker(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId) {
            return res.json({
                success: false,
                message: 'Please log in to update your profile.'
            });
        }

        const { fields, files } = await parseMultipart(req, {
            maxBytes: MAX_PROFILE_UPLOAD_BYTES,
            invalidMessage: 'Invalid profile form submission.',
            tooLargeMessage: 'Profile upload is too large.',
            timeoutMessage: 'Profile upload timed out.'
        });
        const firstName = String(fields.firstName || '').trim();
        const lastName = String(fields.lastName || '').trim();
        const email = String(fields.email || '').trim().toLowerCase();
        const phone = String(fields.phone || '').trim();
        const wantsMembership = fields.membershipSubscription === 'on';
        const oldPassword = String(fields.oldPassword || '');
        const newPassword = String(fields.newPassword || '');
        const confirmPassword = String(fields.confirmPassword || '');

        if (!firstName || !lastName || !email || !phone) {
            return res.json({
                success: false,
                message: 'Name, email, and phone are required.'
            });
        }

        if (!isValidEmail(email)) {
            return res.json({
                success: false,
                message: 'Please enter a valid email address.'
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                id: req.session.userId
            },
            select: {
                id: true,
                email: true,
                isMember: true,
                passwordHash: true
            }
        });

        if (!user) {
            return res.json({
                success: false,
                message: 'User account could not be found.'
            });
        }

        if (email !== user.email) {
            const existingEmailUser = await prisma.user.findUnique({
                where: {
                    email
                },
                select: {
                    id: true
                }
            });

            if (existingEmailUser) {
                return res.json({
                    success: false,
                    message: 'An account already exists with that email address.'
                });
            }
        }

        const passwordData: {
            passwordHash?: string;
        } = {};

        if (oldPassword || newPassword || confirmPassword) {
            if (!oldPassword || !newPassword || !confirmPassword) {
                return res.json({
                    success: false,
                    message: 'Old password, new password, and confirmation are required to change password.'
                });
            }

            if (newPassword.length < 8) {
                return res.json({
                    success: false,
                    message: 'New password must be at least 8 characters.'
                });
            }

            if (newPassword !== confirmPassword) {
                return res.json({
                    success: false,
                    message: 'New passwords do not match.'
                });
            }

            const oldPasswordMatches = await argon2.verify(
                user.passwordHash,
                oldPassword
            );

            if (!oldPasswordMatches) {
                return res.json({
                    success: false,
                    message: 'Old password is incorrect.'
                });
            }

            passwordData.passwordHash = await argon2.hash(newPassword);
        }

        const avatarData: {
            avatarHash?: string;
        } = {};

        const avatarFile = files.avatar;

        if (avatarFile && avatarFile.buffer.length) {
            const extension = getAllowedAvatarExtension(avatarFile);

            if (!extension) {
                return res.json({
                    success: false,
                    message: 'Avatar must be a JPG, PNG, or HEIC image.'
                });
            }

            const avatarHash = crypto.randomBytes(24).toString('hex');

            await fs.mkdir(avatarsDir, {
                recursive: true
            });

            await fs.writeFile(
                path.join(avatarsDir, `${avatarHash}.${extension}`),
                avatarFile.buffer
            );

            avatarData.avatarHash = avatarHash;
        }

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.user.update({
                where: {
                    id: req.session.userId
                },
                data: {
                    firstName,
                    lastName,
                    email,
                    phone,
                    isMember: wantsMembership,
                    ...passwordData,
                    ...avatarData
                }
            });

            if (wantsMembership !== user.isMember) {
                await tx.notification.create({
                    data: {
                        recipientId: user.id,
                        type: 'MEMBERSHIP',
                        title: wantsMembership
                            ? 'Subscription Activated'
                            : 'Subscription Deactivated',
                        message: wantsMembership
                            ? `Congratulations ${firstName}, your membership subscription has been activated`
                            : `${firstName}, we're sorry to see you go, your membership subscription has been deactivated`
                    }
                });
            }
        });

        return res.json({
            success: true,
            message: 'Profile updated successfully.'
        });
    } catch (err) {
        if (err instanceof Error) {
            const statusCode =
                err.message === 'Profile upload is too large.'
                    ? 413
                    : err.message === 'Invalid profile form submission.'
                        ? 400
                        : err.message === 'Profile upload timed out.'
                            ? 408
                            : 200;

            return res.status(statusCode).json({
                success: false,
                message: err.message
            });
        }

        return next(err);
    }
}
