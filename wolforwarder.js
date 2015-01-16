var dgram = require('dgram');
var util = require('util');
var macaddr = require('mac-address');
var parseArgs = require('minimist');



var SYNC_SEQUENCE = macaddr.BROADCAST;
var MGC_PKT_START_OFFSET = 1;
var MGC_PKT_REPEAT_MAC_ADDR_NUMBER = 16;

var server = dgram.createSocket('udp4');

function magicPacketToString (msg) {
  var beautifiedMsg;

  beautifiedMsg = util.format('sync="%s" | ', macaddr.toString(msg.slice(0, macaddr.LENGTH)));
  
  for (var i = MGC_PKT_START_OFFSET; i < MGC_PKT_REPEAT_MAC_ADDR_NUMBER + MGC_PKT_START_OFFSET; i++) {
    seq = macaddr.toString(msg.slice(macaddr.LENGTH * i, macaddr.LENGTH * (i + 1)));

    beautifiedMsg += util.format('seq%d="%s" | ', i, seq);
  }

  return beautifiedMsg;
}

function controlMagicPacket (msg) {
  var sync = macaddr.toString(msg.slice(0, macaddr.LENGTH));
  if (sync !== SYNC_SEQUENCE) {
    throw new Error(util.format('The given magic packet does not begin with a synchronization sequence (expected "%s"; recieved "%s").', SYNC_SEQUENCE, sync));
  }
  
  var prevSeq;
  var seq;
  for (var i = MGC_PKT_START_OFFSET; i < MGC_PKT_REPEAT_MAC_ADDR_NUMBER + MGC_PKT_START_OFFSET; i++) {
    prevSeq = seq;
    seq = macaddr.toString(msg.slice(macaddr.LENGTH * i, macaddr.LENGTH * (i + 1)));
    
    if (seq !== prevSeq && i > 1) {
      throw new Error(util.format('The given magic packet does not repeat sixteen times the destination MAC address (expected "%s"; recieved "%s").', prevSeq, seq));
    }
  }

  return seq;
}

function forwardMagicPacket(msg, host, port) {
  var client = dgram.createSocket('udp4');
  
  client.bind(function() {
    client.setBroadcast(true);
    client.send(msg, 0, msg.length, port, host, function(err, bytes) {
      client.close();
      util.log(util.format('Magic packet forwarded to %s:%d', host, port));
    });
  });
}

server.on('error', function (err) {
  util.error('server error:\n' + err.stack);
  server.close();
});

server.on('message', function (msg, rinfo) {
  util.debug('Received a message. Trying to parse the message as a magic packet: ' + magicPacketToString(msg));
  try {
    var macAddrToWakeUp = controlMagicPacket(msg);
  } catch (err) {
    util.error('The message is not a magic packet. Message skipped. ' + err);
    return;
  }
  util.log(util.format('Trying to forward the magic packet (MAC address "%s") to %s:%d', macAddrToWakeUp, argv.forwardingNetwork, argv.forwardingPort));
  forwardMagicPacket(msg, argv.forwardingNetwork, argv.forwardingPort);
});

server.on('listening', function () {
  var address = server.address();
  util.log(util.format('Server listening on %s:%d. Magic packets will be forwarded to %s:%d', address.address, address.port, argv.forwardingNetwork, argv.forwardingPort));
});

var options = {
  default: {
    listeningHost: '0.0.0.0',
    listeningPort: 9999,
    forwardingNetwork: '255.255.255.255',
    forwardingPort: 9
  },
  alias: {
    listeningHost: 'h',
    listeningPort: 'p',
    forwardingNetwork: 'N',
    forwardingPort: 'P'
  }
}

var argv = parseArgs(process.argv.slice(2), options);

server.bind(argv.listeningPort);

