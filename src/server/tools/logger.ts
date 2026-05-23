import chalk, { ChalkInstance } from 'chalk';

type LogLevel = 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';

export default class Logger {
	private static readonly COLORS: Record<LogLevel, ChalkInstance> = {
		SUCCESS: chalk.green.bold,
		INFO: chalk.blue.bold,
		WARNING: chalk.yellow.bold,
		ERROR: chalk.red.bold,
		DEBUG: chalk.magenta.bold
	};
	
	private static readonly IDENTITY = process.env.IDENTITY?.toUpperCase() ?? 'APP';
	
	private static getTimestamp(): string {
		const now = new Date();
		
		const day = now.getDate();
		const month = now.toLocaleString('en-AU', { month: 'long' });
		const year = now.getFullYear();
		
		const hour = now.getHours() % 12 || 12;
		const minute = now.getMinutes().toString().padStart(2, '0');
		const ampm = now.getHours() < 12 ? 'am' : 'pm';
		
		return `${year}-${month}-${day} @ ${hour}:${minute}${ampm}`;
	}
	
	private static format(level: LogLevel, message: string): string {
		const timestamp = chalk.hex('#FFA500')(this.getTimestamp());
		const identity = chalk.white(`(${this.IDENTITY})`);
		const tag = this.COLORS[level](`[${level}]`);
		const content = chalk.white(message);
		
		return `${timestamp} ${identity} ${tag}: ${content}`;
	}
	
	private static log(
		level: LogLevel,
		message: string,
		method: 'log' | 'warn' | 'error' | 'debug' = 'log'
	): void {
		console[method](this.format(level, message));
	}
	
	public static success(message: string): void {
		this.log('SUCCESS', message);
	}
	
	public static info(message: string): void {
		this.log('INFO', message);
	}
	
	public static warning(message: string): void {
		this.log('WARNING', message, 'warn');
	}
	
	public static error(message: string): void;
	public static error(error: Error): void;
	public static error(message: string, error: Error): void;
	public static error(message: string, shutdownCode: number): never;
	public static error(message: string, error: Error, shutdownCode: number): never;
	public static error(...args: unknown[]): void | never {
		let message = '';
		let error: Error | undefined;
		let shutdownCode: number | undefined;
		
		for (const arg of args) {
			if (typeof arg === 'string')
				message = arg;
			else if (arg instanceof Error)
				error = arg;
			else if (typeof arg === 'number')
				shutdownCode = arg;
		}
		
		const fullMessage = error
			? message
				? `${message}\n${error.stack ?? error.message}`
				: `${error.stack ?? error.message}`
			: message;
		
		this.log('ERROR', fullMessage, 'error');
		
		if (shutdownCode !== undefined)
			process.exit(shutdownCode);
	}
	
	public static debug(message: string): void {
		if (process.env.ENVIRONMENT === 'dev')
			this.log('DEBUG', message, 'debug');
	}
}