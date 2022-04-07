var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var main_exports = {};
__export(main_exports, {
  WarpAdapter: () => WarpAdapter
});
module.exports = __toCommonJS(main_exports);
var utils = __toESM(require("@iobroker/adapter-core"));
var import_context_logger = require("./lib/context-logger");
var import_warp_service = require("./warp/warp-service");
var import_crypto = require("./lib/crypto");
class WarpAdapter extends utils.Adapter {
  constructor(options = {}) {
    super(__spreadProps(__spreadValues({}, options), {
      name: "warp"
    }));
    this._log = new import_context_logger.ContextLogger(this, "Main");
    this._warpService = new import_warp_service.WarpService(this);
    this.on("ready", this.onReadyAsync.bind(this));
    this.on("stateChange", this.onStateChangeAsync.bind(this));
    this.on("unload", this.onUnloadAsync.bind(this));
  }
  async onReadyAsync() {
    var _a;
    this._log.info("Start initializing WARP adapter");
    try {
      await this.setStateAsync("info.connection", false, true);
      if (this.config.authEnabled) {
        this._log.debug("Auth enabled. Decrypt password");
        this.config.password = await import_crypto.Encryption.decrypt(this, this.config.password);
      }
      const version = await this.getStateAsync("info.version");
      this._log.debug(`Adapter version on last adapter execution: '${version == null ? void 0 : version.val}'`);
      await this._warpService.initAsync((_a = version == null ? void 0 : version.val) != null ? _a : "0.0.0");
      await this.setStateAsync("info.version", this.version, true);
    } catch (e) {
      this._log.error("Initializing failed", e);
    }
    this._log.info("WARP adapter initialized");
  }
  async onUnloadAsync(callback) {
    try {
      this._log.info("Shutting down WARP adapter");
      await this._warpService.terminateAsync();
      callback();
    } catch (e) {
      callback();
    }
  }
  async onStateChangeAsync(id, state) {
    if (state) {
      this._warpService.handleStateChangedAsync(id, state);
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new WarpAdapter(options);
} else {
  (() => new WarpAdapter())();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WarpAdapter
});
//# sourceMappingURL=main.js.map
