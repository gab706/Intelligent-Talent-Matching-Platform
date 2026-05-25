import { Request, Response, NextFunction } from 'express';

export default function SharedController(req: Request, res: Response, next: NextFunction): void {
	if (!req.session.isAuthenticated) {
		if (!req.session.theme)
			req.session.theme = 0;
		res.payload.theme = req.session.theme;
	}
	
	next();
}