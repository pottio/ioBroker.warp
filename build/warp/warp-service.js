var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var warp_service_exports = {};
__export(warp_service_exports, {
  WarpService: () => WarpService
});
module.exports = __toCommonJS(warp_service_exports);
var import_tools = require("../lib/tools");
var import_context_logger = require("./../lib/context-logger");
var import_warp_api_definitions = require("./warp-api-definitions");
var import_warp_client = require("./warp-client");
class WarpService {
  constructor(adapter) {
    this._subscribedIds = [];
    this.getSectionId = (message) => message.topic.replace(/\//g, ".");
    this._adapter = adapter;
    this._log = new import_context_logger.ContextLogger(adapter, WarpService.name);
    this._client = new import_warp_client.WarpClient(adapter);
  }
  async initAsync(configurationChanged, versionBeforeUpdate) {
    this._log.info("Initializing");
    try {
      this._log.info(`Generate API definitions for product '${this._adapter.config.product}' and model '${this._adapter.config.model}'`);
      this._apiDefinitions = new import_warp_api_definitions.WarpApiDefinitions(this._adapter.config.product, this._adapter.config.model);
      if (configurationChanged) {
        await this.deleteAllObjectsWithSpecificProductOrModelDefinitionAsync();
      }
      const parameterIdsForOverride = await this.deleteObjectsRemovedFromDefinitionsAfterAdapterUpdateAsync(versionBeforeUpdate);
      await this.initialCreateOrOverrideAllObjectsAsync(parameterIdsForOverride);
      await this._client.connectAsync();
      this._client.webSocketMessageEmitter.on("message", async (message) => this.handleWarpMessageAsync(message));
    } catch (e) {
      this._log.error("Initializing failed", e);
    }
    this._log.info("Initialized");
  }
  async terminateAsync() {
    this._log.info("Terminating");
    for (const id of this._subscribedIds) {
      this._log.debug(`Unsubscribe state changes '${id}'`);
      await this._adapter.unsubscribeStatesAsync(id);
    }
    this._client.disconnect();
    this._log.info("Terminated");
  }
  async handleStateChangedAsync(id, state) {
    var _a;
    if (state.ack === false) {
      this._log.info(`Handle changed state by user with id '${id}' to value '${state.val}'`);
      try {
        const section = this._apiDefinitions.getSectionByIdForConfig(id);
        const parameter = section == null ? void 0 : section.parameters.find((param) => id.endsWith(param.name));
        if (section && parameter && parameter.hasAction()) {
          this._log.silly(`Definition for id: ${JSON.stringify(parameter)}`);
          const payload = await this.transformPayloadAsync(state, section, parameter);
          if (parameter.actionTopic) {
            await this._client.sendMessageAsync({ topic: parameter.actionTopic, payload }, (_a = parameter.actionMethod) != null ? _a : "PUT");
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
  async transformPayloadAsync(state, section, parameter) {
    return new Promise(async (resolve) => {
      var _a;
      switch (parameter.actionType) {
        case "update-value":
          resolve(JSON.parse((_a = parameter.actionPayloadTemplate) == null ? void 0 : _a.replace("#", this.toValueForPayload(state))));
          break;
        case "send-command":
          resolve(parameter.actionPayloadTemplate ? JSON.parse(parameter.actionPayloadTemplate) : null);
          break;
        case "update-config":
          const payloadParameters = section.parameters.filter((param) => param.actionTopic && param.actionTopic === parameter.actionTopic);
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
          payload += "}";
          resolve(JSON.parse(payload));
          break;
        default:
          this._log.warn(`Api parameter action type '${parameter.actionType}' is unknown.`);
          resolve(void 0);
      }
    });
  }
  toValueForPayload(state) {
    return typeof state.val === "string" ? `"${state.val}"` : `${state.val}`;
  }
  async handleWarpMessageAsync(message) {
    var _a, _b, _c;
    this._log.debug(`Process new message from WARP charger with topic '${message.topic}'`);
    const section = this._apiDefinitions.getSectionByTopicForConfig(message.topic);
    const parameters = section ? section.parameters : [];
    this._log.silly(`Definition for topic: ${section == null ? void 0 : section.toString()}`);
    if ((0, import_tools.isArray)(message.payload) && parameters.length === 1 && ((_a = parameters[0].listItems) == null ? void 0 : _a.length) === ((_b = message.payload) == null ? void 0 : _b.length)) {
      for (let index = 0; index < parameters[0].listItems.length; index++) {
        await this.setStateSafelyAsync(`${this.getSectionId(message)}.${parameters[0].name}.${parameters[0].listItems[index].name}`, message.payload[index]);
      }
    } else {
      for (const property in message.payload) {
        const sectionId = this.getSectionId(message);
        const state = message.payload[property];
        const parameter = parameters.find((param) => param.name === property);
        if (parameter && parameter.type === "list") {
          if ((0, import_tools.isArray)(state) && ((_c = parameter.listItems) == null ? void 0 : _c.length) === (state == null ? void 0 : state.length)) {
            for (let index = 0; index < parameter.listItems.length; index++) {
              await this.setStateSafelyAsync(`${sectionId}.${parameter.name}.${parameter.listItems[index].name}`, state[index]);
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
  async setStateSafelyAsync(id, state) {
    this._log.silly(`Set state for id: ${id}. State: '${state}'`);
    await this._adapter.setObjectNotExistsAsync(id, {
      type: "state",
      common: { name: "", type: "mixed", role: "state", read: true, write: false },
      native: {}
    });
    if ((0, import_tools.isObject)(state) || (0, import_tools.isArray)(state)) {
      state = JSON.stringify(state);
    }
    await this._adapter.setStateAsync(id, state, true);
  }
  async deleteAllObjectsWithSpecificProductOrModelDefinitionAsync() {
    this._log.info("Product or model configuration changed since last adapter start. Delete all objects with specific API definitions for product or model");
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
      this._log.error("Delete all objects with specific API definitions failed", e);
    }
  }
  async deleteObjectsRemovedFromDefinitionsAfterAdapterUpdateAsync(versionBeforeUpdate) {
    this._log.info("Migrate objects if adapter version changed since last adapter start");
    let parameterIdsForOverride = [];
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
      this._log.error("Migrate objects failed", e);
    }
    return parameterIdsForOverride;
  }
  semVerToNumber(version) {
    return +version.replace(/\./g, "");
  }
  async initialCreateOrOverrideAllObjectsAsync(parameterIdsForOverride) {
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
      this._log.error("Creating or overriding objects failed", e);
    }
  }
  async createObjectsForSectionIfNotExistsAsync(section) {
    if (!section.api.preventCreating) {
      this._log.debug(`Create device '${section.api.id}'`);
      await this._adapter.setObjectNotExistsAsync(section.api.id, {
        type: "device",
        common: { name: section.api.description },
        native: {}
      });
    }
    this._log.debug(`Create channel '${section.id}'`);
    await this._adapter.setObjectNotExistsAsync(section.id, {
      type: "channel",
      common: { name: section.description },
      native: {}
    });
  }
  async createObjectsForParameterAndSubscribeActionAsync(section, parameter, parameterIdsForOverride, sectionId) {
    var _a;
    const parameterId = `${sectionId ? sectionId : section.id}.${parameter.name}`;
    let obj = { type: "state", common: { name: parameter.description, role: "", read: true, write: parameter.hasAction() }, native: {} };
    switch (parameter.type) {
      case "list":
        obj = { type: "channel", common: { name: parameter.description }, native: {} };
        break;
      case "enum":
        obj.common.type = "number";
        obj.common.role = "value";
        obj.common.states = parameter.enumValues;
        obj.common.unit = parameter.unit;
        break;
      case "number":
        obj.common.type = "number";
        obj.common.role = "value";
        obj.common.states = parameter.enumValues;
        obj.common.unit = parameter.unit;
        obj.common.min = parameter.min;
        obj.common.max = parameter.max;
        break;
      case "bool":
        obj.common.type = "boolean";
        obj.common.role = "indicator";
        break;
      case "button":
        obj.common.read = false;
        obj.common.type = "boolean";
        obj.common.role = "button";
        if (parameter.buttonType === "start")
          obj.common.role = "button.start";
        if (parameter.buttonType === "stop")
          obj.common.role = "button.stop";
        break;
      case "json":
        obj.common.type = "object";
        obj.common.role = "state";
        break;
      case "text":
        obj.common.type = "string";
        obj.common.role = "text";
        break;
      default:
        this._log.warn(`Api definition type '${parameter.type}' is unknown.`);
    }
    if (parameterIdsForOverride.some((paramId) => paramId === parameterId)) {
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
    if (parameter.type === "list") {
      const childDefinitions = (_a = parameter.listItems) != null ? _a : [];
      for (const childDefinition of childDefinitions) {
        await this.createObjectsForParameterAndSubscribeActionAsync(section, childDefinition, parameterIdsForOverride, parameterId);
      }
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WarpService
});
//# sourceMappingURL=warp-service.js.map
