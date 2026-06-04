import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../../database/prisma.js';

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

type MultipartFile = {
    filename: string;
    mimeType: string;
    buffer: Buffer;
};

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

function getBoundary(contentType: string): string | null {
    const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
    return match?.[1] || match?.[2] || null;
}

async function readRequestBuffer(req: Request): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buffer.length;

        if (totalBytes > MAX_UPLOAD_BYTES)
            throw new Error('Company upload is too large.');

        chunks.push(buffer);
    }

    return Buffer.concat(chunks);
}

async function parseMultipart(req: Request) {
    const contentType = String(req.headers['content-type'] || '');
    const boundaryValue = getBoundary(contentType);

    if (!boundaryValue)
        throw new Error('Invalid company form submission.');

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

export default async function companyUpdateWorker(
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

        const isMultipart = String(req.headers['content-type'] || '').includes('multipart/form-data');
        const parsed = isMultipart
            ? await parseMultipart(req)
            : {
                fields: req.body || {},
                files: {}
            };
        const fields = parsed.fields;
        const files = parsed.files as Record<string, MultipartFile>;
        const companyId = clean(fields.companyId, 80);
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

        if (!companyId || !name || !description || !industry || !location || !email || !phone || !size || !organisationType) {
            return res.json({
                success: false,
                message: 'Please complete all required company details.'
            });
        }

        if (!ORGANISATION_TYPES.has(organisationType)) {
            return res.json({
                success: false,
                message: 'Please select a valid organisation type.'
            });
        }

        const employer = await prisma.employer.findUnique({
            where: {
                userId: req.session.userId
            },
            select: {
                id: true
            }
        });

        if (!employer) {
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
                employers: {
                    where: {
                        employerId: employer.id
                    },
                    select: {
                        role: true
                    }
                }
            }
        });

        if (!company || company.employers[0]?.role !== 'ADMIN') {
            return res.json({
                success: false,
                message: 'Only company admins can edit this company.'
            });
        }

        if (name !== company.name) {
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
        }

        const logoHash = await saveImage(files.logo);

        await prisma.company.update({
            where: {
                id: companyId
            },
            data: {
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
                ...(logoHash
                    ? {
                        avatarHash: logoHash
                    }
                    : {})
            }
        });

        return res.json({
            success: true,
            message: 'Company updated.',
            companyName: name
        });
    } catch (err) {
        return next(err);
    }
}
