import { Router, Request, Response, NextFunction } from 'express';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import PublicHelper from './helpers/PublicHelper.js';

type Helper = (
	req: Request,
	res: Response,
	next: NextFunction
) => void | Promise<void>;

const router: Router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const viewsDir = path.join(__dirname, '../../src/web/views/pages');
const helpersDir = path.join(__dirname, './helpers');

router.get('/', (_req: Request, res: Response) => {
	res.redirect('/index');
});

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function loadHelper(helperPath: string): Promise<Helper | null> {
	if (!(await fileExists(helperPath)))
		return null;
	
	const module = await import(pathToFileURL(helperPath).href);
	
	return typeof module.default === 'function'
		? module.default
		: null;
}

async function registerPageRoute(fullPath: string): Promise<void> {
	const relativePath = path
		.relative(viewsDir, fullPath)
		.replace(/\\/g, '/')
		.replace(/\.ejs$/, '');
	
	const route = `/${relativePath}`;
	const viewPath = `pages/${relativePath}`;
	const helperPath = path.join(helpersDir, `${relativePath}.js`);
	
	router.get(route, PublicHelper, async (req: Request, res: Response, next: NextFunction) => {
		try {
			const helper = await loadHelper(helperPath);
			
			if (helper) {
				await helper(req, res, next);
				return;
			}
			
			return res.render(viewPath, {
				...res.payload
			});
		} catch (err) {
			return next(err);
		}
	});
}

async function discoverRoutes(dir: string = viewsDir): Promise<void> {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		
		if (entry.isDirectory()) {
			await discoverRoutes(fullPath);
			continue;
		}
		
		if (entry.name.endsWith('.ejs'))
			await registerPageRoute(fullPath);
	}
}

await discoverRoutes();

export default router;