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
var context_logger_exports = {};
__export(context_logger_exports, {
  ContextLogger: () => ContextLogger
});
module.exports = __toCommonJS(context_logger_exports);
class ContextLogger {
  constructor(adapter, context) {
    this.silly = (message) => this._adapter.log.silly(this.toContextMessage(message));
    this.debug = (message) => this._adapter.log.debug(this.toContextMessage(message));
    this.info = (message) => this._adapter.log.info(this.toContextMessage(message));
    this.warn = (message) => this._adapter.log.warn(this.toContextMessage(message));
    this.error = (message, e) => {
      let logMessage = this.toContextMessage(message);
      if (e)
        logMessage += ` | Error=${e}`;
      this._adapter.log.error(logMessage);
    };
    this.toContextMessage = (message) => {
      return `[${this._context}] ${message}`;
    };
    this._adapter = adapter;
    this._context = context;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ContextLogger
});
//# sourceMappingURL=context-logger.js.map
