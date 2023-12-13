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

/* eslint-disable consistent-return */

const iotAgentLib = require('iotagent-node-lib');
const config = require('../configService');
const constants = require('../constants');
const amqp = require('amqplib/callback_api');
const commons = require('./../commonBindings');
const fillService = iotAgentLib.fillService;
const async = require('async');
let context = {
    op: 'IOTAJSON.AMQP.Binding'
};
let amqpConn;
let amqpChannel;

/**
 * Execute a command for the device represented by the device object and the given APIKey, sending the serialized
 * JSON payload (already containing the command information).
 *
 * @param {String} apiKey                   APIKey of the device that will be receiving the command.
 * @param {Object} device                   Data object for the device receiving the command.
 * @param {String} serializedPayload        String payload in JSON format for the command.
 */
function executeCommand(apiKey, group, device, cmdName, serializedPayload, contentType, callback) {
    config
        .getLogger()
        .debug(
            context,
            'Sending command execution to device %s with apikey %s and payload %s ',
            apiKey,
            device.id,
            serializedPayload
        );

    amqpChannel.assertExchange(config.getConfig().amqp.exchange, 'topic', config.getConfig().amqp.options);
    amqpChannel.publish(config.getConfig().amqp.exchange, '.' + apiKey + '.' + device.id + '.cmd', serializedPayload);
    callback();
}

function queueListener(msg) {
    config.getLogger().debug(context, 'Received %j', msg);
    commons.amqpMessageHandler(msg.fields.routingKey.replace(/\./g, '/'), msg.content.toString());
}

/**
 * Starts the IoT Agent with the passed configuration. This method also starts the listeners for all the transport
 * binding plugins.
 */
function start(callback) {
    let exchange;
    let queue;
    context = fillService(context, { service: 'n/a', subservice: 'n/a' });
    const amqpConfig = config.getConfig().amqp;
    if (!amqpConfig) {
        return config.getLogger().error(context, 'Error AMPQ is not configured');
    }
    if (amqpConfig.disabled) {
        return config.getLogger().warn(context, 'AMPQ is disabled');
    }

    if (amqpConfig.exchange) {
        exchange = amqpConfig.exchange;
    } else {
        exchange = constants.AMQP_DEFAULT_EXCHANGE;
    }

    if (amqpConfig.queue) {
        queue = amqpConfig.queue;
    } else {
        queue = constants.AMQP_DEFAULT_QUEUE;
    }

    let durable;

    if (amqpConfig.options && amqpConfig.options.durable) {
        durable = amqpConfig.options.durable;
    } else {
        durable = constants.AMQP_DEFAULT_DURABLE;
    }

    let retries;
    let retryTime;

    if (amqpConfig.retries) {
        retries = amqpConfig.retries;
    } else {
        retries = constants.AMQP_DEFAULT_RETRIES;
    }
    if (amqpConfig.retrytime) {
        retryTime = amqpConfig.retryTime;
    } else {
        retryTime = constants.AMQP_DEFAULT_RETRY_TIME;
    }

    let uri = 'amqp://';

    if (amqpConfig.username && amqpConfig.password) {
        uri += amqpConfig.username + ':' + amqpConfig.password + '@';
    }
    if (amqpConfig.host) {
        uri += amqpConfig.host;
        if (amqpConfig.port) {
            uri += ':' + amqpConfig.port;
        }
    }

    let isConnecting = false;
    let numRetried = 0;

    config.getLogger().info(context, 'Starting AMQP binding');

    function createConnection(callback) {
        config.getLogger().info(context, 'creating connection');
        if (isConnecting) {
            return;
        }
        isConnecting = true;
        amqp.connect(uri, function (err, conn) {
            isConnecting = false;
            // try again
            if (err) {
                config.getLogger().error(context, err.message);
                if (numRetried <= retries) {
                    numRetried++;
                    return setTimeout(createConnection, retryTime * 1000, callback);
                }
            } else {
                conn.on('error', function (err) {
                    if (err.message !== 'Connection closing') {
                        config.getLogger().error(context, err.message);
                    }
                });
                conn.on('close', function () {
                    // If amqpConn is null, the connection has been closed on purpose
                    if (amqpConn) {
                        config.getLogger().error(context, 'reconnecting');
                        if (numRetried <= retries) {
                            numRetried++;
                            return setTimeout(createConnection, retryTime * 1000);
                        }
                    }
                });
                config.getLogger().info(context, 'connected');
                amqpConn = conn;
                if (callback) {
                    callback();
                }
            }
        });
    }

    function createChannel(callback) {
        config.getLogger().debug(context, 'channel creating');
        amqpConn.createChannel(function (err, ch) {
            if (err) {
                config.getLogger().error(context, err.message);
            }
            config.getLogger().debug(context, 'channel created');
            amqpChannel = ch;
            callback();
        });
    }

    function assertExchange(callback) {
        if (amqpChannel) {
            config.getLogger().debug(context, 'asserting exchange');
            amqpChannel.assertExchange(exchange, 'topic', { durable });
            config.getLogger().debug(context, 'exchange asserted');
            callback();
        }
    }

    function assertQueue(callback) {
        config.getLogger().debug(context, 'asserting queues');
        amqpChannel.assertQueue(queue, { exclusive: false }, function () {
            amqpChannel.assertQueue(queue + '_commands', { exclusive: false }, callback);
        });
    }

    function createListener(queueObj, callback) {
        config.getLogger().debug(context, 'creating listeners');
        amqpChannel.bindQueue(queue, exchange, '.*.*.attrs.#');
        amqpChannel.consume(queue, queueListener, { noAck: true });
        config.getLogger().debug(context, 'subscribed to updates queue');

        amqpChannel.bindQueue(queue + '_commands', exchange, '.*.*.cmdexe');
        amqpChannel.consume(queue + '_commands', queueListener, { noAck: true });
        config.getLogger().debug(context, 'subscribed to commands queue');
        callback();
    }

    async.waterfall([createConnection, createChannel, assertExchange, assertQueue, createListener], function (error) {
        if (error) {
            config.getLogger().debug('AMQP error %j', error);
        }
        callback();
    });
}

/**
 * Stops the IoT Agent and all the transport plugins.
 */
function stop(callback) {
    config.getLogger().info(context, 'Stopping AMQP Binding');
    if (amqpConn) {
        amqpConn.close();
        amqpConn = null;
    }
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
 * Device updating handler.
 *
 * @param {Object} device           Device object containing all the information about the provisioned device.
 */
function deviceUpdatingHandler(device, callback) {
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
exports.deviceUpdatingHandler = deviceUpdatingHandler;
exports.executeCommand = executeCommand;
exports.protocol = 'AMQP';
