import express, { Application, Request, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import router from './router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const webPath = path.join(__dirname, '../../src/web');
const viewsPath = path.join(webPath, 'views');
const partialsPath = path.join(viewsPath, 'partials');

const app: Application = express();
const partialsStatic = express.static(partialsPath);
const PgSession = connectPgSimple(session);

if (!process.env.POSTGRES_SESSION_URL || !process.env.SESSION_SECRET)
	throw new Error('POSTGRES_SESSION_URL and SESSION_SECRET are required');

const sessionPostgresPool = new pg.Pool({
	connectionString: process.env.POSTGRES_SESSION_URL,
	max: 10,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 5000
});

app.set('view engine', 'ejs');
app.set('trust proxy', true);
app.set('views', viewsPath);
app.disable('x-powered-by');

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
		createTableIfMissing: true
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

app.use((req: Request, _res, next: NextFunction) => {
	if (!req.session.createdAt)
		req.session.createdAt = Date.now();

	req.session.lastActivityAt = Date.now();

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

app.listen(process.env.PORT, () =>
	console.log(`Server running at http://localhost:${process.env.PORT}`));