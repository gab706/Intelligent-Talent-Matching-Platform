/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import express, { Application, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import router from './router.js';
import { prisma } from './database/prisma.js';
import { linkSessionToUser } from './helpers/session-links.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const webPath = path.join(__dirname, '../../src/web');
const viewsPath = path.join(webPath, 'views');
const partialsPath = path.join(viewsPath, 'partials');

const app: Application = express();
const partialsStatic = express.static(partialsPath);
const PgSession = connectPgSimple(session);
const REQUEST_TIMEOUT_MS = 30000;

if (!process.env.SESSION_SECRET)
	throw new Error('SESSION_SECRET is required');

if (!process.env.PORT)
	throw new Error('PORT is required');

const sessionPostgresPool = new pg.Pool({
	connectionString: process.env.POSTGRES_URL,
	max: 10,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 5000
});

app.set('view engine', 'ejs');
app.set('trust proxy', true);
app.set('views', viewsPath);
app.disable('x-powered-by');

app.use((req: Request, _res, next: NextFunction) => {
	req.setTimeout(REQUEST_TIMEOUT_MS, () => {
		req.destroy(new Error('Request timed out.'));
	});
	next();
});

app.use(express.static(webPath, {
	index: false,
	etag: true,
	lastModified: true,
	maxAge: process.env.ENVIRONMENT === 'production' ? '1d' : 0
}));

app.use(cookieParser());

app.use(express.urlencoded({
	extended: true,
	limit: '1mb'
}));

app.use(express.json({
	limit: '1mb'
}));

app.use((err: Error & { type?: string; status?: number }, _req: Request, res: Response, next: NextFunction) => {
	if (err.type === 'entity.too.large') {
		return res.status(413).json({
			success: false,
			message: 'Request body is too large.'
		});
	}

	if (err instanceof SyntaxError && err.status === 400) {
		return res.status(400).json({
			success: false,
			message: 'Invalid request body.'
		});
	}

	return next(err);
});

app.use((req: Request, res, next: NextFunction) => {
	res.set({
		'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
		Pragma: 'no-cache',
		Expires: '0',
		'Surrogate-Control': 'no-store'
	});

	next();
});

app.use((_req: Request, res, next: NextFunction) => {
	res.setHeader('X-Frame-Options', 'DENY');
	res.setHeader('X-Content-Type-Options', 'nosniff');
	res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
	next();
});

app.use(session({
	name: 'itmp.sid',
	store: new PgSession({
		pool: sessionPostgresPool,
		tableName: 'sessions',
		createTableIfMissing: false
	}),
	secret: process.env.SESSION_SECRET,
	resave: false,
	saveUninitialized: false,
	rolling: true,
	cookie: {
		httpOnly: true,
		secure: process.env.ENVIRONMENT === 'production',
		sameSite: 'lax',
		maxAge: 1000 * 60 * 60 * 24 * 7
	}
}));

app.use(async (req: Request, res: Response, next: NextFunction) => {
	if (!req.session.createdAt)
		req.session.createdAt = Date.now();

	req.session.lastActivityAt = Date.now();

	if (req.session.isAuthenticated && req.session.userId) {
		try {
			const user = await prisma.user.findUnique({
				where: {
					id: req.session.userId
				},
				select: {
					accountStatus: true
				}
			});

			if (!user) {
				return req.session.destroy((err) => {
					if (err)
						return next(err);

					if (req.path.startsWith('/user') || req.path.startsWith('/candidate') || req.path.startsWith('/employer') || req.path.startsWith('/admin')) {
						const acceptsJson = req.accepts(['json', 'html']) === 'json';

						if (acceptsJson || req.method !== 'GET') {
							return res.status(401).json({
								success: false,
								message: 'Your session is no longer active. Please log in again.'
							});
						}
					}

					return res.redirect('/login');
				});
			}

			if (user.accountStatus === 'SUSPENDED' && !req.session.impersonatorUserId) {
				const activeSuspension = await prisma.suspension.findFirst({
					where: {
						userId: req.session.userId,
						issuedById: {
							not: null
						},
						datetimeEnd: {
							gt: new Date()
						}
					},
					select: {
						id: true
					}
				});

				if (!activeSuspension) {
					await prisma.user.update({
						where: {
							id: req.session.userId
						},
						data: {
							accountStatus: 'ACTIVE'
						}
					});
				} else {
					return req.session.destroy((err) => {
						if (err)
							return next(err);

						if (req.path.startsWith('/user') || req.path.startsWith('/candidate') || req.path.startsWith('/employer') || req.path.startsWith('/admin')) {
							const acceptsJson = req.accepts(['json', 'html']) === 'json';

							if (acceptsJson || req.method !== 'GET') {
								return res.status(401).json({
									success: false,
									message: 'Your session is no longer active. Please log in again.'
								});
							}
						}

						return res.redirect('/login');
					});
				}
			}

			if (user.accountStatus === 'DELETED') {
				return req.session.destroy((err) => {
					if (err)
						return next(err);

					if (req.path.startsWith('/user') || req.path.startsWith('/candidate') || req.path.startsWith('/employer') || req.path.startsWith('/admin')) {
						const acceptsJson = req.accepts(['json', 'html']) === 'json';

						if (acceptsJson || req.method !== 'GET') {
							return res.status(401).json({
								success: false,
								message: 'Your session is no longer active. Please log in again.'
							});
						}
					}

					return res.redirect('/login');
				});
			}

			await linkSessionToUser(req.sessionID, req.session.userId);
		} catch (err) {
			return next(err);
		}
	}

	next();
});

app.use((_req: Request, res, next: NextFunction) => {
	res.payload = {};
	next();
});

app.use('/partials', (req: Request, res, next: NextFunction) => {
	const isAsset = ['.js', '.css'].some(ext => req.path.endsWith(ext));

	if (!isAsset)
		return next();

	return partialsStatic(req, res, next);
});

app.use(router);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
	if (res.headersSent)
		return;

	return res.status(500).json({
		success: false,
		message: err.message || 'Unable to complete the request.'
	});
});

app.listen(process.env.PORT, () =>
	console.log(`Server running at http://localhost:${process.env.PORT}`));
