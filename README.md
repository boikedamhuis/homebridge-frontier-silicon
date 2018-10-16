


[![Build Status](https://travis-ci.org/boikedamhuis/homebridge-frontier-silicon.svg?branch=master)](https://travis-ci.org/boikedamhuis/homebridge-frontier-silicon)

# homebridge-frontier-silicon-plugin

A Frontier Silicon plugin for homebridge (https://github.com/nfarina/homebridge) which integrates Frontier Silicon enabled devices with Homekit.
Plugin updates the status once you open the app, working on real time status updates. Stay tuned :)

# Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install the package request using: `npm install request -g`
3. Install the package polling to event using: `npm install polling-to-event -g`
4. install the package WiFi Radio `npm install wifiradio --save`
5. Install this plugin: `sudo npm i homebridge-frontier-silicon-plugin`
6. Update your `config.json` configuration file



```
"accessories": [ 
	{
		"accessory": "homebridge-frontier-silicon",
		"name": "Radio",
		"ip": "192.168.1.10"
   } 
]
```   

Code is based on this repo: https://github.com/rudders/homebridge-http

### Todos

 - Volume Change
 - Status Updates
 - Channel Change
 - Clean up the code
 

License
----

MIT

