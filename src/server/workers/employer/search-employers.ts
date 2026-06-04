import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../database/prisma.js';

export default async function searchEmployersWorker(
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

        const query = String(req.body?.query || '').trim();
        const queryParts = query
            .split(/\s+/)
            .map(part => part.trim())
            .filter(Boolean);

        if (query.length < 1) {
            return res.json({
                success: true,
                results: []
            });
        }

        const employers = await prisma.employer.findMany({
            where: {
                user: {
                    id: {
                        not: req.session.userId
                    },
                    OR: [
                        {
                            firstName: {
                                contains: query,
                                mode: 'insensitive'
                            }
                        },
                        {
                            lastName: {
                                contains: query,
                                mode: 'insensitive'
                            }
                        },
                        ...queryParts.map(part => ({
                            OR: [
                                {
                                    firstName: {
                                        contains: part,
                                        mode: 'insensitive'
                                    }
                                },
                                {
                                    lastName: {
                                        contains: part,
                                        mode: 'insensitive'
                                    }
                                }
                            ]
                        }))
                    ]
                }
            },
            select: {
                id: true,
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            },
            take: 8
        });

        return res.json({
            success: true,
            results: employers.map((employer: any) => ({
                id: employer.id,
                name: `${employer.user.firstName} ${employer.user.lastName}`.trim(),
                email: employer.user.email
            }))
        });
    } catch (err) {
        return next(err);
    }
}
