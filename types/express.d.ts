import 'express';

declare global {
	namespace Express {
		interface Response {
			payload: {
				name?: string;
			};
		}
	}
}

export {};