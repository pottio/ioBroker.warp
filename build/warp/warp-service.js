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
    this._objectInitPeriodInSeconds = 60;
    this._subscribedIds = [];
    this._objectsInitPeriodIsActive = true;
    this.getSectionId = (message) => message.topic.replace(/\//g, ".");
    this._adapter = adapter;
    this._log = new import_context_logger.ContextLogger(adapter, WarpService.name);
    this._client = new import_warp_client.WarpClient(adapter);
  }
  async initAsync(versionBeforeUpdate) {
    this._log.info("Initializing");
    try {
      this._startInitTimestamp = Date.now();
      await this._client.initAsync();
      const metaInformation = await this._client.getMetaInformationForStartup();
      if (!metaInformation) {
        throw new Error("Unable to receive meta information from WARP. Please make sure firmware version >= 2.0.0 is installed on your WARP charger");
      }
      this._log.info(`Received information from ${metaInformation.displayType} (${metaInformation.name}) with firmware version ${metaInformation.firmwareVersion}`);
      this._log.info(`Generate API definitions for product '${metaInformation.product}'`);
      this._apiDefinitions = new import_warp_api_definitions.WarpApiDefinitions(metaInformation.product);
      await this.deleteObjectsRemovedFromDefinitionsAfterAdapterUpdateAsync(versionBeforeUpdate);
      await this.initialCreateSectionsAndActionsAsync(metaInformation.product);
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
        const section = this._apiDefinitions.getSectionByIdForProduct(id);
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
        case "send-json":
          resolve(JSON.parse(`${state.val}`));
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
    this._log.debug(`Process new message from WARP charger with topic '${message.topic}'`);
    let section;
    let parameters = [];
    if (this._objectsInitPeriodIsActive) {
      section = this._apiDefinitions.getSectionByTopicForProduct(message.topic);
      this._log.silly(`Definition for topic: ${section == null ? void 0 : section.toString()}`);
      parameters = section ? section.parameters : [];
    }
    for (const property in message.payload) {
      if (this._objectsInitPeriodIsActive) {
        const parameter = parameters.find((param) => param.name === property);
        if (section && parameter) {
          this._log.debug(`Object init period active. Create object for parameter '${parameter.name}' in section '${section.id}'`);
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
      const seconds = Math.floor(ms / 1e3);
      this._objectsInitPeriodIsActive = seconds < this._objectInitPeriodInSeconds;
    }
  }
  async handleArrayStatesIfNeededAsync(state, id) {
    if (this._adapter.config.listBreakdownEnabled && (0, import_tools.isArray)(state)) {
      const states = state;
      for (let index = 0; index < states.length; index++) {
        await this.setStateSafelyAsync(`${id}.${index}`, states[index]);
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
  async deleteObjectsRemovedFromDefinitionsAfterAdapterUpdateAsync(versionBeforeUpdate) {
    this._log.info("Migrate objects if adapter version changed since last adapter start");
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
      this._log.error("Migrate objects failed", e);
    }
  }
  semVerToNumber(version) {
    return +version.replace(/\./g, "");
  }
  async initialCreateSectionsAndActionsAsync(product) {
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
      this._log.error("Creating or overriding sections and actions failed", e);
    }
  }
  async createObjectsForSectionAsync(section) {
    if (!section.api.preventCreating) {
      this._log.debug(`Create or override device '${section.api.id}'`);
      await this._adapter.setObjectAsync(section.api.id, {
        type: "device",
        common: { name: section.api.description },
        native: {}
      });
    }
    this._log.debug(`Create or override channel '${section.id}'`);
    await this._adapter.setObjectAsync(section.id, {
      type: "channel",
      common: { name: section.description },
      native: {}
    });
  }
  async createObjectsForParameterAndSubscribeActionAsync(section, parameter, sectionId) {
    const parameterId = `${sectionId ? sectionId : section.id}.${parameter.name}`;
    const obj = { type: "state", common: { name: parameter.description, role: "", read: parameter.read, write: parameter.hasAction() }, native: {} };
    switch (parameter.type) {
      case "list":
        obj.common.type = "array";
        obj.common.role = "list";
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
    this._log.debug(`Create or override state '${parameterId}'`);
    await this._adapter.setObjectAsync(parameterId, obj);
    if (parameter.hasAction()) {
      this._log.debug(`Subscribe state changes '${parameterId}'`);
      await this._adapter.subscribeStatesAsync(parameterId);
      this._subscribedIds.push(parameterId);
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WarpService
});
//# sourceMappingURL=warp-service.js.map
