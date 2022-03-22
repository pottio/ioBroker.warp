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
var crypto_exports = {};
__export(crypto_exports, {
  Encryption: () => Encryption
});
module.exports = __toCommonJS(crypto_exports);
class Encryption {
  static async decrypt(adapter, value) {
    return new Promise((resolve, reject) => {
      try {
        adapter.getForeignObject("system.config", (err, obj) => {
          const result = Encryption._decrypt(obj && obj.native && obj.native.secret ? obj.native.secret : "Zgfr56gFe87jJOM", value);
          resolve(result);
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  static _decrypt(key, value) {
    let result = "";
    for (let i = 0; i < value.length; ++i) {
      result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Encryption
});
//# sourceMappingURL=crypto.js.map
