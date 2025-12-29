"use strict";

const http = require("http");

let Service;
let Characteristic;

const PLUGIN_NAME = "homebridge-frontier-silicon-plugin"; // must match package.json "name"
const PLATFORM_NAME = "frontier-silicon"; // must match config.schema.json platform const and Homebridge config

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, FrontierSiliconPlatform);
};

class FrontierSiliconPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.api = api;

    this.config = config || {};
    this.accessoriesByUUID = new Map();

    if (!this.api || typeof this.api.on !== "function") {
      this.log.warn("Homebridge API not available, platform will not start.");
      return;
    }

    this.api.on("didFinishLaunching", () => {
      try {
        this.discoverAndSync();
      } catch (e) {
        this.log.error("Failed to start platform:", e?.message || e);
      }
    });
  }

  configureAccessory(accessory) {
    this.accessoriesByUUID.set(accessory.UUID, accessory);
  }

  discoverAndSync() {
    const radios = Array.isArray(this.config.accessories) ? this.config.accessories : [];

    const desiredUUIDs = new Set();

    for (const radioCfg of radios) {
      if (!radioCfg || typeof radioCfg !== "object") continue;

      const name = String(radioCfg.name || "Frontier Silicon Radio");
      const ip = String(radioCfg.ip || "").trim();
      if (!ip) continue;

      const uuid = this.api.hap.uuid.generate(`frontier-silicon:${ip}`);
      desiredUUIDs.add(uuid);

      const existing = this.accessoriesByUUID.get(uuid);

      if (existing) {
        existing.context.config = radioCfg;
        existing.displayName = name;

        this.log.info(`Updating radio accessory: ${name} (${ip})`);
        new FrontierSiliconRadioAccessory(this.log, existing, radioCfg);
      } else {
        this.log.info(`Adding radio accessory: ${name} (${ip})`);
        const acc = new this.api.platformAccessory(name, uuid);
        acc.context.config = radioCfg;

        new FrontierSiliconRadioAccessory(this.log, acc, radioCfg);

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [acc]);
        this.accessoriesByUUID.set(uuid, acc);
      }
    }

    const toRemove = [];
    for (const [uuid, acc] of this.accessoriesByUUID.entries()) {
      if (!desiredUUIDs.has(uuid)) toRemove.push(acc);
    }

    if (toRemove.length > 0) {
      for (const acc of toRemove) this.accessoriesByUUID.delete(acc.UUID);
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, toRemove);
    }
  }
}

class FrontierSiliconRadioAccessory {
  constructor(log, accessory, config) {
    this.log = log;
    this.accessory = accessory;

    this.name = String(config.name || accessory.displayName || "Frontier Silicon Radio");
    this.ip = String(config.ip || "").trim();
    this.pin = String(config.pin ?? "1234");

    this.pollIntervalSeconds = Number(config.pollIntervalSeconds ?? 5);
    this.enableVolume = config.enableVolume !== false;

    this.exposeSpeakerService = config.exposeSpeakerService !== false;
    this.exposeVolumeSlider = config.exposeVolumeSlider !== false;

    this.autoPowerOnOnPreset = config.autoPowerOnOnPreset !== false;

    // stations: [{ name: "Radio 2", preset: 2 }, ...] where preset is 1 based
    this.stations = Array.isArray(config.stations) ? config.stations : [];

    this.lastKnownPower = null;
    this.lastKnownRadioVolume = null;
    this.lastKnownPresetKey = null;

    this.isUpdatingStationSwitches = false;

    this.client = new FsApiClient({
      ip: this.ip,
      pin: this.pin,
      timeoutMs: 2500
    });

    this.setupServices();
    this.startPolling();
  }

  setupServices() {
    const info = this.accessory.getService(Service.AccessoryInformation) ||
      this.accessory.addService(Service.AccessoryInformation);

    info
      .setCharacteristic(Characteristic.Manufacturer, "Frontier Silicon")
      .setCharacteristic(Characteristic.Model, "FSAPI Radio")
      .setCharacteristic(Characteristic.SerialNumber, this.ip || "unknown");

    // Power
    this.powerService = this.accessory.getServiceById(Service.Switch, "power") ||
      this.accessory.addService(Service.Switch, this.name, "power");

    this.powerService.setCharacteristic(Characteristic.Name, this.name);

    const powerChar = this.powerService.getCharacteristic(Characteristic.On);
    powerChar.removeAllListeners("get");
    powerChar.removeAllListeners("set");
    powerChar.on("get", this.handleGetPower.bind(this));
    powerChar.on("set", this.handleSetPower.bind(this));

    // Volume services
    if (this.enableVolume && this.exposeSpeakerService) {
      this.speakerService = this.accessory.getServiceById(Service.Speaker, "speaker") ||
        this.accessory.addService(Service.Speaker, `${this.name} Speaker`, "speaker");

      const volChar = this.speakerService.getCharacteristic(Characteristic.Volume);
      volChar.removeAllListeners("get");
      volChar.removeAllListeners("set");
      volChar.on("get", this.handleGetVolume.bind(this));
      volChar.on("set", this.handleSetVolume.bind(this));
    } else {
      const sp = this.accessory.getServiceById(Service.Speaker, "speaker");
      if (sp) this.accessory.removeService(sp);
      this.speakerService = null;
    }

    if (this.enableVolume && this.exposeVolumeSlider) {
      this.volumeSliderService = this.accessory.getServiceById(Service.Lightbulb, "volumeSlider") ||
        this.accessory.addService(Service.Lightbulb, `${this.name} Volume`, "volumeSlider");

      const onChar = this.volumeSliderService.getCharacteristic(Characteristic.On);
      onChar.removeAllListeners("get");
      onChar.removeAllListeners("set");
      onChar.on("get", (cb) => cb(null, true));
      onChar.on("set", (_v, cb) => cb(null));

      const brChar = this.volumeSliderService.getCharacteristic(Characteristic.Brightness);
      brChar.removeAllListeners("get");
      brChar.removeAllListeners("set");
      brChar.on("get", this.handleGetVolume.bind(this));
      brChar.on("set", this.handleSetVolume.bind(this));
    } else {
      const vs = this.accessory.getServiceById(Service.Lightbulb, "volumeSlider");
      if (vs) this.accessory.removeService(vs);
      this.volumeSliderService = null;
    }

    // Rebuild station services
    this.removeOldStationServices();
    this.stationServices = [];
    this.buildStationServices();
  }

  removeOldStationServices() {
    for (const s of this.accessory.services || []) {
      if (s.UUID === Service.Switch.UUID && typeof s.subtype === "string" && s.subtype.startsWith("station_")) {
        this.accessory.removeService(s);
      }
    }
  }

  buildStationServices() {
    if (!Array.isArray(this.stations) || this.stations.length === 0) return;

    const seen = new Set();

    for (const st of this.stations) {
      if (!st || typeof st !== "object") continue;

      const stationName = String(st.name ?? "").trim();
      const presetUi = Number(st.preset);

      if (!stationName) continue;
      if (!Number.isFinite(presetUi)) continue;

      const presetKey = Math.trunc(presetUi) - 1; // 1 based UI to 0 based FSAPI
      if (presetKey < 0) continue;

      const subtype = `station_${presetKey}`;
      if (seen.has(subtype)) continue;
      seen.add(subtype);

      const sw = this.accessory.addService(Service.Switch, stationName, subtype);

      const ch = sw.getCharacteristic(Characteristic.On);
      ch.removeAllListeners("get");
      ch.removeAllListeners("set");
      ch.on("get", (cb) => cb(null, this.lastKnownPresetKey === presetKey));
      ch.on("set", (value, cb) => this.handleSetStationPreset(presetKey, !!value, cb));

      this.stationServices.push({ presetKey, name: stationName, service: sw });
    }
  }

  async handleGetPower(callback) {
    try {
      const power = await this.client.getPower();
      this.lastKnownPower = power;
      callback(null, power);
    } catch (e) {
      callback(null, this.lastKnownPower ?? false);
    }
  }

  async handleSetPower(value, callback) {
    try {
      const target = !!value;
      await this.client.setPower(target);
      this.lastKnownPower = target;
      callback(null);
    } catch (e) {
      callback(null);
    }
  }

  async handleGetVolume(callback) {
    try {
      const radioVol = await this.client.getVolume();
      this.lastKnownRadioVolume = radioVol;
      callback(null, radioToHomekitVolume(radioVol));
    } catch (e) {
      const fallback = this.lastKnownRadioVolume ?? 0;
      callback(null, radioToHomekitVolume(fallback));
    }
  }

  async handleSetVolume(value, callback) {
    try {
      const radioVol = homekitToRadioVolume(value);
      await this.client.setVolume(radioVol);
      this.lastKnownRadioVolume = radioVol;
      callback(null);
    } catch (e) {
      callback(null);
    }
  }

  async handleSetStationPreset(presetKey, turnOn, callback) {
    if (this.isUpdatingStationSwitches) {
      callback(null);
      return;
    }

    if (!turnOn) {
      callback(null);
      this.syncStationSwitches(this.lastKnownPresetKey);
      return;
    }

    this.lastKnownPresetKey = presetKey;
    this.syncStationSwitches(presetKey);

    try {
      if (this.autoPowerOnOnPreset) {
        try {
          await this.client.setPower(true);
          this.lastKnownPower = true;
          this.powerService.getCharacteristic(Characteristic.On).updateValue(true);
        } catch (e) {
        }
      }

      await this.client.selectPreset(presetKey);
      callback(null);
    } catch (e) {
      callback(null);
      this.syncStationSwitches(this.lastKnownPresetKey);
    }
  }

  syncStationSwitches(presetKey) {
    if (!this.stationServices || this.stationServices.length === 0) return;

    this.isUpdatingStationSwitches = true;
    try {
      for (const s of this.stationServices) {
        s.service.getCharacteristic(Characteristic.On).updateValue(presetKey === s.presetKey);
      }
    } finally {
      this.isUpdatingStationSwitches = false;
    }
  }

  startPolling() {
    if (!this.ip) return;

    if (this.pollTimer) clearInterval(this.pollTimer);

    const intervalMs = Math.max(2, this.pollIntervalSeconds) * 1000;

    const tick = async () => {
      try {
        const power = await this.client.getPower();
        if (this.lastKnownPower !== power) {
          this.lastKnownPower = power;
          this.powerService.getCharacteristic(Characteristic.On).updateValue(power);
        }
      } catch (e) {
      }

      if (this.enableVolume) {
        try {
          const radioVol = await this.client.getVolume();
          if (this.lastKnownRadioVolume !== radioVol) {
            this.lastKnownRadioVolume = radioVol;
            const hk = radioToHomekitVolume(radioVol);

            if (this.speakerService) this.speakerService.getCharacteristic(Characteristic.Volume).updateValue(hk);
            if (this.volumeSliderService) this.volumeSliderService.getCharacteristic(Characteristic.Brightness).updateValue(hk);
          }
        } catch (e) {
        }
      }
    };

    tick();
    this.pollTimer = setInterval(tick, intervalMs);
  }
}

class FsApiClient {
  constructor({ ip, pin, timeoutMs }) {
    this.ip = ip;
    this.pin = pin;
    this.timeoutMs = timeoutMs || 2500;
  }

  getPower() {
    return this.getNodeNumber("netRemote.sys.power").then((v) => v === 1);
  }

  setPower(on) {
    const v = on ? 1 : 0;
    return this.setNodeNumber("netRemote.sys.power", v);
  }

  getVolume() {
    return this.getNodeNumber("netRemote.sys.audio.volume").then((v) => clampInt(v, 0, 100));
  }

  setVolume(v) {
    return this.setNodeNumber("netRemote.sys.audio.volume", clampInt(v, 0, 100));
  }

  async selectPreset(presetKey) {
    const p = Math.trunc(Number(presetKey));
    if (!Number.isFinite(p)) throw new Error("Invalid presetKey");

    // navigation based FSAPI required by many firmwares
    await this.setNodeNumber("netRemote.nav.state", 1);
    await this.setNodeNumber("netRemote.nav.action.selectPreset", p);
    await this.setNodeNumber("netRemote.nav.state", 0);
  }

  async getNodeNumber(node) {
    const xml = await this.request(`/fsapi/GET/${node}`);
    return parseFsapiValue(xml);
  }

  async setNodeNumber(node, value) {
    const xml = await this.request(`/fsapi/SET/${node}?value=${encodeURIComponent(String(value))}`);
    const ok = String(xml).includes("<status>FS_OK</status>");
    if (!ok) throw new Error("FSAPI SET failed");
    return true;
  }

  request(path) {
    const url = `http://${this.ip}${path}${path.includes("?") ? "&" : "?"}pin=${encodeURIComponent(this.pin)}`;

    return new Promise((resolve, reject) => {
      const req = http.get(url, { timeout: this.timeoutMs }, (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      });

      req.on("timeout", () => {
        req.destroy(new Error("timeout"));
      });

      req.on("error", reject);
    });
  }
}

function parseFsapiValue(xml) {
  if (!xml) return null;

  const s = String(xml);

  const m =
    s.match(/<value>\s*<u8>(-?\d+)<\/u8>\s*<\/value>/i) ||
    s.match(/<value>\s*<u16>(-?\d+)<\/u16>\s*<\/value>/i) ||
    s.match(/<value>\s*<u32>(-?\d+)<\/u32>\s*<\/value>/i) ||
    s.match(/<value>\s*<s16>(-?\d+)<\/s16>\s*<\/value>/i);

  if (m) return Number(m[1]);

  const t = s.match(/<value>\s*<c8_array>(.*?)<\/c8_array>\s*<\/value>/i);
  if (t) return t[1];

  return null;
}

function clampInt(n, min, max) {
  const v = Number.isFinite(Number(n)) ? Math.round(Number(n)) : min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function homekitToRadioVolume(homekitValue) {
  const x = clampInt(Number(homekitValue), 0, 100) / 100;
  return clampInt(Math.round(Math.pow(x, 2) * 100), 0, 100);
}

function radioToHomekitVolume(radioValue) {
  const x = clampInt(Number(radioValue), 0, 100) / 100;
  return clampInt(Math.round(Math.sqrt(x) * 100), 0, 100);
}
