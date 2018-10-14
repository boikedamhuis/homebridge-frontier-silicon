"use strict";

var Service, Characteristic;
var request = require("request");
var pollingtoevent = require('polling-to-event');


module.exports = function(homebridge) {

    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-frontier-silicon", "frontier-silicon", FrontierSilicon);
};

FrontierSilicon.prototype = {
  getServices: function () {
    let informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Manufacturer, "Boike Damhuis")
      .setCharacteristic(Characteristic.Model, "Frontier Silicon Enabled Radio")
      .setCharacteristic(Characteristic.SerialNumber, "-");
 
    let switchService = new Service.Switch("Radio");
    switchService
      .getCharacteristic(Characteristic.On)
        .on('get', this.getSwitchOnCharacteristic.bind(this))
        .on('set', this.setSwitchOnCharacteristic.bind(this));
 
    this.informationService = informationService;
    this.switchService = switchService;
    return [informationService, switchService];
  }
};

const request = require('request');
const url = require('url');
 
function FrontierSilicon(log, config) {
  this.log = log;
  this.getUrl = url.parse(config['ip']);
  this.postUrl = url.parse(config['postUrl']);
}
 
FrontierSilicon.prototype = {
 
  getSwitchOnCharacteristic: function (next) {
    const me = this;
    request({
        url: me.ip + "/fsapi/GET/netRemote.sys.power?pin=1234",
        method: 'GET',
    }, 
    function (error, response, body) {
      if (error) {
        me.log('STATUS: ' + response.statusCode);
        me.log(error.message);
        return next(error);
      }
      return next(null, body.currentState);
    });
  },
   
  setSwitchOnCharacteristic: function (on, next) {
    const me = this;
    request({
      url: me.ip,
      body: {'targetState': on},
      method: 'POST',
      headers: {'Content-type': 'application/json'}
    },
    function (error, response) {
      if (error) {
        me.log('STATUS: ' + response.statusCode);
        me.log(error.message);
        return next(error);
      }
      return next();
    });
  }
};