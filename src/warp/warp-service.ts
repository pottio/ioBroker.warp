import { isArray, isObject } from '../lib/tools';
import { WarpAdapter } from '../main';
import { ContextLogger } from './../lib/context-logger';
import { WarpApiParameter, WarpApiSection, WarpMessage } from './models';
import { WarpApiDefinitions } from './warp-api-definitions';
import { WarpClient } from './warp-client';

export class WarpService {
    private readonly _adapter: WarpAdapter;
    private readonly _log: ContextLogger;
    private readonly _subscribedIds: string[] = [];
    private readonly _client: WarpClient;
    private _apiDefinitions!: WarpApiDefinitions;

    constructor(adapter: WarpAdapter) {
        this._adapter = adapter;
        this._log = new ContextLogger(adapter, WarpService.name)
        this._client = new WarpClient(adapter);
    }

    public async initAsync(configurationChanged: boolean, versionBeforeUpdate: string): Promise<void> {
        this._log.info('Initializing');
        try {
            this._log.info(`Generate API definitions for product '${this._adapter.config.product}' and model '${this._adapter.config.model}'`);
            this._apiDefinitions = new WarpApiDefinitions(this._adapter.config.product, this._adapter.config.model);
            if (configurationChanged) {
                await this.deleteAllObjectsWithSpecificProductOrModelDefinitionAsync();
            }
            const parameterIdsForOverride = await this.deleteObjectsRemovedFromDefinitionsAfterAdapterUpdateAsync(versionBeforeUpdate);
            await this.initialCreateOrOverrideAllObjectsAsync(parameterIdsForOverride);
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
                const section = this._apiDefinitions.getSectionByIdForConfig(id);
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
                    resolve(parameter.actionPayloadTemplate ? JSON.parse(parameter.actionPayloadTemplate) : null);
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
        const section = this._apiDefinitions.getSectionByTopicForConfig(message.topic);
        const parameters = section ? section.parameters : [];
        this._log.silly(`Definition for topic: ${section?.toString()}`);
        if (isArray(message.payload) && parameters.length === 1 && parameters[0].listItems?.length === (<[]>message.payload)?.length) {
            for (let index = 0; index < parameters[0].listItems.length; index++) {
                await this.setStateSafelyAsync(`${this.getSectionId(message)}.${parameters[0].name}.${parameters[0].listItems[index].name}`, (<[]>message.payload)[index]);
            }
        } else {
            for (const property in message.payload) {
                const sectionId = this.getSectionId(message);
                const state = message.payload[property];
                const parameter = parameters.find(param => param.name === property);
                if (parameter && parameter.type === 'list') {
                    if (isArray(state) && parameter.listItems?.length === (<[]>state)?.length) {
                        for (let index = 0; index < parameter.listItems.length; index++) {
                            await this.setStateSafelyAsync(`${sectionId}.${parameter.name}.${parameter.listItems[index].name}`, (<[]>state)[index]);
                        }
                    } else {
                        const id = `${sectionId}.${property}.payload`;
                        await this.setStateSafelyAsync(id, state);
                    }
                } else {
                    const id = `${sectionId}.${property}`;
                    await this.setStateSafelyAsync(id, state);
                }
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


    private async deleteAllObjectsWithSpecificProductOrModelDefinitionAsync(): Promise<void> {
        this._log.info('Product or model configuration changed since last adapter start. Delete all objects with specific API definitions for product or model');
        try {
            for (const section of this._apiDefinitions.getAllSections()) {
                const parametersForSpecificProductOrModel = section.filterSpecificParameters();
                if (parametersForSpecificProductOrModel.length === section.parameters.length && section.parameters.length !== 0) {
                    this._log.debug(`All parameter definitions inside section definition are specific. Delete object with id '${section.id}'`);
                    await this._adapter.delObjectAsync(section.id, { recursive: true });
                } else {
                    for (const parameter of parametersForSpecificProductOrModel) {
                        const objectIdForDeletion = `${section.id}.${parameter.name}`;
                        this._log.debug(`Parameter definition inside section '${section.id}' is specific. Delete object with id '${objectIdForDeletion}'`);
                        await this._adapter.delObjectAsync(`${objectIdForDeletion}`, { recursive: true });
                    }
                }
            }
        } catch (e) {
            this._log.error('Delete all objects with specific API definitions failed', e)
        }
    }

    private async deleteObjectsRemovedFromDefinitionsAfterAdapterUpdateAsync(versionBeforeUpdate: string): Promise<string[]> {
        this._log.info('Migrate objects if adapter version changed since last adapter start');
        let parameterIdsForOverride: string[] = [];
        try {
            const lastMigratedAdapterVersion = this.semVerToNumber(versionBeforeUpdate);
            for (const migrationKey in this._apiDefinitions.migrations) {
                const migrationVersion = this.semVerToNumber(migrationKey);
                if (lastMigratedAdapterVersion < migrationVersion) {
                    this._log.info(`Need migrating to '${migrationKey}'. Adapter version at last start: '${versionBeforeUpdate}'`);
                    const migration = this._apiDefinitions.migrations[migrationKey];
                    for (const parameterId of migration.deletedParameterIds) {
                        this._log.debug(`Migration to '${migrationKey}': Definition was removed for '${parameterId}'. Delete object`);
                        await this._adapter.delObjectAsync(parameterId, { recursive: true });
                    }
                    this._log.debug(`Migration to '${migrationKey}': Need override objects with changed definitions: '${migration.changedParameterIds.toString()}'`);
                    parameterIdsForOverride = [...parameterIdsForOverride, ...migration.changedParameterIds];
                }
            }
        } catch (e) {
            this._log.error('Migrate objects failed', e)
        }
        return parameterIdsForOverride;
    }

    private semVerToNumber(version: string): number {
        return +version.replace(/\./g, '')
    }

    private async initialCreateOrOverrideAllObjectsAsync(parameterIdsForOverride: string[]): Promise<void> {
        this._log.info(`Create if not exists or override all objects for product '${this._adapter.config.product}' and model '${this._adapter.config.model}'`);
        try {
            for (const section of this._apiDefinitions.getAllSectionsForConfig()) {
                await this.createObjectsForSectionIfNotExistsAsync(section);
                for (const parameter of section.parameters) {
                    if (parameter.isRelevantFor(this._adapter.config.product, this._adapter.config.model)) {
                        await this.createObjectsForParameterAndSubscribeActionAsync(section, parameter, parameterIdsForOverride);
                    }
                }
            }
        } catch (e) {
            this._log.error('Creating or overriding objects failed', e)
        }
    }

    private async createObjectsForSectionIfNotExistsAsync(section: WarpApiSection): Promise<void> {
        if (!section.api.preventCreating) {
            this._log.debug(`Create device '${section.api.id}'`);
            await this._adapter.setObjectNotExistsAsync(section.api.id, {
                type: 'device',
                common: { name: section.api.description },
                native: {},
            });
        }
        this._log.debug(`Create channel '${section.id}'`);
        await this._adapter.setObjectNotExistsAsync(section.id, {
            type: 'channel',
            common: { name: section.description },
            native: {},
        });
    }

    private async createObjectsForParameterAndSubscribeActionAsync(section: WarpApiSection, parameter: WarpApiParameter, parameterIdsForOverride: string[], sectionId?: string): Promise<void> {
        const parameterId = `${sectionId ? sectionId : section.id}.${parameter.name}`;
        let obj: ioBroker.SettableObject = { type: 'state', common: { name: parameter.description, role: '', read: true, write: parameter.hasAction() }, native: {} };
        switch (parameter.type) {
            case 'list':
                obj = { type: 'channel', common: { name: parameter.description }, native: {} };
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

        if (parameterIdsForOverride.some(paramId => paramId === parameterId)) {
            this._log.debug(`Override state '${parameterId}'`);
            await this._adapter.setObjectAsync(parameterId, obj);
        } else {
            this._log.debug(`Create state if not exists '${parameterId}'`);
            await this._adapter.setObjectNotExistsAsync(parameterId, obj);
        }

        if (parameter.hasAction()) {
            this._log.debug(`Subscribe state changes '${parameterId}'`);
            await this._adapter.subscribeStatesAsync(parameterId);
            this._subscribedIds.push(parameterId);
        }

        if (parameter.type === 'list') {
            const childDefinitions = parameter.listItems ?? [];
            for (const childDefinition of childDefinitions) {
                await this.createObjectsForParameterAndSubscribeActionAsync(section, childDefinition, parameterIdsForOverride, parameterId);
            }
        }
    }
}

