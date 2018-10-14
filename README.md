# homebridge-frontier-silicon

A Frontier Silicon plugin for homebridge (https://github.com/nfarina/homebridge) which integrates Frontier Silicon enabled devices with Homekit.

# Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin: `npm install -g git+https://git@github.com/boikedamhuis/homebridge-frontier-silicon.git`
3. Update your `config.json` configuration file



 ```
"accessories": [ 
	{
		"accessory": "homebridge-frontier-silicon",
		"name": "Radio",
		"ip": "192.168.1.10",
   } 
]
```    