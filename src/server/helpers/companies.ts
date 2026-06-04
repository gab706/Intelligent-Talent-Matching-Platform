import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/prisma.js';

type PublicCompany = {
    name: string;
    description: string | null;
    industry: string | null;
    location: string | null;
    avatarHash: string | null;
};

export default async function companiesHelper(
    _req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const companies = await prisma.company.findMany({
            select: {
                name: true,
                description: true,
                industry: true,
                location: true,
                avatarHash: true
            },
            orderBy: {
                name: 'asc'
            }
        });

        return res.render('pages/companies', {
            ...res.payload,
            companies: companies.map((company: PublicCompany) => ({
                ...company,
                logoUrl: company.avatarHash
                    ? `/images/companies/${company.avatarHash}`
                    : ''
            }))
        });
    } catch (err) {
        return next(err);
    }
}
