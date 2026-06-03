import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

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

export default async function companyUpdateWorker(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.session.isAuthenticated || !req.session.userId || req.session.accountType === 1) {
            return res.status(401).json({
                success: false,
                message: 'Please login as an employer.'
            });
        }

        const companyId = clean(req.body?.companyId, 80);
        const name = clean(req.body?.name, 180);
        const description = clean(req.body?.description, 1000);
        const industry = clean(req.body?.industry, 160);
        const location = clean(req.body?.location, 180);
        const email = clean(req.body?.email, 180);
        const phone = clean(req.body?.phone, 80);
        const website = clean(req.body?.website, 500);
        const brandColour = clean(req.body?.brandColour, 20);
        const size = clean(req.body?.size, 80);
        const organisationType = clean(req.body?.organisationType, 60);

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
                website: website || null,
                brandColour: brandColour || null,
                size,
                organisationType: organisationType as never
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
