import { WarpAdapter } from '../main';

export class ContextLogger {
    private readonly _adapter: WarpAdapter;
    private readonly _context: string;

    constructor(adapter: WarpAdapter, context: string) {
        this._adapter = adapter;
        this._context = context;
    }

    silly = (message: string): void => this._adapter.log.silly(this.toContextMessage(message));
    debug = (message: string): void => this._adapter.log.debug(this.toContextMessage(message));
    info = (message: string): void => this._adapter.log.info(this.toContextMessage(message));
    warn = (message: string): void => this._adapter.log.warn(this.toContextMessage(message));
    error = (message: string, e: unknown): void => {
        let logMessage = this.toContextMessage(message);
        if (e) logMessage += ` | Error=${e}`;
        this._adapter.log.error(logMessage);
    };

    private toContextMessage = (message: string): string => {
        return `[${this._context}] ${message}`;
    }
}