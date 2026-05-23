import { Request, Response, NextFunction } from 'express';

export default function SharedController(req: Request, res: Response, next: NextFunction): void {
	res.payload.name = 'Gabriel';
	
	next();
}