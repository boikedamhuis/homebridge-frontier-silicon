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

  this.enableVolume = config.enableVolume !== false;

  this.exposeSpeakerService = config.exposeSpeakerService !== false;
  this.exposeVolumeSlider = config.exposeVolumeSlider !== false;

  this.autoPowerOnOnPreset = config.autoPowerOnOnPreset !== false;

  // stations: [{ name: "Radio 2", preset: 2 }, ...]
  // preset is 1 based like the radio UI, internally we convert to 0 based presetKey for FSAPI
  this.stations = Array.isArray(config.stations) ? config.stations : [];

  this.lastKnownPower = null;
  this.lastKnownRadioVolume = null;

  // 0 based FSAPI preset key that we last selected via HomeKit
  this.lastKnownPresetKey = null;

  this.isUpdatingStationSwitches = false;

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

  this.switchService = new Service.Switch(this.name);
  this.switchService
    .getCharacteristic(Characteristic.On)
    .on("get", this.handleGetPower.bind(this))
    .on("set", this.handleSetPower.bind(this));

  if (this.enableVolume) {
    if (this.exposeSpeakerService) {
      this.speakerService = new Service.Speaker(this.name + " Speaker");

      this.speakerService
        .getCharacteristic(Characteristic.Volume)
        .on("get", this.handleGetVolume.bind(this))
        .on("set", this.handleSetVolume.bind(this));

      if (Characteristic.Mute) {
        this.speakerService
          .getCharacteristic(Characteristic.Mute)
          .on("get", (cb) => cb(null, false))
          .on("set", (_val, cb) => cb(null));
      }
    }

    if (this.exposeVolumeSlider) {
      this.volumeSliderService = new Service.Lightbulb(this.name + " Volume");

      this.volumeSliderService
        .getCharacteristic(Characteristic.On)
        .on("get", (cb) => cb(null, true))
        .on("set", (_val, cb) => cb(null));

      this.volumeSliderService
        .getCharacteristic(Characteristic.Brightness)
        .on("get", this.handleGetVolume.bind(this))
        .on("set", this.handleSetVolume.bind(this));
    }
  }

  this.stationServices = [];
  this.buildStationServices();

  this.startPolling();
}

FrontierSiliconAccessory.prototype.buildStationServices = function () {
  if (!Array.isArray(this.stations) || this.stations.length === 0) return;

  const seenSubtypes = new Set();

  for (const s of this.stations) {
    if (!s || typeof s !== "object") continue;

    const stationName = String(s.name ?? "").trim();
    const presetUi = Number(s.preset);

    if (!stationName) continue;
    if (!Number.isFinite(presetUi)) continue;

    // Convert 1 based UI preset number to 0 based FSAPI key
    const presetKey = Math.trunc(presetUi) - 1;
    if (presetKey < 0) continue;

    const subtype = "preset_" + String(presetKey);
    if (seenSubtypes.has(subtype)) continue;
    seenSubtypes.add(subtype);

    const sw = new Service.Switch(stationName, subtype);

    sw.getCharacteristic(Characteristic.On)
      .on("get", (cb) => {
        cb(null, this.lastKnownPresetKey === presetKey);
      })
      .on("set", (value, cb) => {
        this.handleSetStationPreset(presetKey, !!value, cb);
      });

    this.stationServices.push({
      presetKey,
      presetUi: Math.trunc(presetUi),
      name: stationName,
      service: sw
    });
  }
};

FrontierSiliconAccessory.prototype.getServices = function () {
  const services = [this.informationService, this.switchService];

  if (this.enableVolume && this.speakerService) services.push(this.speakerService);
  if (this.enableVolume && this.volumeSliderService) services.push(this.volumeSliderService);

  for (const s of this.stationServices) services.push(s.service);

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
    callback(null, radioToHomekitVolume(radioVol));
  } catch (err) {
    this.log.warn("Volume get failed, returning last known level.", toMsg(err));
    const fallbackRadio = this.lastKnownRadioVolume ?? 0;
    callback(null, radioToHomekitVolume(fallbackRadio));
  }
};

FrontierSiliconAccessory.prototype.handleSetVolume = async function (value, callback) {
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

FrontierSiliconAccessory.prototype.handleSetStationPreset = async function (presetKey, turnOn, callback) {
  if (this.isUpdatingStationSwitches) {
    callback(null);
    return;
  }

  // Exclusive selector behaviour
  // Turning OFF does not change the radio, we snap back to the current selection
  if (!turnOn) {
    callback(null);
    this.syncStationSwitchesFromPresetKey(this.lastKnownPresetKey);
    return;
  }

  // Optimistic UI update so previous station immediately turns off
  this.lastKnownPresetKey = presetKey;
  this.syncStationSwitchesFromPresetKey(presetKey);

  try {
    if (this.autoPowerOnOnPreset) {
      try {
        await this.client.setPower(true);
        this.lastKnownPower = true;
        this.switchService.getCharacteristic(Characteristic.On).updateValue(true);
      } catch (_e) {
        // ignore
      }
    }

    await this.client.setPresetKey(presetKey);

    callback(null);
  } catch (err) {
    this.log.warn("Preset set failed.", toMsg(err));
    callback(null);

    // Keep UI consistent with the last selection we know about
    this.syncStationSwitchesFromPresetKey(this.lastKnownPresetKey);
  }
};

FrontierSiliconAccessory.prototype.syncStationSwitchesFromPresetKey = function (presetKey) {
  if (!this.stationServices || this.stationServices.length === 0) return;

  this.isUpdatingStationSwitches = true;

  try {
    for (const s of this.stationServices) {
      const shouldBeOn = presetKey === s.presetKey;
      s.service.getCharacteristic(Characteristic.On).updateValue(shouldBeOn);
    }
  } finally {
    this.isUpdatingStationSwitches = false;
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

    if (this.enableVolume) {
      try {
        const radioVol = await this.client.getVolume();
        if (this.lastKnownRadioVolume !== radioVol) {
          this.lastKnownRadioVolume = radioVol;
          const homekitVol = radioToHomekitVolume(radioVol);

          if (this.speakerService) {
            this.speakerService.getCharacteristic(Characteristic.Volume).updateValue(homekitVol);
          }

          if (this.volumeSliderService) {
            this.volumeSliderService.getCharacteristic(Characteristic.Brightness).updateValue(homekitVol);
          }
        }
      } catch (err) {
        if (this.log.debug) this.log.debug("Polling volume failed.", toMsg(err));
      }
    }

    // Preset readback is not implemented for this firmware
    // We keep station switch states based on the last selected presetKey via HomeKit
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

// DIR3010 style preset selection using nav.state and selectPreset
FsApiClient.prototype.setPresetKey = async function (presetKey) {
  const p = Math.trunc(Number(presetKey));
  if (!Number.isFinite(p)) throw new Error("Invalid preset key");

  await this.fetchText("/fsapi/SET/netRemote.nav.state?value=1");
  await this.fetchText("/fsapi/SET/netRemote.nav.action.selectPreset?value=" + encodeURIComponent(String(p)));
  await this.fetchText("/fsapi/SET/netRemote.nav.state?value=0");
};

FsApiClient.prototype.fetchText = async function (pathAndQuery) {
  const joiner = pathAndQuery.includes("?") ? "&" : "?";
  const url = this.baseUrl + pathAndQuery + joiner + "pin=" + encodeURIComponent(this.pin);

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

function homekitToRadioVolume(homekitValue) {
  const x = clampInt(Number(homekitValue), 0, 100) / 100;
  return clampInt(Math.round(Math.pow(x, 2) * 100), 0, 100);
}

function radioToHomekitVolume(radioValue) {
  const x = clampInt(Number(radioValue), 0, 100) / 100;
  return clampInt(Math.round(Math.sqrt(x) * 100), 0, 100);
}
