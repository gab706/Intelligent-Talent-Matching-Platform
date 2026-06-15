/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Request } from 'express';

export type MultipartFile = {
    filename: string;
    mimeType: string;
    buffer: Buffer;
};

export type MultipartPayload = {
    fields: Record<string, string>;
    files: Record<string, MultipartFile>;
};

type MultipartOptions = {
    maxBytes: number;
    timeoutMs?: number;
    invalidMessage: string;
    tooLargeMessage: string;
    timeoutMessage: string;
};

const DEFAULT_UPLOAD_TIMEOUT_MS = 30000;

function getBoundary(contentType: string): string | null {
    const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
    return match?.[1] || match?.[2] || null;
}

async function readRequestBuffer(req: Request, options: MultipartOptions): Promise<Buffer> {
    const contentLength = Number(req.headers['content-length'] || 0);

    if (Number.isFinite(contentLength) && contentLength > options.maxBytes)
        throw new Error(options.tooLargeMessage);

    const chunks: Buffer[] = [];
    let totalBytes = 0;

    req.setTimeout(options.timeoutMs || DEFAULT_UPLOAD_TIMEOUT_MS, () => {
        req.destroy(new Error(options.timeoutMessage));
    });

    try {
        for await (const chunk of req) {
            const buffer = Buffer.isBuffer(chunk)
                ? chunk
                : Buffer.from(chunk);

            totalBytes += buffer.length;

            if (totalBytes > options.maxBytes)
                throw new Error(options.tooLargeMessage);

            chunks.push(buffer);
        }

        return Buffer.concat(chunks);
    } finally {
        req.setTimeout(0);
    }
}

export async function parseMultipart(req: Request, options: MultipartOptions): Promise<MultipartPayload> {
    const contentType = String(req.headers['content-type'] || '');
    const boundaryValue = getBoundary(contentType);

    if (!boundaryValue)
        throw new Error(options.invalidMessage);

    const bodyBuffer = await readRequestBuffer(req, options);
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
