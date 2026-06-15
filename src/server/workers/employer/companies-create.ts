/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Prisma } from '../../../../prisma/generated/client.js';
import { prisma } from '../../database/prisma.js';
import { parseMultipart, type MultipartFile } from '../../helpers/multipart.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const companyImagesDir = path.join(__dirname, '../../../web/images/companies');
const MAX_UPLOAD_BYTES = 1024 * 1024 * 8;
const ORGANISATION_TYPES = new Set([
    'PRIVATE_COMPANY',
    'PUBLIC_COMPANY',
    'GOVERNMENT_AGENCY',
    'UNIVERSITY',
    'NON_PROFIT',
    'STARTUP'
]);

function clean(value: unknown, max = 500): string {
    return String(value || '').trim().slice(0, max);
}

function normaliseWebsite(value: unknown): string | null {
    const website = clean(value, 500);

    if (!website)
        return null;

    if (/^https?:\/\//i.test(website))
        return website;

    return `https://${website}`;
}

function parseMembers(value: unknown): Array<{ employerId?: string; role?: string }> {
    const rawValue = clean(value, 10000) || '[]';

    try {
        const parsed = JSON.parse(rawValue);

        return Array.isArray(parsed) ? parsed : [];
    } catch {
        throw new Error('Invalid company member list.');
    }
}

function getImageExtension(file: MultipartFile): string | null {
    const extension = path.extname(file.filename).toLowerCase().replace('.', '');

    if (['jpg', 'jpeg'].includes(extension))
        return 'jpg';

    if (extension === 'png')
        return 'png';

    if (extension === 'webp')
        return 'webp';

    if (file.mimeType === 'image/jpeg')
        return 'jpg';

    if (file.mimeType === 'image/png')
        return 'png';

    if (file.mimeType === 'image/webp')
        return 'webp';

    return null;
}

async function saveImage(file?: MultipartFile): Promise<string | undefined> {
    if (!file || !file.buffer.length)
        return undefined;

    const extension = getImageExtension(file);

    if (!extension)
        throw new Error('Company images must be JPG, PNG, or WebP files.');

    const hash = crypto.randomBytes(24).toString('hex');

    await fs.mkdir(companyImagesDir, {
        recursive: true
    });
    await fs.writeFile(path.join(companyImagesDir, `${hash}.${extension}`), file.buffer);

    return hash;
}

export default async function companiesCreateWorker(
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

        const userId = req.session.userId;
        const employer = await prisma.employer.findUnique({
            where: {
                userId
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

        if (!employer) {
            return res.json({
                success: false,
                message: 'Employer account could not be found.'
            });
        }

        const { fields, files } = await parseMultipart(req, {
            maxBytes: MAX_UPLOAD_BYTES,
            invalidMessage: 'Invalid company form submission.',
            tooLargeMessage: 'Company upload is too large.',
            timeoutMessage: 'Company upload timed out.'
        });
        const name = clean(fields.name, 180);
        const description = clean(fields.description, 1000);
        const industry = clean(fields.industry, 160);
        const location = clean(fields.location, 180);
        const email = clean(fields.email, 180);
        const phone = clean(fields.phone, 80);
        const website = normaliseWebsite(fields.website);
        const brandColour = clean(fields.brandColour, 20);
        const size = clean(fields.size, 80);
        const organisationType = clean(fields.organisationType, 60);
        const members = parseMembers(fields.members);

        if (!name || !description || !industry || !location || !email || !phone || !size || !organisationType) {
            return res.json({
                success: false,
                message: 'Please complete all required company details.'
            });
        }

        if (!files.logo || !files.logo.buffer.length) {
            return res.json({
                success: false,
                message: 'Please upload a company logo.'
            });
        }

        if (organisationType && !ORGANISATION_TYPES.has(organisationType)) {
            return res.json({
                success: false,
                message: 'Please select a valid organisation type.'
            });
        }

        const existingCompany = await prisma.company.findUnique({
            where: {
                name
            },
            select: {
                id: true
            }
        });

        if (existingCompany) {
            return res.json({
                success: false,
                message: 'A company already exists with that name.'
            });
        }

        const logoHash = await saveImage(files.logo);
        const actorName = `${employer.user.firstName} ${employer.user.lastName}`.trim();
        const invitedEmployerIds = [...new Set(
            members
                .map(member => clean(member.employerId, 80))
                .filter(id => id && id !== employer.id)
        )];

        const invitedEmployers = invitedEmployerIds.length
            ? await prisma.employer.findMany({
                where: {
                    id: {
                        in: invitedEmployerIds
                    }
                },
                select: {
                    id: true,
                    userId: true
                }
            })
            : [];

        const company = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const createdCompany = await tx.company.create({
                data: {
                    ownedBy: {
                        connect: {
                            id: userId
                        }
                    },
                    name,
                    description,
                    industry,
                    location,
                    email,
                    phone,
                    website,
                    brandColour: brandColour || null,
                    size,
                    organisationType: organisationType as never,
                    avatarHash: logoHash,
                    employers: {
                        create: {
                            employerId: employer.id,
                            role: 'ADMIN'
                        }
                    }
                },
                select: {
                    id: true,
                    name: true
                }
            });

            for (const invitedEmployer of invitedEmployers) {
                const requestedRole = members.find(member => member.employerId === invitedEmployer.id)?.role === 'ADMIN'
                    ? 'ADMIN'
                    : 'USER';

                await tx.companyInvitation.create({
                    data: {
                        companyId: createdCompany.id,
                        recipientEmployerId: invitedEmployer.id,
                        invitedByEmployerId: employer.id,
                        role: requestedRole
                    }
                });

                await tx.notification.create({
                    data: {
                        recipientId: invitedEmployer.userId,
                        senderId: userId,
                        type: 'USER',
                        title: 'Company Invitation',
                        message: `${actorName} has invited you to join ${createdCompany.name}.`
                    }
                });
            }

            return createdCompany;
        });

        return res.json({
            success: true,
            message: 'Company created successfully.',
            companyId: company.id
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
