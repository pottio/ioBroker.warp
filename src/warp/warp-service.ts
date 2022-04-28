import { isArray, isObject } from '../lib/tools';
import { WarpAdapter } from '../main';
import { ContextLogger } from './../lib/context-logger';
import { WarpApiParameter, WarpApiSection, WarpMessage } from './models';
import { WarpApiDefinitions } from './warp-api-definitions';
import { WarpClient } from './warp-client';

export class WarpService {
    private readonly _objectInitPeriodInSeconds = 60;
    private readonly _adapter: WarpAdapter;
    private readonly _log: ContextLogger;
    private readonly _subscribedIds: string[] = [];
    private readonly _client: WarpClient;
    private _apiDefinitions!: WarpApiDefinitions;
    private _startInitTimestamp!: number;
    private _objectsInitPeriodIsActive = true;

    constructor(adapter: WarpAdapter) {
        this._adapter = adapter;
        this._log = new ContextLogger(adapter, WarpService.name)
        this._client = new WarpClient(adapter);
    }

    public async initAsync(versionBeforeUpdate: string): Promise<void> {
        this._log.info('Initializing');
        try {
            this._startInitTimestamp = Date.now();
            await this._client.initAsync();

            const metaInformation = await this._client.getMetaInformationForStartup();
            if (!metaInformation) {
                throw new Error('Unable to receive meta information from WARP. Please make sure firmware version >= 2.0.0 is installed on your WARP charger');
            }
            this._log.info(`Received information from ${metaInformation.displayType} (${metaInformation.name}) with firmware version ${metaInformation.firmwareVersion}`);

            this._log.info(`Generate API definitions for product '${metaInformation.product}'`);
            this._apiDefinitions = new WarpApiDefinitions(metaInformation.product);

            await this.deleteObjectsRemovedFromDefinitionsAfterAdapterUpdateAsync(versionBeforeUpdate);
            await this.initialCreateSectionsAndActionsAsync(metaInformation.product);

            await this._client.connectAsync();
            this._client.webSocketMessageEmitter.on('message', async (message: WarpMessage) => this.handleWarpMessageAsync(message));
        } catch (e) {
            this._log.error('Initializing failed', e)
        }
        this._log.info('Initialized');
    }

    public async terminateAsync(): Promise<void> {
        this._log.info('Terminating');
        for (const id of this._subscribedIds) {
            this._log.debug(`Unsubscribe state changes '${id}'`);
            await this._adapter.unsubscribeStatesAsync(id);
        }
        this._client.disconnect();
        this._log.info('Terminated');
    }

    public async handleStateChangedAsync(id: string, state: ioBroker.State): Promise<void> {
        if (state.ack === false) {
            this._log.info(`Handle changed state by user with id '${id}' to value '${state.val}'`);
            try {
                const section = this._apiDefinitions.getSectionByIdForProduct(id);
                const parameter = section?.parameters.find(param => id.endsWith(param.name));
                if (section && parameter && parameter.hasAction()) {
                    this._log.silly(`Definition for id: ${JSON.stringify(parameter)}`);
                    const payload = await this.transformPayloadAsync(state, section, parameter);
                    if (parameter.actionTopic) {
                        await this._client.sendMessageAsync({ topic: parameter.actionTopic, payload }, parameter.actionMethod ?? 'PUT');
                    } else {
                        this._log.warn(`Invalid action definition. WARP will not be notified about changed state`);
                    }
                } else {
                    this._log.warn(`No action definition found. WARP will not be notified about changed state`);
                }
            } catch (e) {
                this._log.error(`Handling changed state by user failed`, e);
            }
        }
    }

    private async transformPayloadAsync(state: ioBroker.State, section: WarpApiSection, parameter: WarpApiParameter): Promise<any> {
        return new Promise(async (resolve) => {
            switch (parameter.actionType) {
                case 'update-value':
                    resolve(JSON.parse(parameter.actionPayloadTemplate?.replace('#', this.toValueForPayload(state))));
                    break;
                case 'send-command':
                    resolve('null');
                    break;
                case 'update-config':
                    const payloadParameters = section.parameters.filter(param => param.actionTopic && param.actionTopic === parameter.actionTopic);
                    let payload = `{`;
                    for (const payloadParameter of payloadParameters) {
                        if (payloadParameter.name === parameter.name) {
                            payload += `"${payloadParameter.name}": ${this.toValueForPayload(state)},`;
                        } else {
                            const otherState = await this._adapter.getStateAsync(`${section.id}.${payloadParameter.name}`);
                            if (otherState) {
                                payload += `"${payloadParameter.name}": ${this.toValueForPayload(otherState)},`;
                            }
                        }
                    }
                    payload = payload.slice(0, -1);
                    payload += '}';
                    resolve(JSON.parse(payload));
                    break;
                case 'send-json':
                    resolve(JSON.parse(`${state.val}`));
                    break;
                default:
                    this._log.warn(`Api parameter action type '${parameter.actionType}' is unknown.`);
                    resolve(undefined);
            }
        });
    }

    private toValueForPayload(state: ioBroker.State): string {
        return typeof state.val === 'string' ? `"${state.val}"` : `${state.val}`;
    }

    private async handleWarpMessageAsync(message: WarpMessage): Promise<void> {
        this._log.debug(`Process new message from WARP charger with topic '${message.topic}'`);

        let section: WarpApiSection | undefined;
        let parameters: WarpApiParameter[] = [];
        if (this._objectsInitPeriodIsActive) {
            section = this._apiDefinitions.getSectionByTopicForProduct(message.topic);
            this._log.silly(`Definition for topic: ${section?.toString()}`);
            parameters = section ? section.parameters : [];
        }

        for (const property in message.payload) {
            if (this._objectsInitPeriodIsActive) {
                const parameter = parameters.find(param => param.name === property);
                if (section && parameter) {
                    this._log.debug(`Object init period active. Create object for parameter '${parameter.name}' in section '${section.id}'`)
                    await this.createObjectsForParameterAndSubscribeActionAsync(section, parameter);
                }
            }

            const sectionId = this.getSectionId(message);
            const state = message.payload[property];
            const id = `${sectionId}.${property}`;

            await this.setStateSafelyAsync(id, state);
            await this.handleArrayStatesIfNeededAsync(state, id);
        }

        if (this._objectsInitPeriodIsActive && this._startInitTimestamp) {
            const ms = Date.now() - this._startInitTimestamp;
            const seconds = Math.floor(ms / 1000);
            this._objectsInitPeriodIsActive = seconds < this._objectInitPeriodInSeconds;
            if (!this._objectsInitPeriodIsActive) this._log.info(`Object init period ended`);
        }
    }

    private async handleArrayStatesIfNeededAsync(state: any, id: string): Promise<void> {
        if (this._adapter.config.listBreakdownEnabled && isArray(state)) {
            const states = (<[]>state);
            for (let index = 0; index < states.length; index++) {
                await this.setStateSafelyAsync(`${id}.${index}`, states[index]);
            }
        }
    }

    private getSectionId = (message: WarpMessage): string => message.topic.replace(/\//g, '.');

    private async setStateSafelyAsync(id: string, state: any): Promise<void> {
        this._log.silly(`Set state for id: ${id}. State: '${state}'`);
        await this._adapter.setObjectNotExistsAsync(id, {
            type: 'state',
            common: { name: '', type: 'mixed', role: 'state', read: true, write: false },
            native: {},
        });
        if (isObject(state) || isArray(state)) {
            state = JSON.stringify(state);
        }
        await this._adapter.setStateAsync(id, state, true);
    }

    private async deleteObjectsRemovedFromDefinitionsAfterAdapterUpdateAsync(versionBeforeUpdate: string): Promise<void> {
        this._log.info('Migrate objects if adapter version changed since last adapter start');
        try {
            const lastMigratedAdapterVersion = this.semVerToNumber(versionBeforeUpdate);
            for (const migrationKey in this._apiDefinitions.deletedParameterIds) {
                const migrationVersion = this.semVerToNumber(migrationKey);
                if (lastMigratedAdapterVersion < migrationVersion) {
                    this._log.info(`Need migrating to '${migrationKey}'. Adapter version at last start: '${versionBeforeUpdate}'`);
                    for (const parameterId of this._apiDefinitions.deletedParameterIds[migrationKey]) {
                        this._log.debug(`Migration to '${migrationKey}': Definition was removed for '${parameterId}'. Delete object`);
                        await this._adapter.delObjectAsync(parameterId, { recursive: true });
                    }
                }
            }
        } catch (e) {
            this._log.error('Migrate objects failed', e)
        }
    }

    private semVerToNumber(version: string): number {
        return +version.replace(/\./g, '')
    }

    private async initialCreateSectionsAndActionsAsync(product: string): Promise<void> {
        this._log.info(`Create if not exists or override all sections and actions for product '${product}'`);
        try {
            for (const section of this._apiDefinitions.getAllSectionsForProduct()) {
                await this.createObjectsForSectionAsync(section);
                for (const parameter of section.parameters) {
                    if (parameter.isRelevantFor(product) && parameter.hasAction()) {
                        await this.createObjectsForParameterAndSubscribeActionAsync(section, parameter);
                    }
                }
            }
        } catch (e) {
            this._log.error('Creating or overriding sections and actions failed', e)
        }
    }

    private async createObjectsForSectionAsync(section: WarpApiSection): Promise<void> {
        if (!section.api.preventCreating) {
            this._log.debug(`Create or override device '${section.api.id}'`);
            await this._adapter.setObjectAsync(section.api.id, {
                type: 'device',
                common: { name: section.api.description },
                native: {},
            });
        }
        this._log.debug(`Create or override channel '${section.id}'`);
        await this._adapter.setObjectAsync(section.id, {
            type: 'channel',
            common: { name: section.description },
            native: {},
        });
    }

    private async createObjectsForParameterAndSubscribeActionAsync(section: WarpApiSection, parameter: WarpApiParameter, sectionId?: string): Promise<void> {
        const parameterId = `${sectionId ? sectionId : section.id}.${parameter.name}`;
        const obj: ioBroker.SettableObject = { type: 'state', common: { name: parameter.description, role: '', read: parameter.read, write: parameter.hasAction() }, native: {} };
        switch (parameter.type) {
            case 'list':
                obj.common.type = 'array';
                obj.common.role = 'list';
                break;
            case 'enum':
                obj.common.type = 'number';
                obj.common.role = 'value';
                obj.common.states = parameter.enumValues;
                obj.common.unit = parameter.unit;
                break;
            case 'number':
                obj.common.type = 'number';
                obj.common.role = 'value';
                obj.common.states = parameter.enumValues;
                obj.common.unit = parameter.unit;
                obj.common.min = parameter.min;
                obj.common.max = parameter.max;
                break;
            case 'bool':
                obj.common.type = 'boolean';
                obj.common.role = 'indicator';
                break;
            case 'button':
                obj.common.read = false;
                obj.common.type = 'boolean';
                obj.common.role = 'button';
                if (parameter.buttonType === 'start') obj.common.role = 'button.start';
                if (parameter.buttonType === 'stop') obj.common.role = 'button.stop';
                break;
            case 'json':
                obj.common.type = 'object';
                obj.common.role = 'state';
                break;
            case 'text':
                obj.common.type = 'string';
                obj.common.role = 'text';
                break;
            default:
                this._log.warn(`Api definition type '${parameter.type}' is unknown.`);
        }

        this._log.debug(`Create or override state '${parameterId}'`);
        await this._adapter.setObjectAsync(parameterId, obj);

        if (parameter.hasAction()) {
            this._log.debug(`Subscribe state changes '${parameterId}'`);
            await this._adapter.subscribeStatesAsync(parameterId);
            this._subscribedIds.push(parameterId);
        }
    }
}
