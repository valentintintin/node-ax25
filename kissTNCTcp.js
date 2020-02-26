var util		= require("util");
var events		= require("events");
var net = require('net');
var ax25		= require("./index.js");

var kissTNCTcp = function(args) {

	var self = this;
	events.EventEmitter.call(this);

	var properties = {
		'ip'			: 0,
		'port'			: 0,
		'txDelay'		: 50,
		'persistence'	: 63,
		'slotTime'		: 10,
		'txTail'		: 1,
		'fullDuplex'	: false
	}

	this.__defineSetter__(
		"ip",
		function(ip) {
			if(typeof ip != "string")
				throw "kissTNCTcp: Invalid or no ip argument provided.";
			properties.ip = ip;
		}
	);
	
	this.__defineGetter__(
		"ip",
		function() {
			return properties.ip;
		}
	);
	
	this.__defineSetter__(
		"port",
		function(port) {
			if(typeof port != "number")
				throw "kissTNCTcp: Invalid or no port argument provided.";
			properties.port = port;
		}
	);
	
	this.__defineGetter__(
		"port",
		function() {
			return properties.port;
		}
	);

	this.__defineSetter__(
		"txDelay",
		function(txDelay) {
			if(	typeof txDelay != "number"
				||
				txDelay < 0
				||
				txDelay > 255
			) {
				throw "kissTNCTcp: Invalid txDelay";
			}
			properties.txDelay = txDelay / 10;
			sendFrame(ax25.kissDefs.TXDELAY, [properties.txDelay]);
		}
	);
	
	this.__defineGetter__(
		"txDelay",
		function() {
			return properties.txDelay * 10;
		}
	);

	this.__defineSetter__(
		"persistence",
		function(persistence) {
			if(	typeof persistence != "number"
				||
				persistence < 0
				||
				persistence > 1
			) {
				throw "kissTNCTcp: Invalid persistence";
			}
			properites.persistence = (persistence * 256) - 1;
			sendFrame(ax25.kissDefs.PERSISTENCE, [properties.persistence]);
		}
	);
	
	this.__defineGetter__(
		"persistence",
		function() {
			return (properties.persistence / 256) + 1;
		}
	);

	this.__defineSetter__(
		"slotTime",
		function(slotTime) {
			if(	typeof slotTime != "number"
				||
				slotTime < 0
				||
				slotTime > 255
			) {
				throw "kissTNCTcp: Invalid slotTime";
			}
			properties.slotTime = slotTime / 10;
			sendFrame(ax25.kissDefs.SLOTTIME, [properties.slotTIme]);
		}
	);
	
	this.__defineGetter__(
		"slotTime",
		function() {
			return properties.slotTime * 10;
		}
	);
	
	this.__defineSetter__(
		"txTail",
		function(txTail) {
			if(	typeof txTail != "number"
				||
				txTail < 0
				||
				txTail > 255
			)
				throw "kissTNCTcp: Invalid txTail";
			properties.txTail = txTail / 10;
			sendFrame(ax25.kissDefs.TXTAIL, [properties.txTail]);
		}
	);
	
	this.__defineGetter__(
		"txTail",
		function() {
			return properties.txTail * 10;
		}
	);

	this.__defineSetter__(
		"fullDuplex",
		function(fullDuplex) {
			if(typeof fullDuplex != "boolean")
				throw "kissTNCTcp: fullDuplex must be boolean";
			properties.fullDuplex = fullDuplex;
			sendFrame(
				ax25.kissDefs.FULLDUPLEX,
				[(properties.fullDuplex) ? 1 : 0]
			);
		}
	);
	
	this.__defineGetter__(
		"fullDuplex",
		function() {
			return (properties.fullDuplex == 1) ? true : false;
		}
	);
	
	this.ip		= args.ip;
	this.port		= args.port;
	
	var dataBuffer = [];
		
	var sendFrame = function(command, data) {
		if(!(data instanceof Array))
			throw "ax25.kissTNCTcp: Invalid send data";
		data.unshift(command);
		data.unshift(ax25.kissDefs.FEND);
		data.push(ax25.kissDefs.FEND);
		tcpHandle.write(
			data.map(c => String.fromCharCode(c)).join(''), 'binary',
			function(err, result) {
				if(typeof err != "undefined")
					self.emit("error", "kissTNCTcp: Send error: " + err);
				if(typeof result != "undefined")
					self.emit("sent", "kissTNCTcp: Send result: " + result);
			}
		);
	}
	
	var dataHandler = function(data) {
		var str = "";
		var escaped = false;
		for(var d = 0; d < data.length; d++) {
			if(data[d] == ax25.kissDefs.FESC) {
				escaped = true;
				continue;
			}
			if(escaped && data[d] == ax25.kissDefs.TFEND)
				data[d] = ax25.kissDefs.FEND;
			if(escaped && data[d] == ax25.kissDefs.TFESC)
				data[d] = ax25.kissDefs.FESC;
			if(escaped || data[d] != ax25.kissDefs.FEND)
				dataBuffer.push(data[d]);
			if(!escaped && data[d] == ax25.kissDefs.FEND && dataBuffer.length > 1) {
				self.emit("frame", dataBuffer.slice(1));
				dataBuffer = [];
			}
			if(escaped)
				escaped = false;
		}
	}

	var tcpHandle = new net.Socket();
	
	tcpHandle.on(
		"error",
		function(err) {
			self.emit("error", "kissTNCTcp: TCP error: " + err);
		}
	);

	tcpHandle.connect(properties.port, properties.ip, function() {
		self.emit("opened");
	});
	
	tcpHandle.on(
		"close",
		function() {
			self.emit("closed");
		}
	);
		
	tcpHandle.on(
		"data",
		function(data) {
			dataHandler(data);
		}
	);

	this.setHardware = function(value) {
		sendFrame(ax25.kissDefs.SETHARDWARE, [value]);
	}
	
	this.send = function(data) {
		if(!(data instanceof Array))
			throw "kissTNCTcp.send: data type mismatch.";
		sendFrame(ax25.kissDefs.DATAFRAME, data);
	}
	
	this.exitKISS = function() {
		sendFrame(ax25.kissDefs.RETURN, []);
	}

	this.close = function() {
		tcpHandle.destroy();
	}
	
}
util.inherits(kissTNCTcp, events.EventEmitter);

module.exports = kissTNCTcp;
