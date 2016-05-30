(function() {

'use strict';

var dgram = require('dgram');
var util = require('util');
var macaddr = require('mac-address');
var parseArgs = require('minimist');
var validator = require('validator');
var isMac = require('is-mac');

var SYNC_SEQUENCE = macaddr.BROADCAST;
var MGC_PKT_START_OFFSET = 1;
var MGC_PKT_REPEAT_MAC_ADDR_NUMBER = 16;
var START_SYSTEM_PORT = 0;
var END_SYSTEM_PORT = 1023;
var END_PORT = 65535;

var server = dgram.createSocket('udp4');

/**
 * Check the input options and exit the program if at least one is wrong
 *
 * @param  {string[]} unknownOpts  list of options that are not supported
 * @param  {string[]} validOptions list of the valid options
 * @param  {Object[]} argv         list of the option values
 */
function validateOptions(unknownOpts, validOptions, argv) {
  // check whether required options are given
  if (unknownOpts.length > 0) {
    util.error(
      util.format('The following options are unknown and will be ignored: %s. Available options are: %s',
        unknownOpts.join(', '),
        validOptions.join(', ')
      )
    );
  }

  // control listeningHost
  if (!validator.isIP(argv.listeningHost) && !validator.isFQDN(argv.listeningHost)) {
    util.error(util.format('"%s" is not a valid host', argv.listeningHost));
    process.exit(1);
  }

  // control listeningPort
  if (
    !validator.isNumeric(argv.listeningPort) ||
    !(argv.listeningPort >= START_SYSTEM_PORT && argv.listeningPort <= END_PORT)
  ) {
    util.error(
      util.format(
        'The listening port ("%s") must be a number between %d and %d (or %d and %d if you have superuser privileges)',
        argv.listeningPort,
        END_SYSTEM_PORT + 1,
        END_PORT,
        START_SYSTEM_PORT,
        END_PORT
      )
    );
    process.exit(1);
  }

  // control forwardingNetwork
  if (!validator.isIP(argv.forwardingNetwork) && !validator.isFQDN(argv.forwardingNetwork)) {
    util.error(util.format('"%s" is not a valid host', argv.forwardingNetwork));
    process.exit(1);
  }

  // control forwardingPort
  if (
    !validator.isNumeric(argv.forwardingPort) ||
    !(argv.forwardingPort >= START_SYSTEM_PORT && argv.forwardingPort <= END_PORT)
  ) {
    util.error(
      util.format(
        'The forwarding port ("%s") must be a number between %d and %d',
        argv.forwardingPort,
        END_SYSTEM_PORT + 1,
        END_PORT
      )
    );
    process.exit(1);
  }
}

/**
 * Get the input arguments
 *
 * @return {Object.<string, Object>} list of the input arguments
 */
function getArgs() {
  var unknownOpts = [];
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
    },
    unknown: function(arg) {
      unknownOpts.push(arg);
      return false;
    }
  };

  var argv = parseArgs(process.argv.slice(2), options);

  validateOptions(unknownOpts, Object.keys(options.alias), argv);

  return argv;
}

function magicPacketToString(msg) {
  var seq;

  var beautifiedMsg = util.format('sync="%s" | ', macaddr.toString(msg.slice(0, macaddr.LENGTH)));

  for (var i = MGC_PKT_START_OFFSET; i < MGC_PKT_REPEAT_MAC_ADDR_NUMBER + MGC_PKT_START_OFFSET; i += 1) {
    seq = macaddr.toString(msg.slice(macaddr.LENGTH * i, macaddr.LENGTH * (i + 1)));

    beautifiedMsg += util.format('seq%d="%s" | ', i, seq);
  }

  return beautifiedMsg;
}

function controlMagicPacket(msg) {
  var prevSeq;
  var seq;

  var sync = macaddr.toString(msg.slice(0, macaddr.LENGTH));
  if (sync !== SYNC_SEQUENCE) {
    throw new Error(
      util.format(
        'The given magic packet does not begin with a synchronization sequence (expected "%s"; recieved "%s").',
        SYNC_SEQUENCE,
        sync
      )
    );
  }

  for (var i = MGC_PKT_START_OFFSET; i < MGC_PKT_REPEAT_MAC_ADDR_NUMBER + MGC_PKT_START_OFFSET; i += 1) {
    prevSeq = seq;
    seq = macaddr.toString(msg.slice(macaddr.LENGTH * i, macaddr.LENGTH * (i + 1)));

    if (seq !== prevSeq && i > 1) {
      throw new Error(
        util.format(
          'The given magic packet does not repeat sixteen times the destination' +
          'MAC address (expected "%s"; recieved "%s").',
          prevSeq,
          seq
        )
      );
    }
  }

  if (!isMac(seq)) {
    throw new Error(util.format('The given magic packet ("%s") is not a valid MAC address.', seq));
  }

  return seq;
}

function forwardMagicPacket(msg, host, port) {
  var client = dgram.createSocket('udp4');

  client.bind(function() {
    client.setBroadcast(true);
    client.send(msg, 0, msg.length, port, host, function() {
      client.close();
      util.log(util.format('Magic packet forwarded to %s:%d', host, port));
    });
  });
}

var argv = getArgs();

server.bind(argv.listeningPort, argv.listeningHost);

server.on('error', function(err) {
  util.error('server error:\n' + err.stack);
  server.close();
});

server.on('message', function(msg) {
  util.debug('Received a message. Trying to parse the message as a magic packet: ' + magicPacketToString(msg));

  var macAddrToWakeUp;
  try {
    macAddrToWakeUp = controlMagicPacket(msg);
  } catch (err) {
    util.error('The message is not a magic packet. Message skipped. ' + err);
    return;
  }
  util.log(
    util.format(
      'Trying to forward the magic packet (MAC address "%s") to %s:%d',
      macAddrToWakeUp,
      argv.forwardingNetwork,
      argv.forwardingPort
    )
  );
  forwardMagicPacket(msg, argv.forwardingNetwork, argv.forwardingPort);
});

server.on('listening', function() {
  var address = server.address();
  util.log(
    util.format(
      'Server listening on %s:%d. Magic packets will be forwarded to %s:%d',
      address.address,
      address.port,
      argv.forwardingNetwork,
      argv.forwardingPort
    )
  );
});

})();

