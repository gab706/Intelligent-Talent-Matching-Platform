import express, { Application, Request, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import router from './router.js';
import logger from './tools/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const webPath = path.join(__dirname, '../../src/web');
const viewsPath = path.join(webPath, 'views');
const partialsPath = path.join(viewsPath, 'partials');

const app: Application = express();
const partialsStatic = express.static(partialsPath);

app.set('view engine', 'ejs');
app.set('trust proxy', true);
app.set('views', viewsPath);

app.use((req: Request, res, next: NextFunction) => {
	res.set({
		'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
		Pragma: 'no-cache',
		Expires: '0',
		'Surrogate-Control': 'no-store'
	});
	
	next();
});

app.use(express.static(webPath));
app.use(cookieParser());

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

app.listen(process.env.PORT, () => {
	logger.success(`Server running at http://localhost:${process.env.PORT}`);
});