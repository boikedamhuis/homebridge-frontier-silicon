


[![Build Status](https://travis-ci.org/boikedamhuis/homebridge-frontier-silicon.svg?branch=master)](https://travis-ci.org/boikedamhuis/homebridge-frontier-silicon)

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

## Installation

Install the plugin globally using npm

    npm install -g homebridge-frontier-silicon-plugin

After installation, restart Homebridge.

## Configuration

Add the accessory to your Homebridge configuration.

### Example configuration

    {
      "accessory": "frontier-silicon",
      "name": "Living Room Radio",
      "ip": "192.168.1.50",
      "pin": "1234",
      "pollIntervalSeconds": 5,
      "enableVolume": true
    }

## Configuration options

name  
Displayed name in HomeKit  

ip  
IP address of the radio  

pin  
FSAPI PIN code  
Default is 1234 on most devices  

pollIntervalSeconds  
Polling interval in seconds  
Minimum value is 2  
Default value is 5  

enableVolume  
Enable volume control  
Default is true  

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
