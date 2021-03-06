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
var models_exports = {};
__export(models_exports, {
  Param: () => Param,
  WarpApi: () => WarpApi,
  WarpApiParameter: () => WarpApiParameter,
  WarpApiParameterBuilder: () => WarpApiParameterBuilder,
  WarpApiSection: () => WarpApiSection,
  WarpProduct: () => WarpProduct
});
module.exports = __toCommonJS(models_exports);
const _WarpProduct = class {
};
let WarpProduct = _WarpProduct;
WarpProduct.warp1 = "warp1";
WarpProduct.warp2 = "warp2";
WarpProduct.all = [_WarpProduct.warp1, _WarpProduct.warp2];
class WarpApi {
  constructor(id, description, preventCreating = false) {
    this.id = id;
    this.description = description;
    this.sections = [];
    this.preventCreating = preventCreating;
  }
  add(topic, description, parameters) {
    this.sections.push(new WarpApiSection(this, topic, description, parameters));
  }
}
class WarpApiSection {
  constructor(api, topic, description, parameters) {
    this.api = api;
    this.topic = topic;
    this.description = description;
    this.parameters = parameters;
  }
  hasParametersFor(product) {
    return this.parameters.some((param) => param.isRelevantFor(product));
  }
  filterSpecificParameters() {
    return this.parameters.filter((param) => param.relevantForProducts !== WarpProduct.all);
  }
  get id() {
    return this.topic.replace("/", ".");
  }
  toString() {
    return `id=${this.id} | parameters=${JSON.stringify(this.parameters)}`;
  }
}
class WarpApiParameter {
  constructor(name, type) {
    this.name = name;
    this.description = "";
    this.type = type;
    this.read = true;
    this.relevantForProducts = WarpProduct.all;
  }
  isRelevantFor(product) {
    return this.relevantForProducts.some((prod) => prod === product);
  }
  hasActionType(actionType) {
    return this.actionType === actionType;
  }
  hasAction() {
    return this.actionType !== void 0;
  }
}
class WarpApiParameterBuilder {
  constructor(arpApiParameter) {
    this._warpApiParameter = arpApiParameter;
  }
  withDescription(description) {
    this._warpApiParameter.description = description;
    return this;
  }
  onlyWarp1() {
    this._warpApiParameter.relevantForProducts = [WarpProduct.warp1];
    return this;
  }
  onlyWarp2() {
    this._warpApiParameter.relevantForProducts = [WarpProduct.warp2];
    return this;
  }
  actionUpdateValue(topic, payloadTemplate) {
    this._warpApiParameter.actionTopic = topic;
    this._warpApiParameter.actionType = "update-value";
    this._warpApiParameter.actionPayloadTemplate = payloadTemplate;
    return this;
  }
  actionSendCommand(topic) {
    this._warpApiParameter.actionTopic = topic;
    this._warpApiParameter.actionType = "send-command";
    this._warpApiParameter.actionMethod = "PUT";
    this._warpApiParameter.actionPayloadTemplate = null;
    return this;
  }
  actionUpdateConfig(topic) {
    this._warpApiParameter.actionTopic = topic;
    this._warpApiParameter.actionType = "update-config";
    return this;
  }
  actionSendJson(topic) {
    this._warpApiParameter.actionTopic = topic;
    this._warpApiParameter.actionType = "send-json";
    this._warpApiParameter.actionMethod = "PUT";
    return this;
  }
  noRead() {
    this._warpApiParameter.read = false;
    return this;
  }
  build() {
    return this._warpApiParameter;
  }
}
class Param {
  static bool(name) {
    const boolParam = new WarpApiParameter(name, "bool");
    return new WarpApiParameterBuilder(boolParam);
  }
  static butt(name, buttonType = "normal") {
    const buttonParam = new WarpApiParameter(name, "button");
    buttonParam.buttonType = buttonType;
    return new WarpApiParameterBuilder(buttonParam);
  }
  static enum(name, enumValues) {
    const enumParam = new WarpApiParameter(name, "enum");
    enumParam.enumValues = enumValues;
    return new WarpApiParameterBuilder(enumParam);
  }
  static list(name, type) {
    const listParam = new WarpApiParameter(name, "list");
    listParam.listType = type;
    return new WarpApiParameterBuilder(listParam);
  }
  static numb(name, unit, min, max) {
    const numberParam = new WarpApiParameter(name, "number");
    numberParam.unit = unit;
    numberParam.min = min;
    numberParam.max = max;
    return new WarpApiParameterBuilder(numberParam);
  }
  static json(name) {
    const jsonParam = new WarpApiParameter(name, "json");
    return new WarpApiParameterBuilder(jsonParam);
  }
  static text(name) {
    const textParam = new WarpApiParameter(name, "text");
    return new WarpApiParameterBuilder(textParam);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Param,
  WarpApi,
  WarpApiParameter,
  WarpApiParameterBuilder,
  WarpApiSection,
  WarpProduct
});
//# sourceMappingURL=models.js.map
