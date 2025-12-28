
[![npm version](https://img.shields.io/npm/v/homebridge-frontier-silicon-plugin)](https://www.npmjs.com/package/homebridge-frontier-silicon-plugin)
[![npm downloads](https://img.shields.io/npm/dm/homebridge-frontier-silicon-plugin)](https://www.npmjs.com/package/homebridge-frontier-silicon-plugin)
[![npm total downloads](https://img.shields.io/npm/dt/homebridge-frontier-silicon-plugin)](https://www.npmjs.com/package/homebridge-frontier-silicon-plugin)
[![homebridge verified](https://img.shields.io/badge/homebridge-verified-brightgreen)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
![node](https://img.shields.io/node/v/homebridge-frontier-silicon-plugin)
[![GitHub release](https://img.shields.io/github/v/release/boikedamhuis/homebridge-frontier-silicon)](https://github.com/boikedamhuis/homebridge-frontier-silicon/releases)
[![GitHub stars](https://img.shields.io/github/stars/boikedamhuis/homebridge-frontier-silicon)](https://github.com/boikedamhuis/homebridge-frontier-silicon/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/boikedamhuis/homebridge-frontier-silicon)](https://github.com/boikedamhuis/homebridge-frontier-silicon/issues)
[![license](https://img.shields.io/npm/l/homebridge-frontier-silicon-plugin)](LICENSE)


# Homebridge Frontier Silicon Plugin

This Homebridge plugin adds basic but reliable HomeKit support for Frontier Silicon based internet radios using the native FSAPI interface.

It focuses on stability, simplicity and long term maintainability.  
Power control and volume control are supported, with safe polling and graceful error handling when a device is temporarily unreachable.

This plugin is designed as a modern replacement for older Frontier Silicon Homebridge integrations.

## Features

- Power on and off control through HomeKit  
- Volume control exposed as a HomeKit slider  
- Direct FSAPI communication over HTTP  
- No external or native dependencies  
- Crash safe behaviour when the radio is offline  
- Configurable polling interval  
- Compatible with Raspberry Pi and other low power systems  

## Requirements

- Node.js version 18 or higher  
- Homebridge version 1.6 or higher  
- A Frontier Silicon based radio with FSAPI enabled  

Most internet radios from brands such as Roberts, Ruark, Revo, Hama and similar use Frontier Silicon firmware and are compatible.

## Tested and Compatible Radios

This plugin is designed for radios based on the **Frontier Silicon FSAPI (NetRemote API)**.
It has been tested or is known to work on a wide range of internet and DAB+ radios using this platform.

### Known compatible brands and models (non-exhaustive)

**Hama**
- IR100
- IR110
- DIR3100 / DIR3110 series

**Medion**
- MD87180  
- MD86988  
- MD86955  
- MD87528  

**Roberts**
- Stream 83i  
- Stream 93i  

**Ruark**
- R2  
- R5  

**Revo**
- SuperConnect  

**Auna**
- Connect 150  
- Connect CD  
- KR200  

**TechniSat**
- DIGITRADIO 350 IR  
- DIGITRADIO 850  
- VIOLA series  

**Silvercrest (Lidl)**
- SMRS18A1  
- SMRS30A1  
- SMRS35A1  
- SIRD series  

**Dual / Teufel**
- Dual IR 3a  
- Teufel 3sixty  

### Important note

This list is **not complete**.  
Many internet and DAB+ radios use the same Frontier Silicon platform under different brand names.

If your radio responds to the following URL:

    http://<radio-ip>/fsapi/GET/netRemote.sys.info.friendlyName

then it is very likely compatible with this plugin.

If you successfully use this plugin with a radio that is not listed above, please consider opening an issue or pull request to help extend this list.


## Installation

### Recommended: Install via Homebridge UI

This plugin can be installed and configured entirely through the **Homebridge Config UI X**.
No manual JSON editing is required.

1. Open the Homebridge UI in your browser
2. Go to **Plugins**
3. Search for **homebridge-frontier-silicon-plugin**
4. Click **Install**
5. After installation, go to **Settings → Accessories**
6. Add a new accessory and select **Frontier Silicon Radio**
7. Fill in the required fields:
   - Name
   - IP address of the radio
   - FSAPI PIN (default is usually `1234`)
8. (Optional) Configure volume options and station presets via the UI
9. Save the configuration and **restart Homebridge**

After the restart, the radio and its controls will appear in the Apple Home app.

---

## HomeKit behaviour

- The radio power state appears as a Switch accessory  
- Volume control is exposed as a separate slider using a Lightbulb Brightness characteristic  

If the radio becomes unreachable, HomeKit will continue to show the last known state.  
Homebridge will not crash or hang.

When the radio becomes reachable again, the state is updated automatically.

## How it works

This plugin communicates directly with the Frontier Silicon FSAPI using HTTP requests.

Power state  
netRemote.sys.power

Volume  
netRemote.sys.audio.volume

All requests are executed with timeouts and error handling to ensure Homebridge stability.

## Troubleshooting

The radio does not respond

- Check the IP address  
- Verify the FSAPI PIN  
- Make sure the radio is connected to the same network as Homebridge  

HomeKit does not update immediately

- Increase the polling interval  
- Wait for the next poll cycle  

Enable debug logging in Homebridge for more insight.

## Compatibility notes

Some radios require FSAPI to be enabled in their settings menu.  
Some models expose volume in a different range, but most work correctly with values from 0 to 100.

If your radio behaves differently, feel free to open an issue.

## Development

This plugin is intentionally kept simple and dependency free.

Possible future improvements include

- Platform plugin support  
- Homebridge UI configuration schema  
- Preset or station switching  
- Mute support  

Contributions and pull requests are welcome.

## License

ISC License
