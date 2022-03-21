var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var warp_client_exports = {};
__export(warp_client_exports, {
  WarpClient: () => WarpClient
});
module.exports = __toCommonJS(warp_client_exports);
var axios = __toESM(require("axios"));
var crypto = __toESM(require("crypto"));
var import_events = require("events");
var import_ws = __toESM(require("ws"));
var import_context_logger = require("./../lib/context-logger");
class WarpClient {
  constructor(adapter) {
    this._reconnectTimeoutInSeconds = 60;
    this._messageEncoding = "utf-8";
    this._nonceCount = 1;
    this._successfulInitialConnection = false;
    this._adapterIsShuttingDown = false;
    this.webSocketMessageEmitter = new import_events.EventEmitter();
    this._adapter = adapter;
    this._log = new import_context_logger.ContextLogger(adapter, WarpClient.name);
  }
  async connectAsync() {
    this._log.info("Try connecting to WARP charger");
    try {
      const warpClient = this;
      if (this._reconnectTimeout)
        clearTimeout(this._reconnectTimeout);
      this._apiBasePath = `http${this._adapter.config.secureConnection ? "s" : ""}://${this._adapter.config.ip}`;
      this._webSocketBasePath = `ws${this._adapter.config.secureConnection ? "s" : ""}://${this._adapter.config.ip}`;
      this._log.debug(`WARP charger api base path: '${this._apiBasePath}'. Websocket base path: '${this._webSocketBasePath}'`);
      if (this._ws)
        this._ws.close();
      const path = "/ws";
      const authorizationToken = await this.getAuthorizationTokenAsync(path, "GET");
      this._ws = new import_ws.default(`${this._webSocketBasePath}${path}`, authorizationToken ? { headers: { "authorization": authorizationToken } } : void 0);
      this._ws.on("open", () => warpClient.handleWebSocketConnectedAsync());
      this._ws.on("message", (data) => warpClient.handleWebSocketMessageAsync(data));
      this._ws.on("error", (data) => warpClient.handleWebSocketErrorAsync(data));
      this._ws.on("close", (data) => warpClient.handleWebSocketDisconnectedAsync(data));
    } catch (e) {
      this._log.error("Connecting to WARP charger failed", e);
    }
  }
  disconnect() {
    if (this._reconnectTimeout)
      clearTimeout(this._reconnectTimeout);
    this._adapterIsShuttingDown = true;
    if (this._ws) {
      this._log.info("Disconnecting from WARP charger");
      this._ws.close();
    }
  }
  async sendMessageAsync(message) {
    this._log.info("Send message to WARP charger");
    this._log.silly("Message: " + JSON.stringify(message));
    try {
      const path = `/${message.topic}`;
      const authorizationToken = await this.getAuthorizationTokenAsync(path, "PUT");
      const headers = authorizationToken ? { Accept: "application/json", Authorization: authorizationToken } : { Accept: "application/json" };
      await axios.default({
        headers,
        method: "PUT",
        url: `${this._apiBasePath}${path}`,
        data: message.payload
      });
    } catch (e) {
      this._log.error("Sending message to WARP charger failed", e);
    }
  }
  async getAuthorizationTokenAsync(path, method) {
    var _a;
    if (!this._adapter.config.authEnabled)
      return void 0;
    this._log.debug("Check credentials and authorize if needed");
    try {
      await axios.default({
        headers: { Accept: "application/json" },
        method: "GET",
        url: `${this._apiBasePath}/credential_check`
      });
      this._log.debug("No credentials needed");
      return void 0;
    } catch (resp1) {
      if (resp1.response === void 0 || resp1.response.status !== 401 || !((_a = resp1.response.headers["www-authenticate"]) == null ? void 0 : _a.includes("nonce"))) {
        this._log.error("Need credentials, but no authorization possible", JSON.stringify(resp1));
      }
      this._log.debug("Need credentials. Authorize with digest access authentication");
      const authDetails = resp1.response.headers["www-authenticate"].split(",").map((v) => v.split("="));
      const nonceCount = ("00000000" + this._nonceCount++).slice(-8);
      const cnonce = crypto.randomBytes(24).toString("hex");
      const realm = authDetails.find((el) => el[0].toLowerCase().indexOf("realm") > -1)[1].replace(/"/g, "");
      const nonce = authDetails.find((el) => el[0].toLowerCase().indexOf("nonce") > -1)[1].replace(/"/g, "");
      const ha1 = crypto.createHash("md5").update(`${this._adapter.config.user}:${realm}:${this._adapter.config.password}`).digest("hex");
      const ha2 = crypto.createHash("md5").update(`${method}:${path}`).digest("hex");
      const response = crypto.createHash("md5").update(`${ha1}:${nonce}:${nonceCount}:${cnonce}:auth:${ha2}`).digest("hex");
      const authorization = `Digest username="${this._adapter.config.user}",realm="${realm}",nonce="${nonce}",uri="${path}",qop="auth",algorithm="MD5",response="${response}",nc="${nonceCount}",cnonce="${cnonce}"`;
      return authorization;
    }
  }
  async handleWebSocketConnectedAsync() {
    this._log.info("Connected to WARP charger");
    this._successfulInitialConnection = true;
    await this._adapter.setStateAsync("info.connection", true, true);
  }
  async handleWebSocketMessageAsync(data) {
    this._log.debug("Received new message from WARP charger via websocket");
    this._log.silly(`raw data: ${data}`);
    for (const s of data.toString(this._messageEncoding).split("\n")) {
      if (s.length > 1) {
        const message = JSON.parse(s);
        if (message.topic === "keep-alive") {
          this._log.debug("Got keep alive from WARP charger");
        } else if (!this._adapterIsShuttingDown) {
          this.webSocketMessageEmitter.emit("message", message);
        }
      }
    }
  }
  async handleWebSocketErrorAsync(error) {
    this._log.error("Error occurred on websocket connection to WARP", error);
  }
  async handleWebSocketDisconnectedAsync(_data) {
    await this._adapter.setStateAsync("info.connection", false, true);
    if (!this._adapterIsShuttingDown && this._successfulInitialConnection) {
      this._log.warn(`Unexpected disconnected from WARP charger. Try reconnecting in ${this._reconnectTimeoutInSeconds} seconds`);
      this._reconnectTimeout = setTimeout(() => {
        if (!this._adapterIsShuttingDown && this._successfulInitialConnection) {
          this.connectAsync();
        }
      }, this._reconnectTimeoutInSeconds * 1e3);
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WarpClient
});
//# sourceMappingURL=warp-client.js.map
