/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { prisma } from '../database/prisma.js';

export async function linkSessionToUser(sessionId: string | undefined, userId: string): Promise<void> {
    if (!sessionId)
        return;

    await prisma.session.updateMany({
        where: {
            sid: sessionId
        },
        data: {
            userId
        }
    });
}

export async function unlinkSession(sessionId: string | undefined): Promise<void> {
    if (!sessionId)
        return;

    await prisma.session.updateMany({
        where: {
            sid: sessionId
        },
        data: {
            userId: null
        }
    });
}

export async function revokeUserSessions(userId: string): Promise<void> {
    await prisma.$transaction([
        prisma.session.deleteMany({
            where: {
                userId
            }
        }),
        prisma.$executeRaw`DELETE FROM "sessions" WHERE sess->>'userId' = ${userId}`
    ]);
}
