import * as axios from 'axios';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import WebSocketClient from 'ws';
import { WarpAdapter } from '../main';
import { ContextLogger } from './../lib/context-logger';
import { WarpMessage, WarpMetaInformation, WarpProduct } from './models';

export class WarpClient {
    private readonly _reconnectTimeoutInSeconds = 60;
    private readonly _connectionCheckIntervalInSeconds = 15;
    private readonly _maxAllowedDistanceBetweenKeepAliveInSeconds = 40;
    private readonly _messageEncoding = 'utf-8';
    private readonly _adapter: WarpAdapter;
    private readonly _log: ContextLogger;
    private _reconnectTimeout!: NodeJS.Timeout;
    private _checkConnectionInterval!: NodeJS.Timeout;
    private _lastReceivedKeepAliveTimestamp!: number;
    private _apiBasePath!: string;
    private _webSocketBasePath!: string;
    private _nonceCount = 1;

    private _ws: WebSocketClient | undefined;
    private _successfulInitialConnection = false;
    private _adapterIsShuttingDown = false;

    public readonly webSocketMessageEmitter = new EventEmitter();

    constructor(adapter: WarpAdapter) {
        this._adapter = adapter;
        this._log = new ContextLogger(adapter, WarpClient.name);
    }

    public async initAsync(): Promise<void> {
        this._log.info('Initializing');
        try {
            this._apiBasePath = `http${this._adapter.config.secureConnection ? 's' : ''}://${this._adapter.config.ipOrHostname}`;
            this._webSocketBasePath = `ws${this._adapter.config.secureConnection ? 's' : ''}://${this._adapter.config.ipOrHostname}`;
            this._log.debug(`WARP charger api base path: '${this._apiBasePath}'. Websocket base path: '${this._webSocketBasePath}'`);
        } catch (e) {
            this._log.error('Initializing failed', e)
        }
        this._log.info('Initialized');
    }

    public async connectAsync(): Promise<void> {
        this._log.info('Try connecting to WARP charger');
        try {
            this._lastReceivedKeepAliveTimestamp = Date.now();
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            const warpClient = this;
            if (this._reconnectTimeout) clearTimeout(this._reconnectTimeout);
            if (this._checkConnectionInterval) clearInterval(this._checkConnectionInterval);
            if (this._ws) this._ws.close();
            const path = '/ws';
            const authorizationToken = await this.getAuthorizationTokenAsync(path, 'GET');
            this._ws = new WebSocketClient(`${this._webSocketBasePath}${path}`, authorizationToken ? { headers: { 'authorization': authorizationToken } } : undefined);
            this._ws.on('open', () => warpClient.handleWebSocketConnectedAsync());
            this._ws.on('message', (data) => warpClient.handleWebSocketMessageAsync(data));
            this._ws.on('error', (data) => warpClient.handleWebSocketErrorAsync(data));
            this._ws.on('close', (data) => warpClient.handleWebSocketDisconnectedAsync(data));
        } catch (e) {
            this._log.error('Connecting to WARP charger failed', e);
        }
    }

    public disconnect(): void {
        if (this._reconnectTimeout) clearTimeout(this._reconnectTimeout);
        if (this._checkConnectionInterval) clearInterval(this._checkConnectionInterval);
        this._adapterIsShuttingDown = true;
        if (this._ws) {
            this._log.info('Disconnecting from WARP charger');
            this._ws.close();
        }
    }

    public async getMetaInformationForStartup(): Promise<WarpMetaInformation | undefined> {
        this._log.info('Retrieve meta information for adapter startup from WARP charger');
        try {
            const versionResponse = await this.doGetRequestAsync('/info/version');
            const nameResponse = await this.doGetRequestAsync('/info/name');
            const featuresResponse = <string[]>await this.doGetRequestAsync('/info/features');

            if (versionResponse?.hasOwnProperty('firmware')
                && nameResponse?.hasOwnProperty('name')
                && nameResponse?.hasOwnProperty('type')
                && nameResponse?.hasOwnProperty('display_type')
                && !!featuresResponse) {
                return {
                    name: nameResponse['name'],
                    product: nameResponse['type'] === 'warp' ? WarpProduct.warp1 : WarpProduct.warp2,
                    firmwareVersion: versionResponse['firmware'],
                    displayType: nameResponse['display_type'],
                    features: featuresResponse
                };
            }
            return undefined;
        } catch (e) {
            this._log.error('Retrieving meta information failed', e);
        }
    }

    private async doGetRequestAsync(path: string): Promise<any> {
        const authorizationToken = await this.getAuthorizationTokenAsync(path, 'GET');
        const headers: axios.AxiosRequestHeaders = authorizationToken ? { Accept: 'application/json', Authorization: authorizationToken } : { Accept: 'application/json' };
        const url = `${this._apiBasePath}${path}`;
        this._log.debug(`GET: ${url}`);
        const response = await axios.default({
            headers: headers,
            method: 'GET',
            url: url
        });
        return response.data;
    }

    public async sendMessageAsync(message: WarpMessage, method: 'PUT' | 'GET' = 'PUT'): Promise<void> {
        this._log.info('Send message to WARP charger');
        this._log.silly('Message: ' + JSON.stringify(message));
        try {
            const path = `/${message.topic}`;
            const authorizationToken = await this.getAuthorizationTokenAsync(path, method);
            const headers: axios.AxiosRequestHeaders = authorizationToken ? { Accept: 'application/json', Authorization: authorizationToken } : { Accept: 'application/json' };
            const url = `${this._apiBasePath}${path}`;
            this._log.debug(`${method}: ${url}`);
            await axios.default({
                headers: headers,
                method: method,
                url: url,
                data: method === 'PUT' ? message.payload : undefined
            });
        } catch (e) {
            this._log.error('Sending message to WARP charger failed', e);
        }
    }

    private async getAuthorizationTokenAsync(path: string, method: string): Promise<string | undefined> {
        // see https://github.com/mhoc/axios-digest-auth
        if (!this._adapter.config.authEnabled) return undefined;
        this._log.debug('Check credentials and authorize if needed');
        try {
            await axios.default({
                headers: { Accept: 'application/json' },
                method: 'GET',
                url: `${this._apiBasePath}/credential_check`,
            });
            this._log.debug('No credentials needed');
            return undefined;
        } catch (resp1: any) {
            if (resp1.response === undefined
                || resp1.response.status !== 401
                || !resp1.response.headers['www-authenticate']?.includes('nonce')) {
                this._log.error('Need credentials, but no authorization possible', JSON.stringify(resp1));
            }
            this._log.debug('Need credentials. Authorize with digest access authentication');
            const authDetails = resp1.response.headers['www-authenticate'].split(',').map((v: string) => v.split('='));
            const nonceCount = ('00000000' + this._nonceCount++).slice(-8);
            const cnonce = crypto.randomBytes(24).toString('hex');
            const realm = authDetails.find((el: any) => el[0].toLowerCase().indexOf('realm') > -1)[1].replace(/"/g, '');
            const nonce = authDetails.find((el: any) => el[0].toLowerCase().indexOf('nonce') > -1)[1].replace(/"/g, '');
            const ha1 = crypto.createHash('md5').update(`${this._adapter.config.user}:${realm}:${this._adapter.config.password}`).digest('hex');
            const ha2 = crypto.createHash('md5').update(`${method}:${path}`).digest('hex');
            const response = crypto.createHash('md5').update(`${ha1}:${nonce}:${nonceCount}:${cnonce}:auth:${ha2}`).digest('hex');
            const authorization = `Digest username="${this._adapter.config.user}",realm="${realm}",nonce="${nonce}",uri="${path}",qop="auth",algorithm="MD5",response="${response}",nc="${nonceCount}",cnonce="${cnonce}"`;
            return authorization;
        }
    }

    private async handleWebSocketConnectedAsync(): Promise<void> {
        this._log.info('Connected to WARP charger');
        this._successfulInitialConnection = true;
        await this._adapter.setStateAsync('info.connection', true, true);
        this._checkConnectionInterval = setInterval(() => this.checkConnection(), this._connectionCheckIntervalInSeconds * 1000);
    }

    private async handleWebSocketMessageAsync(data: WebSocketClient.RawData): Promise<void> {
        this._log.debug('Received new message from WARP charger via websocket');
        this._log.silly(`raw data: ${data}`);
        for (const s of data.toString(this._messageEncoding).split('\n')) {
            if (s.length > 1) {
                const message = <WarpMessage>JSON.parse(s);
                if (message.topic === 'keep-alive') {
                    this._log.debug('Got keep alive from WARP charger');
                    this._lastReceivedKeepAliveTimestamp = Date.now();
                } else if (!this._adapterIsShuttingDown) {
                    this.webSocketMessageEmitter.emit('message', message);
                }
            }
        }
    }

    private async handleWebSocketErrorAsync(error: Error): Promise<void> {
        this._log.error('Error occurred on websocket connection to WARP', error);
    }

    private async handleWebSocketDisconnectedAsync(_data: number): Promise<void> {
        await this._adapter.setStateAsync('info.connection', false, true);
        if (!this._adapterIsShuttingDown && this._successfulInitialConnection) {
            if (_data === -1) {
                this._log.warn(`Try reconnecting`);
                this.connectAsync();
            } else {
                this._log.warn(`Unexpected disconnected from WARP charger. Try reconnecting in ${this._reconnectTimeoutInSeconds} seconds`);
                this._reconnectTimeout = setTimeout(() => {
                    if (!this._adapterIsShuttingDown
                        && this._successfulInitialConnection
                        && this.getSecondsSinceLastKeepAlive() > this._maxAllowedDistanceBetweenKeepAliveInSeconds) {
                        this.connectAsync();
                    }
                }, this._reconnectTimeoutInSeconds * 1000);
            }
        }
    }

    private checkConnection(): void {
        this._log.debug('Check last received keep alive timestamp');
        try {
            const seconds = this.getSecondsSinceLastKeepAlive();
            if (seconds >= 0) {
                if (seconds > this._maxAllowedDistanceBetweenKeepAliveInSeconds) {
                    this._log.info(`Last received keep alive timestamp is older than ${this._maxAllowedDistanceBetweenKeepAliveInSeconds} seconds`);
                    this.handleWebSocketDisconnectedAsync(-1);
                } else {
                    this._log.debug(`Last received keep alive is ${seconds} seconds ago`);
                }
            }
        } catch (e) {
            this._log.error('Checking last received keep alive timestamp failed', e);
        }
    }

    private getSecondsSinceLastKeepAlive(): number {
        if (this._lastReceivedKeepAliveTimestamp) {
            const ms = Date.now() - this._lastReceivedKeepAliveTimestamp;
            return Math.floor(ms / 1000);
        }
        return -1;
    }
}