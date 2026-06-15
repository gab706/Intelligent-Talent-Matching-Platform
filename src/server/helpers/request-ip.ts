/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request } from 'express';

function cleanIp(value: unknown): string {
    return String(value || '')
        .split(',')[0]
        .trim()
        .replace(/^::ffff:/, '')
        .slice(0, 80);
}

export function getRequestIp(req: Request): string {
    const cloudflareIp = cleanIp(req.headers['cf-connecting-ip']);

    if (cloudflareIp)
        return cloudflareIp;

    const forwardedIp = cleanIp(req.headers['x-forwarded-for']);

    if (forwardedIp)
        return forwardedIp;

    return cleanIp(req.ip || req.socket.remoteAddress) || 'unknown';
}
