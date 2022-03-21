import * as utils from '@iobroker/adapter-core';
import { ContextLogger } from './lib/context-logger';
import { WarpService } from './warp/warp-service';

export class WarpAdapter extends utils.Adapter {
	private readonly _log: ContextLogger;
	private readonly _warpService: WarpService;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: 'warp',
		});

		this._log = new ContextLogger(this, 'Main');
		this._warpService = new WarpService(this);

		this.on('ready', this.onReadyAsync.bind(this));
		this.on('stateChange', this.onStateChangeAsync.bind(this));
		this.on('unload', this.onUnloadAsync.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	private async onReadyAsync(): Promise<void> {
		this._log.info('Start initializing WARP adapter');
		this.setState('info.connection', false, true);

		const product = await this.getStateAsync('info.product');
		const model = await this.getStateAsync('info.model');
		const version = await this.getStateAsync('info.version');
		const configurationChanged = this.config.product !== product?.val || this.config.model !== model?.val;

		await this._warpService.initAsync(configurationChanged, <string>(version?.val ?? '0.0.0'));

		await this.setStateAsync('info.product', this.config.product, true);
		await this.setStateAsync('info.model', this.config.model, true);
		await this.setStateAsync('info.version', this.version, true);
		this._log.info('WARP adapter initialized');
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 */
	private async onUnloadAsync(callback: () => void): Promise<void> {
		try {
			this._log.info('Shutting down WARP adapter');
			await this._warpService.terminateAsync();
			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed state changes
	 */
	private async onStateChangeAsync(id: string, state: ioBroker.State | null | undefined): Promise<void> {
		if (state) {
			this._warpService.handleStateChangedAsync(id, state);
		}
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new WarpAdapter(options);
} else {
	// otherwise start the instance directly
	(() => new WarpAdapter())();
}
