/**
 * @license
 * ITMP License Version 1.0 – June 2026
 * This source code is licensed under a custom license.
 * See the LICENSE.md file in the root directory of this source tree for full details.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import PublicHelper from './helpers/PublicHelper.js';
import LogoutHelper from './helpers/logout.js';
import EmployerCompaniesHelper from './helpers/employer/companies.js';
import PublicCompanyHelper from './helpers/company.js';
import CandidateJobSaveWorker from './workers/candidate/job-save.js';
import CandidateJobApplyWorker from './workers/candidate/job-apply.js';
import CandidateJobSearchResultsWorker from './workers/candidate/job-search-results.js';

type Handler = (
	req: Request,
	res: Response,
	next: NextFunction
) => void | Promise<void>;

const router: Router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const viewsDir = path.join(__dirname, '../../src/web/views/pages');
const helpersDir = path.join(__dirname, './helpers');
const workersDir = path.join(__dirname, './workers');
const avatarImagesDir = path.join(__dirname, '../../src/web/images/avatars');
const companyImagesDir = path.join(__dirname, '../../src/web/images/companies');

router.get('/', (_req: Request, res: Response) =>
	res.redirect('/index'));

router.get('/logout', LogoutHelper);
router.get('/admin/control', (_req: Request, res: Response) =>
	res.redirect('/admin/home'));
router.get('/admin/notification-audit-log', (_req: Request, res: Response) =>
	res.redirect('/admin/notification-log'));

router.get('/employer/companies/:companyName/view', PublicHelper, EmployerCompaniesHelper);
router.get('/employer/companies/:companyName/edit', PublicHelper, EmployerCompaniesHelper);
router.get('/companies/:companyName', PublicHelper, PublicCompanyHelper);
router.post('/candidate/jobs/:jobId/save', CandidateJobSaveWorker);
router.delete('/candidate/jobs/:jobId/save', CandidateJobSaveWorker);
router.post('/candidate/jobs/:jobId/apply', CandidateJobApplyWorker);
router.get('/candidate/jobs/search', CandidateJobSearchResultsWorker);

router.get('/images/avatars/:hash', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const hash = String(req.params.hash || '');

		if (!/^[a-zA-Z0-9_-]+$/.test(hash))
			return res.redirect('/images/avatar/default.png');

		const files = await fs.readdir(avatarImagesDir);
		const avatarFile = files.find(file =>
			file.startsWith(`${hash}.`));

		if (!avatarFile)
			return res.redirect('/images/avatar/default.png');

		return res.sendFile(path.join(avatarImagesDir, avatarFile));
	} catch (err) {
		return next(err);
	}
});

router.get('/images/companies/:hash', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const hash = String(req.params.hash || '');

		if (!/^[a-zA-Z0-9_-]+$/.test(hash))
			return res.redirect('/images/avatar/default.png');

		const files = await fs.readdir(companyImagesDir);
		const imageFile = files.find(file =>
			file.startsWith(`${hash}.`));

		if (!imageFile)
			return res.redirect('/images/avatar/default.png');

		return res.sendFile(path.join(companyImagesDir, imageFile));
	} catch (err) {
		return next(err);
	}
});

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function loadHandler(handlerPath: string): Promise<Handler | null> {
	if (!(await fileExists(handlerPath)))
		return null;

	const module = await import(pathToFileURL(handlerPath).href);

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
			const helper = await loadHandler(helperPath);

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

async function registerWorkerRoute(fullPath: string): Promise<void> {
	const relativePath = path
		.relative(workersDir, fullPath)
		.replace(/\\/g, '/')
		.replace(/\.(js|ts)$/, '');

	const route = `/${relativePath}`;

	router.post(route, async (req: Request, res: Response, next: NextFunction) => {
		try {
			const worker = await loadHandler(fullPath);

			if (!worker) {
				return res.status(500).json({
					error: 'Worker file does not export a default handler.'
				});
			}

			await worker(req, res, next);
			return;
		} catch (err) {
			return next(err);
		}
	});
}

async function discoverPageRoutes(dir: string = viewsDir): Promise<void> {
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			await discoverPageRoutes(fullPath);
			continue;
		}

		if (entry.name.endsWith('.ejs')) {
			await registerPageRoute(fullPath);
		}
	}
}

async function discoverWorkerRoutes(dir: string = workersDir): Promise<void> {
	if (!(await fileExists(dir))) {
		return;
	}

	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			await discoverWorkerRoutes(fullPath);
			continue;
		}

		if (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) {
			await registerWorkerRoute(fullPath);
		}
	}
}

await discoverPageRoutes();
await discoverWorkerRoutes();

export default router;
