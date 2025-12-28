"use strict";

let Service;
let Characteristic;

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory(
    "homebridge-frontier-silicone",
    "frontier-silicon",
    FrontierSiliconAccessory
  );
};

function FrontierSiliconAccessory(log, config) {
  this.log = log;

  this.name = config.name || "Frontier Silicon Radio";
  this.ip = config.ip;
  this.pin = String(config.pin ?? "1234");
  this.pollIntervalSeconds = Number(config.pollIntervalSeconds ?? 5);

  // Keep volume enabled by default. This now uses a Speaker service.
  this.enableVolume = config.enableVolume !== false;

  this.lastKnownPower = null;

  // Store last known RADIO volume in device scale 0..100
  this.lastKnownRadioVolume = null;

  if (!this.ip) {
    this.log.warn("No ip configured, accessory will not work.");
  }

  this.client = new FsApiClient({
    ip: this.ip,
    pin: this.pin,
    log: this.log
  });

  this.informationService = new Service.AccessoryInformation()
    .setCharacteristic(Characteristic.Manufacturer, "Frontier Silicon")
    .setCharacteristic(Characteristic.Model, "FSAPI Radio")
    .setCharacteristic(Characteristic.SerialNumber, this.ip || "unknown");

  // Power as Switch (kept as-is for maximum Home app compatibility)
  this.switchService = new Service.Switch(this.name);
  this.switchService
    .getCharacteristic(Characteristic.On)
    .on("get", this.handleGetPower.bind(this))
    .on("set", this.handleSetPower.bind(this));

  // Speaker service for volume (and optional mute)
  if (this.enableVolume) {
    this.speakerService = new Service.Speaker(this.name + " Speaker");

    // Volume characteristic uses HomeKit scale 0..100
    this.speakerService
      .getCharacteristic(Characteristic.Volume)
      .on("get", this.handleGetVolume.bind(this))
      .on("set", this.handleSetVolume.bind(this));

    // Optional mute support placeholder:
    // If you want real mute later, we can map this to an FSAPI endpoint if available.
    // For now, we expose mute but keep it non-functional (always false) to avoid confusion.
    if (Characteristic.Mute) {
      this.speakerService
        .getCharacteristic(Characteristic.Mute)
        .on("get", (cb) => cb(null, false))
        .on("set", (_val, cb) => cb(null));
    }
  }

  this.startPolling();
}

FrontierSiliconAccessory.prototype.getServices = function () {
  const services = [this.informationService, this.switchService];
  if (this.enableVolume && this.speakerService) services.push(this.speakerService);
  return services;
};

FrontierSiliconAccessory.prototype.handleGetPower = async function (callback) {
  try {
    const power = await this.client.getPower();
    this.lastKnownPower = power;
    callback(null, power);
  } catch (err) {
    this.log.warn("Power get failed, returning last known state.", toMsg(err));
    callback(null, this.lastKnownPower ?? false);
  }
};

FrontierSiliconAccessory.prototype.handleSetPower = async function (value, callback) {
  const target = !!value;

  try {
    await this.client.setPower(target);
    this.lastKnownPower = target;
    callback(null);
  } catch (err) {
    this.log.warn("Power set failed, keeping last known state.", toMsg(err));
    callback(null);
  }
};

FrontierSiliconAccessory.prototype.handleGetVolume = async function (callback) {
  try {
    const radioVol = await this.client.getVolume();
    this.lastKnownRadioVolume = radioVol;

    const homekitVol = radioToHomekitVolume(radioVol);
    callback(null, homekitVol);
  } catch (err) {
    this.log.warn("Volume get failed, returning last known level.", toMsg(err));
    const fallbackRadio = this.lastKnownRadioVolume ?? 0;
    callback(null, radioToHomekitVolume(fallbackRadio));
  }
};

FrontierSiliconAccessory.prototype.handleSetVolume = async function (value, callback) {
  // Non linear mapping so low slider values are much softer
  const radioVol = homekitToRadioVolume(value);

  try {
    await this.client.setVolume(radioVol);
    this.lastKnownRadioVolume = radioVol;
    callback(null);
  } catch (err) {
    this.log.warn("Volume set failed, keeping last known level.", toMsg(err));
    callback(null);
  }
};

FrontierSiliconAccessory.prototype.startPolling = function () {
  if (!this.ip) return;

  const intervalMs = Math.max(2, this.pollIntervalSeconds) * 1000;

  const tick = async () => {
    try {
      const power = await this.client.getPower();
      if (this.lastKnownPower !== power) {
        this.lastKnownPower = power;
        this.switchService.getCharacteristic(Characteristic.On).updateValue(power);
      }
    } catch (err) {
      if (this.log.debug) this.log.debug("Polling power failed.", toMsg(err));
    }

    if (this.enableVolume && this.speakerService) {
      try {
        const radioVol = await this.client.getVolume();
        if (this.lastKnownRadioVolume !== radioVol) {
          this.lastKnownRadioVolume = radioVol;
          const homekitVol = radioToHomekitVolume(radioVol);
          this.speakerService
            .getCharacteristic(Characteristic.Volume)
            .updateValue(homekitVol);
        }
      } catch (err) {
        if (this.log.debug) this.log.debug("Polling volume failed.", toMsg(err));
      }
    }
  };

  tick();
  this.pollTimer = setInterval(tick, intervalMs);
};

function FsApiClient({ ip, pin, log }) {
  this.ip = ip;
  this.pin = pin;
  this.log = log;

  this.baseUrl = "http://" + ip;
  this.timeoutMs = 2500;
}

FsApiClient.prototype.getPower = async function () {
  const text = await this.fetchText("/fsapi/GET/netRemote.sys.power");
  const value = parseFsapiValue(text);
  return value === 1;
};

FsApiClient.prototype.setPower = async function (on) {
  const v = on ? 1 : 0;
  await this.fetchText("/fsapi/SET/netRemote.sys.power?value=" + v);
};

FsApiClient.prototype.getVolume = async function () {
  const text = await this.fetchText("/fsapi/GET/netRemote.sys.audio.volume");
  const value = parseFsapiValue(text);
  return clampInt(Number(value), 0, 100);
};

FsApiClient.prototype.setVolume = async function (volume) {
  const v = clampInt(Number(volume), 0, 100);
  await this.fetchText("/fsapi/SET/netRemote.sys.audio.volume?value=" + v);
};

FsApiClient.prototype.fetchText = async function (pathAndQuery) {
  const joiner = pathAndQuery.includes("?") ? "&" : "?";
  const url =
    this.baseUrl +
    pathAndQuery +
    joiner +
    "pin=" +
    encodeURIComponent(this.pin);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), this.timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
};

function parseFsapiValue(body) {
  if (!body) return null;

  const trimmed = String(body).trim();

  const xmlMatch =
    trimmed.match(/<value>\s*<u8>(\d+)<\/u8>\s*<\/value>/i) ||
    trimmed.match(/<value>\s*<u16>(\d+)<\/u16>\s*<\/value>/i) ||
    trimmed.match(/<value>\s*<u32>(\d+)<\/u32>\s*<\/value>/i) ||
    trimmed.match(/<value>\s*<s16>(-?\d+)<\/s16>\s*<\/value>/i) ||
    trimmed.match(/<value>\s*<c8_array>(.*?)<\/c8_array>\s*<\/value>/i);

  if (xmlMatch) {
    const raw = xmlMatch[1];
    const num = Number(raw);
    return Number.isFinite(num) ? num : raw;
  }

  const okMatch = trimmed.match(/FS_OK\s+(.+)$/i);
  if (okMatch) {
    const raw = okMatch[1].trim();
    const num = Number(raw);
    return Number.isFinite(num) ? num : raw;
  }

  const tailNum = trimmed.match(/(-?\d+)\s*$/);
  if (tailNum) return Number(tailNum[1]);

  return trimmed;
}

function clampInt(n, min, max) {
  const v = Number.isFinite(n) ? Math.round(n) : min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function toMsg(err) {
  if (!err) return "";
  if (err instanceof Error) return err.message;
  return String(err);
}

// Non linear volume mapping
// HomeKit slider 0..100 is mapped to device volume 0..100
// Low slider values become much softer, high end remains reachable

function homekitToRadioVolume(homekitValue) {
  const x = clampInt(Number(homekitValue), 0, 100) / 100;
  return clampInt(Math.round(Math.pow(x, 2) * 100), 0, 100);
}

function radioToHomekitVolume(radioValue) {
  const x = clampInt(Number(radioValue), 0, 100) / 100;
  return clampInt(Math.round(Math.sqrt(x) * 100), 0, 100);
}
