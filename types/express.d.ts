import 'express';

declare global {
	namespace Express {
		interface Response {
			payload: {
				theme?: string;
			};
		}
	}
}

export {};