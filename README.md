`wol-forwarder.js`
==================

Server that waits for wake-on-lan/magic packets and broadcasts them on a defined network.

Particularly handy when a router does not allow packet broadcasting from the Internet. The typical use is running the server on a low-consumption device such as a Raspberry Pi.



Requirements
============

- Node.js



Installation
============

Enter the root directory and run:

    $ npm install



Usage
=====

Run

    $ node wol-forwarder.js

Options
-------

Option | Description
------ | -----------
`-h`, `--listeningHost` | Set the host to listen to. Default: `0.0.0.0` (listen on all addresses of the server).
`-p`, `--listeningPort` | Set the port to listen to. Default: `9999` (due to the [_well-known ports_](http://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers#Well-known_ports) restrictions)
`-N`, `--forwardingNetwork` | Set the network to forward the magic packet to. Default: `255.255.255.255`.
`-P`, `--forwardingPort` | Set the port to forward the magic packet to. Default: `9`.

Router configuration
--------------------

With the default options, the router must be configured to route the inbound traffic on the port `9` to the server running `wol-forwarder.js` on the port `9999`.

