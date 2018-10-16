var Service, Characteristic;
var request = require("request");
var pollingtoevent = require("polling-to-event");

const wifiradio = require('wifiradio');



module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-frontier-silicone", "frontier-silicone", HttpAccessory);
};


function HttpAccessory(log, config) {
    this.log = log;

    // url info
    this.ip = config["ip"];
    this.on_url = this.ip;
    this.on_body = this.ip;
    this.off_url = this.ip;
    this.off_body = this.ip;
    this.status_url = "/fsapi/GET/netRemote.sys.power?pin=1234";
    this.status_on = "FS_OK 1";
    this.status_off = "FS_OK 0";
    this.brightness_url = config["brightness_url"];
    this.brightnesslvl_url = config["brightnesslvl_url"];
    this.http_method = config["http_method"] || "GET";
    this.http_brightness_method = config["http_brightness_method"] || this.http_method;
    this.username = config["username"] || "";
    this.password = config["password"] || "";
    this.sendimmediately = config["sendimmediately"] || "";
    this.service = config["service"] || "Switch";
    this.name = config["name"];
    this.brightnessHandling = config["brightnessHandling"] || "no";
    this.switchHandling = "realtime";

	
    //realtime polling info
    this.state = false;
    this.currentlevel = 0;
    this.enableSet = true;
    var that = this;

    // Status Polling, if you want to add additional services that don't use switch handling you can add something like this || (this.service=="Smoke" || this.service=="Motion"))
    if (this.status_url && this.switchHandling === "realtime") {
    
    const radio = new wifiradio(this.ip, "1234");
    var status;
    var binaryState;      
    emitter = pollingtoevent(function(done) {
      var url = this.status_url;
      var binaryState;
      //console.log("Status Config On", this.status_on);
      var customStatusOn = this.status_on;
      var customStatusOff = this.status_off;
      var statusOn, statusOff;
      const radio = new wifiradio(this.ip, "1234");
                                                            
        radio.getPower() .then(function(response) {
                        if (response == "1") {
                         binaryState = 1;

                    }
                         // else binaryState = 0;
                      if (response == "0") {
                           binaryState = 0;

                    }
                         
                    binaryState = 10;
                    this.status_on = binaryState;
                    //this.log("Status Config On", this.status_on);

                  this.log(response);
                    callback(null, binaryState);
                    done(response);

                        })
}, {
  longpolling: true, interval: 300, longpollEventName: "longpoll"
});

emitter.on("longpoll", function(data) {

console.log("Longpoll");
  
  
});


    }
    // Brightness Polling
    if (this.brightnesslvl_url && this.brightnessHandling === "realtime") {
        var brightnessurl = this.brightnesslvl_url;
        var levelemitter = pollingtoevent(function (done) {
            that.httpRequest(brightnessurl, "", "GET", that.username, that.password, that.sendimmediately, function (error, response, responseBody) {
                if (error) {
                    that.log("HTTP get power function failed: %s", error.message);
                    return;
                } else {
                    done(null, responseBody);
                }
            }) // set longer polling as slider takes longer to set value
        }, { longpolling: true, interval: 300, longpollEventName: "levelpoll" });

        levelemitter.on("levelpoll", function (responseBody) {
            that.currentlevel = parseInt(responseBody);

            that.enableSet = false;
            if (that.lightbulbService) {
                that.log(that.service, "received brightness", that.brightnesslvl_url, "level is currently", that.currentlevel);
                that.lightbulbService.getCharacteristic(Characteristic.Brightness)
                .setValue(that.currentlevel);
            }
            that.enableSet = true;
        });
    }
}

HttpAccessory.prototype = {



    setPowerState: function (powerState, callback) {
        this.log("Power On", powerState);
        
        if (this.enableSet === true) {

            var url;
            var body;

            if (!this.on_url || !this.off_url) {
                this.log.warn("No IP adress defined");
                callback(new Error("No power IP defined."));
                return;
            }
			const radio = new wifiradio(this.ip, "1234");
			
           if (powerState) {

			
                radio.setPower(1);
                
                body = this.on_body;
                this.log("Setting power state to on");
            } else {
				radio.setPower(0);     
                this.log("Setting power state to off");
            }
            
            callback();
    }
    
},

    getPowerState: function (callback) {
        if (!this.status_url) {
            this.log.warn("Ignoring request; No status url defined.");
            callback(new Error("No status url defined."));
            return;
        }

        var url = this.status_url;
        this.log("Getting power state");


                var binaryState;
                this.log("Status Config On", this.status_on);
                    var customStatusOn = this.status_on;
                    var customStatusOff = this.status_off;
                    var statusOn, statusOff;

                    // Check to see if custom states are a json object and if so compare to see if either one matches the state response
              		const radio = new wifiradio(this.ip, "1234");
              		
              	              			              		
    				 radio.getPower() .then(function(response) {
						if (response == "1") {
   						     binaryState = 1;

  					  }
   						 // else binaryState = 0;
 						  if (response == "0") {
 						  binaryState = 0;

   						 }
    					console.log(response);
    					callback(null, binaryState);
						})

                    
                    
                	
               
                
                //var powerOn = binaryState = 0;
                this.log("Power state is currently %s", binaryState);
    },

    identify: function (callback) {
        this.log("Identify requested!");
        callback(); // success
    },

    getServices: function () {

        var that = this;

        // you can OPTIONALLY create an information service if you wish to override
        // the default values for things like serial number, model, etc.
        var informationService = new Service.AccessoryInformation();

        informationService
        .setCharacteristic(Characteristic.Manufacturer, "Boike Damhuis")
        .setCharacteristic(Characteristic.Model, "0.0.8")
        .setCharacteristic(Characteristic.SerialNumber, "8PC00CAM4B");

        switch (this.service) {
            case "Switch":
                this.switchService = new Service.Switch(this.name);
                switch (this.switchHandling) {
                    //Power Polling
                    case "yes":
                        this.switchService
                        .getCharacteristic(Characteristic.On)
                        .on("get", this.getPowerState.bind(this))
                        .on("set", this.setPowerState.bind(this));
                        break;
                    case "realtime":
                        this.switchService
                        .getCharacteristic(Characteristic.On)
                        .on("get", function (callback) {
                            callback(null, that.state)
                        })
                        .on("set", this.setPowerState.bind(this));
                        break;
                    default    :
                        this.switchService
                        .getCharacteristic(Characteristic.On)
                        .on("set", this.setPowerState.bind(this));
                        break;
                }
                return [this.switchService];
            case "Light":
                this.lightbulbService = new Service.Lightbulb(this.name);
                switch (this.switchHandling) {
                    //Power Polling
                    case "yes" :
                        this.lightbulbService
                        .getCharacteristic(Characteristic.On)
                        .on("get", this.getPowerState.bind(this))
                        .on("set", this.setPowerState.bind(this));
                        break;
                    case "realtime":
                        this.lightbulbService
                        .getCharacteristic(Characteristic.On)
                        .on("get", function (callback) {
                            callback(null, that.state)
                        })
                        .on("set", this.setPowerState.bind(this));
                        break;
                    default:
                        this.lightbulbService
                        .getCharacteristic(Characteristic.On)
                        .on("set", this.setPowerState.bind(this));
                        break;
                }
                // Brightness Polling
                if (this.brightnessHandling === "realtime") {
                    this.lightbulbService
                    .addCharacteristic(new Characteristic.Brightness())
                    .on("get", function (callback) {
                        callback(null, that.currentlevel)
                    })
                    .on("set", this.setBrightness.bind(this));
                } else if (this.brightnessHandling === "yes") {
                    this.lightbulbService
                    .addCharacteristic(new Characteristic.Brightness())
                    .on("get", this.getBrightness.bind(this))
                    .on("set", this.setBrightness.bind(this));
                }

                return [informationService, this.lightbulbService];
                break;
        }
    }
};






