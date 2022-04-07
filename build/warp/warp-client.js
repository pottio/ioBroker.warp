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
var import_models = require("./models");
class WarpClient {
  constructor(adapter) {
    this._reconnectTimeoutInSeconds = 60;
    this._connectionCheckIntervalInSeconds = 15;
    this._maxAllowedDistanceBetweenKeepAliveInSeconds = 40;
    this._messageEncoding = "utf-8";
    this._nonceCount = 1;
    this._successfulInitialConnection = false;
    this._adapterIsShuttingDown = false;
    this.webSocketMessageEmitter = new import_events.EventEmitter();
    this._adapter = adapter;
    this._log = new import_context_logger.ContextLogger(adapter, WarpClient.name);
  }
  async initAsync() {
    this._log.info("Initializing");
    try {
      this._apiBasePath = `http${this._adapter.config.secureConnection ? "s" : ""}://${this._adapter.config.ipOrHostname}`;
      this._webSocketBasePath = `ws${this._adapter.config.secureConnection ? "s" : ""}://${this._adapter.config.ipOrHostname}`;
      this._log.debug(`WARP charger api base path: '${this._apiBasePath}'. Websocket base path: '${this._webSocketBasePath}'`);
    } catch (e) {
      this._log.error("Initializing failed", e);
    }
    this._log.info("Initialized");
  }
  async connectAsync() {
    this._log.info("Try connecting to WARP charger");
    try {
      this._lastReceivedKeepAliveTimestamp = Date.now();
      const warpClient = this;
      if (this._reconnectTimeout)
        clearTimeout(this._reconnectTimeout);
      if (this._checkConnectionInterval)
        clearInterval(this._checkConnectionInterval);
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
    if (this._checkConnectionInterval)
      clearInterval(this._checkConnectionInterval);
    this._adapterIsShuttingDown = true;
    if (this._ws) {
      this._log.info("Disconnecting from WARP charger");
      this._ws.close();
    }
  }
  async getMetaInformationForStartup() {
    this._log.info("Retrieve meta information for adapter startup from WARP charger");
    try {
      const versionResponse = await this.doGetRequestAsync("info/version");
      const nameResponse = await this.doGetRequestAsync("info/name");
      const featuresResponse = await this.doGetRequestAsync("info/features");
      if ((versionResponse == null ? void 0 : versionResponse.hasOwnProperty("firmware")) && (nameResponse == null ? void 0 : nameResponse.hasOwnProperty("name")) && (nameResponse == null ? void 0 : nameResponse.hasOwnProperty("type")) && (nameResponse == null ? void 0 : nameResponse.hasOwnProperty("display_type")) && !!featuresResponse) {
        return {
          name: nameResponse["name"],
          product: nameResponse["type"] === "warp" ? import_models.WarpProduct.warp1 : import_models.WarpProduct.warp2,
          firmwareVersion: versionResponse["firmware"],
          displayType: nameResponse["display_type"],
          features: featuresResponse
        };
      }
      return void 0;
    } catch (e) {
      this._log.error("Retrieving meta information failed", e);
    }
  }
  async doGetRequestAsync(path) {
    const authorizationToken = await this.getAuthorizationTokenAsync(path, "GET");
    const headers = authorizationToken ? { Accept: "application/json", Authorization: authorizationToken } : { Accept: "application/json" };
    const url = `${this._apiBasePath}${path}`;
    this._log.debug(`GET: ${url}`);
    const response = await axios.default({
      headers,
      method: "GET",
      url
    });
    return response.data;
  }
  async sendMessageAsync(message, method = "PUT") {
    this._log.info("Send message to WARP charger");
    this._log.silly("Message: " + JSON.stringify(message));
    try {
      const path = `/${message.topic}`;
      const authorizationToken = await this.getAuthorizationTokenAsync(path, method);
      const headers = authorizationToken ? { Accept: "application/json", Authorization: authorizationToken } : { Accept: "application/json" };
      const url = `${this._apiBasePath}${path}`;
      this._log.debug(`${method}: ${url}`);
      await axios.default({
        headers,
        method,
        url,
        data: method === "PUT" ? message.payload : void 0
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
    this._checkConnectionInterval = setInterval(() => this.checkConnection(), this._connectionCheckIntervalInSeconds * 1e3);
  }
  async handleWebSocketMessageAsync(data) {
    this._log.debug("Received new message from WARP charger via websocket");
    this._log.silly(`raw data: ${data}`);
    for (const s of data.toString(this._messageEncoding).split("\n")) {
      if (s.length > 1) {
        const message = JSON.parse(s);
        if (message.topic === "keep-alive") {
          this._log.debug("Got keep alive from WARP charger");
          this._lastReceivedKeepAliveTimestamp = Date.now();
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
      if (_data === -1) {
        this._log.warn(`Try reconnecting`);
        this.connectAsync();
      } else {
        this._log.warn(`Unexpected disconnected from WARP charger. Try reconnecting in ${this._reconnectTimeoutInSeconds} seconds`);
        this._reconnectTimeout = setTimeout(() => {
          if (!this._adapterIsShuttingDown && this._successfulInitialConnection && this.getSecondsSinceLastKeepAlive() > this._maxAllowedDistanceBetweenKeepAliveInSeconds) {
            this.connectAsync();
          }
        }, this._reconnectTimeoutInSeconds * 1e3);
      }
    }
  }
  checkConnection() {
    this._log.debug("Check last received keep alive timestamp");
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
      this._log.error("Checking last received keep alive timestamp failed", e);
    }
  }
  getSecondsSinceLastKeepAlive() {
    if (this._lastReceivedKeepAliveTimestamp) {
      const ms = Date.now() - this._lastReceivedKeepAliveTimestamp;
      return Math.floor(ms / 1e3);
    }
    return -1;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WarpClient
});
//# sourceMappingURL=warp-client.js.map
