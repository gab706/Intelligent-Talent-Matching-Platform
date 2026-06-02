import { Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../../database/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const avatarsDir = path.join(__dirname, '../../../web/images/avatars');
const MAX_PROFILE_UPLOAD_BYTES = 1024 * 1024 * 8;

type MultipartFile = {
    filename: string;
    mimeType: string;
    buffer: Buffer;
};

type MultipartPayload = {
    fields: Record<string, string>;
    files: Record<string, MultipartFile>;
};

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getBoundary(contentType: string): string | null {
    const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
    return match?.[1] || match?.[2] || null;
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

async function readRequestBuffer(req: Request): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(chunk);

        totalBytes += buffer.length;

        if (totalBytes > MAX_PROFILE_UPLOAD_BYTES)
            throw new Error('Profile upload is too large.');

        chunks.push(buffer);
    }

    return Buffer.concat(chunks);
}

async function parseMultipart(req: Request): Promise<MultipartPayload> {
    const contentType = String(req.headers['content-type'] || '');
    const boundaryValue = getBoundary(contentType);

    if (!boundaryValue)
        throw new Error('Invalid profile form submission.');

    const bodyBuffer = await readRequestBuffer(req);
    const body = bodyBuffer.toString('binary');
    const boundary = `--${boundaryValue}`;
    const fields: Record<string, string> = {};
    const files: Record<string, MultipartFile> = {};

    for (const rawPart of body.split(boundary).slice(1, -1)) {
        const part = rawPart.replace(/^\r\n/, '').replace(/\r\n$/, '');
        const headerEnd = part.indexOf('\r\n\r\n');

        if (headerEnd === -1)
            continue;

        const rawHeaders = part.slice(0, headerEnd);
        const content = part.slice(headerEnd + 4);
        const headers = Object.fromEntries(
            rawHeaders
                .split('\r\n')
                .map(header => {
                    const separatorIndex = header.indexOf(':');

                    return [
                        header.slice(0, separatorIndex).trim().toLowerCase(),
                        header.slice(separatorIndex + 1).trim()
                    ];
                })
                .filter(([name]) => name)
        );

        const disposition = headers['content-disposition'] || '';
        const name = disposition.match(/name="([^"]+)"/)?.[1];

        if (!name)
            continue;

        const filename = disposition.match(/filename="([^"]*)"/)?.[1];
        const buffer = Buffer.from(content, 'binary');

        if (filename) {
            files[name] = {
                filename,
                mimeType: headers['content-type'] || '',
                buffer
            };
            continue;
        }

        fields[name] = buffer.toString('utf8');
    }

    return {
        fields,
        files
    };
}

export default async function profileWorker(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId) {
            return res.status(401).json({
                success: false,
                message: 'Please log in to update your profile.'
            });
        }

        const { fields, files } = await parseMultipart(req);
        const firstName = String(fields.firstName || '').trim();
        const lastName = String(fields.lastName || '').trim();
        const email = String(fields.email || '').trim().toLowerCase();
        const phone = String(fields.phone || '').trim();
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
                passwordHash: true
            }
        });

        if (!user) {
            return res.status(404).json({
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

        await prisma.user.update({
            where: {
                id: req.session.userId
            },
            data: {
                firstName,
                lastName,
                email,
                phone,
                ...passwordData,
                ...avatarData
            }
        });

        return res.json({
            success: true,
            message: 'Profile updated successfully.'
        });
    } catch (err) {
        if (err instanceof Error) {
            return res.json({
                success: false,
                message: err.message
            });
        }

        return next(err);
    }
}
