/*
 * Copyright 2017 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of iotagent-ul
 *
 * iotagent-ul is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * iotagent-ul is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with iotagent-ul.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[iot_support@tid.es]
 */

'use strict';

var config = require('../configService'),
    constants = require('../constants'),
    amqp = require('amqplib/callback_api'),
    commons = require('./../commonBindings'),
    async = require('async'),
    context = {
        op: 'IOTAJSON.AMQP.Binding'
    },
    amqpConn,
    amqpChannel;


/**
 * Execute a command for the device represented by the device object and the given APIKey, sending the serialized
 * JSON payload (already containing the command information).
 *
 * @param {String} apiKey                   APIKey of the device that will be receiving the command.
 * @param {Object} device                   Data object for the device receiving the command.
 * @param {String} serializedPayload        String payload in JSON format for the command.
 */
function executeCommand(apiKey, device, serializedPayload, callback) {
    config.getLogger().debug(context, 'Sending command execution to device [%s] with apikey [%s] and payload [%s] ',
        apiKey, device.id, serializedPayload);

    amqpChannel.assertExchange(config.getConfig().amqp.exchange, 'topic', config.getConfig().amqp.options);
    amqpChannel.publish(
        config.getConfig().amqp.exchange, '.' + apiKey + '.' + device.id + '.cmd', new Buffer(serializedPayload));
    callback();
}

function queueListener(msg) {
    commons.messageHandler(msg.fields.routingKey.replace(/\./g, '/'), msg.content.toString());
}

/**
 * Starts the IoT Agent with the passed configuration. This method also starts the listeners for all the transport
 * binding plugins.
 */
function start(callback) {
    var exchange,
        queue;

    if (config.getConfig() && config.getConfig().amqp && config.getConfig().amqp.exchange) {
        exchange = config.getConfig().amqp.exchange;
    } else {
        exchange = constants.AMQP_DEFAULT_EXCHANGE;
    }

    if (config.getConfig() && config.getConfig().amqp && config.getConfig().amqp.queue) {
        queue = config.getConfig().amqp.queue;
    } else {
        queue = constants.AMQP_DEFAULT_QUEUE;
    }

    config.getLogger().info(context, 'Starting AQMP binding');

    function createConnection(callback) {
        amqp.connect('amqp://localhost', callback);
    }

    function createChannel(conn, callback) {
        amqpConn = conn;
        conn.createChannel(callback);
    }

    function assertExchange(ch, callback) {
        amqpChannel = ch;
        amqpChannel.assertExchange(exchange, 'topic', {});
        callback();
    }

    function assertQueue(callback) {
        amqpChannel.assertQueue(queue, {exclusive: false}, callback);
        amqpChannel.assertQueue(queue + '_commands', {exclusive: false}, callback);
    }

    function createListener(queueObj, callback) {

        amqpChannel.bindQueue(queue, exchange, '.*.*.attrs.#');
        amqpChannel.consume(queue, queueListener, {noAck: true});

        amqpChannel.bindQueue(queue + '_commands', exchange, '.*.*.cmdexe');
        amqpChannel.consume(queue + '_commands', queueListener, {noAck: true});

        callback();
    }

    async.waterfall([
        createConnection,
        createChannel,
        assertExchange,
        assertQueue,
        createListener
    ], function(error) {
        callback();
    });
}

/**
 * Stops the IoT Agent and all the transport plugins.
 */
function stop(callback) {
    config.getLogger().info('Stopping AMQP Binding');

    callback();
}

/**
 * Device provisioning handler.
 *
 * @param {Object} device           Device object containing all the information about the provisioned device.
 */
function deviceProvisioningHandler(device, callback) {
    callback(null, device);
}

/**
 * Extract all the information from a Context Broker response and send it to the topic indicated by the APIKey and
 * DeviceId.
 *
 * @param {String} apiKey           API Key for the Device Group
 * @param {String} deviceId         ID of the Device.
 * @param {Object} results          Context Broker response.
 */
function sendConfigurationToDevice(apiKey, deviceId, results, callback) {
    callback();
}

exports.start = start;
exports.stop = stop;
exports.sendConfigurationToDevice = sendConfigurationToDevice;
exports.deviceProvisioningHandler = deviceProvisioningHandler;
exports.executeCommand = executeCommand;
exports.protocol = 'AMQP';
