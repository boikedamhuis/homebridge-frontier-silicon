var Service, Characteristic;
var request = require("request");
var pollingtoevent = require("polling-to-event");


module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-frontier-silicon", "frontier-silicon", frontier);
};


function frontier(log, config) {
    this.log = log;

    // url info
    this.on_url = config["on_url"];
    this.on_body = config["on_body"];
    this.off_url = config["off_url"];
    this.off_body = config["off_body"];
    this.status_url = config["status_url"];
    this.status_on = config["status_on"];
    this.status_off = config["status_off"];
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
    this.switchHandling = config["switchHandling"] || "no";


    //realtime polling info
    this.state = false;
    this.currentlevel = 0;
    this.enableSet = true;
    var that = this;

    
}

frontier.prototype = {

    httpRequest: function (url, body, method, username, password, sendimmediately, callback) {
        request({
                url: url,
                body: body,
                method: method,
                rejectUnauthorized: false,
                auth: {
                    user: username,
                    pass: password,
                    sendImmediately: sendimmediately
                }
            },
            function (error, response, body) {
                callback(error, response, body)
            })
    },

    setPowerState: function (powerState, callback) {
        this.log("Power On", powerState);
        this.log("Enable Set", this.enableSet);
        this.log("Current Level", this.currentlevel);
        if (this.enableSet === true) {

            var url;
            var body;

            if (!this.on_url || !this.off_url) {
                this.log.warn("Ignoring request; No power url defined.");
                callback(new Error("No power url defined."));
                return;
            }

            if (powerState) {
            	
                url = this.on_url + "/fsapi/SET/netRemote.sys.power?pin=1234&value=1";
                body = this.on_body;
                this.log("Setting power state to on");
            } else {
                url = this.on_url + "/fsapi/SET/netRemote.sys.power?pin=1234&value=0";
                body = this.off_body;
                this.log("Setting power state to off");
            }

            this.httpRequest(url, function (error, response, responseBody) {
                if (error) {
                    this.log("HTTP set power function failed: %s", error.message);
                    callback(error);
                } else {
                    this.log("HTTP set power function succeeded!");
                    callback();
                }
            }.bind(this));
        } else {
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

        this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function (error, response, responseBody) {
            if (error) {
                this.log("HTTP get power function failed: %s", error.message);
                callback(error);
            } else {
                var binaryState;
                this.log("Status Config On", this.status_on);
                if (this.status_on && this.status_off) {	//Check if custom status checks are set
                    var customStatusOn = this.status_on;
                    var customStatusOff = this.status_off;
                    var statusOn, statusOff;

                    // Check to see if custom states are a json object and if so compare to see if either one matches the state response
                    if (responseBody.startsWith("{")) {
                        statusOn = compareStates(customStatusOn, JSON.parse(responseBody));
                        statusOff = compareStates(customStatusOff, JSON.parse(responseBody));
                    } else {
                        statusOn = responseBody.includes(customStatusOn);
                        statusOff = responseBody.includes(customStatusOff);
                    }
                    this.log("Status On Get Power State", statusOn);
                    if (statusOn) binaryState = 1;
                    // else binaryState = 0;
                    if (statusOff) binaryState = 0;
                } else {
                    binaryState = parseInt(responseBody.replace(/\D/g, ""));
                }
                var powerOn = binaryState > 0;
                this.log("Power state is currently %s", binaryState);
                callback(null, powerOn);
            }
        }.bind(this));
    },

    getBrightness: function (callback) {
        if (!this.brightnesslvl_url) {
            this.log.warn("Ignoring request; No brightness level url defined.");
            callback(new Error("No brightness level url defined."));
            return;
        }
        var url = this.brightnesslvl_url;
        this.log("Getting Brightness level");

        this.httpRequest(url, "", "GET", this.username, this.password, this.sendimmediately, function (error, response, responseBody) {
            if (error) {
                this.log("HTTP get brightness function failed: %s", error.message);
                callback(error);
            } else {
                var binaryState = parseInt(responseBody.replace(/\D/g, ""));
                var level = binaryState;
                this.log("brightness state is currently %s", binaryState);
                callback(null, level);
            }
        }.bind(this));
    },

    setBrightness: function (level, callback) {
        if (this.enableSet === true) {
            if (!this.brightness_url) {
                this.log.warn("Ignoring request; No brightness url defined.");
                callback(new Error("No brightness url defined."));
                return;
            }

            var url = this.brightness_url.replace("%b", level);

            this.log("Setting brightness to %s", level);

            this.httpRequest(url, "", this.http_brightness_method, this.username, this.password, this.sendimmediately, function (error, response, body) {
                if (error) {
                    this.log("HTTP brightness function failed: %s", error);
                    callback(error);
                } else {
                    this.log("HTTP brightness function succeeded!");
                    callback();
                }
            }.bind(this));
        } else {
            callback();
        }
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
        .setCharacteristic(Characteristic.Model, "Frontier Silicon Radio")
        .setCharacteristic(Characteristic.SerialNumber, "H8273HG7FHWU");

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