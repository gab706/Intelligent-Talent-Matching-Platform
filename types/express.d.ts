import 'express';

declare global {
	namespace Express {
		interface Response {
			payload: {
				theme?: number;
			};
		}
	}
}

export {};