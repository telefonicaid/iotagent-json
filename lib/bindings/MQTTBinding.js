/*
 * Copyright 2016 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of iotagent-json
 *
 * iotagent-json is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * iotagent-json is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with iotagent-json.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 */

'use strict';

var iotAgentLib = require('iotagent-node-lib'),
    mqtt = require('mqtt'),
    commonBindings = require('../commonBindings'),
    async = require('async'),
    iotaUtils = require('../iotaUtils'),
    constants = require('../constants'),
    context = {
        op: 'IOTAJSON.MQTT.Binding'
    },
    mqttClient,
    mqttConn,
    config = require('../configService');

/**
 * Generate the list of global topics to listen to.
 */
function generateTopics(callback) {
    var topics = [];

    config.getLogger().debug(context, 'Generating topics');
    topics.push('/+/+/' + constants.MEASURES_SUFIX + '/+');
    topics.push('/+/+/' + constants.MEASURES_SUFIX);
    topics.push('/+/+/' + constants.CONFIGURATION_SUFIX + '/' + constants.CONFIGURATION_COMMAND_SUFIX);
    topics.push('/+/+/' + constants.CONFIGURATION_COMMAND_UPDATE);

    callback(null, topics);
}

/**
 * Recreate the MQTT subscriptions for all the registered devices.
 */
function recreateSubscriptions(callback) {
    config.getLogger().debug(context, 'Recreating subscriptions for all devices');

    function subscribeToTopics(topics, callback) {
        config.getLogger().debug(context, 'Subscribing to topics: %j', topics);

        mqttClient.subscribe(topics, null, function(error) {
            if (error) {
                iotAgentLib.alarms.raise(constants.MQTTB_ALARM, error);
                config.getLogger().error(context, 'GLOBAL-001: Error subscribing to topics: %s', error);
                callback(error);
            } else {
                iotAgentLib.alarms.release(constants.MQTTB_ALARM);
                config.getLogger().debug(context, 'Successfully subscribed to the following topics:\n%j\n', topics);
                if (callback) {
                    callback(null);
                }
            }
        });
    }

    async.waterfall([generateTopics, subscribeToTopics], callback);
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
    var configurations = iotaUtils.createConfigurationNotification(results);
    var options = {};
    if (config.getConfig().mqtt.qos) {
        options.qos = parseInt(config.getConfig().mqtt.qos) || 0;
    }
    if (config.getConfig().mqtt.retain === true) {
        options.retain = config.getConfig().mqtt.retain;
    }
    config.getLogger().debug(context, 'Sending requested configuration to the device:\n %j', configurations);

    //prettier-ignore
    mqttClient.publish(
        '/' + apiKey + '/' + deviceId + '/' + constants.CONFIGURATION_SUFIX + '/' + 
        constants.CONFIGURATION_VALUES_SUFIX,
        JSON.stringify(configurations),
        options,
        callback
    );
}

/**
 * Unsubscribe the MQTT Client from all the topics.
 */
function unsubscribeAll(callback) {
    function unsubscribeFromTopics(topics, callback) {
        mqttClient.unsubscribe(topics, null);

        callback();
    }

    async.waterfall([generateTopics, unsubscribeFromTopics], callback);
}

/**
 * Start the binding.
 */
function start(callback) {
    var mqttConfig = config.getConfig().mqtt;
    var rejectUnauthorized = typeof mqttConfig.rejectUnauthorized === 'boolean' ? mqttConfig.rejectUnauthorized : true;
    var options = {
        protocol: mqttConfig.protocol ? mqttConfig.protocol : 'mqtt',
        host: mqttConfig.host ? mqttConfig.host : 'localhost',
        port: mqttConfig.port ? mqttConfig.port : 1883,
        key: mqttConfig.key ? mqttConfig.key : null,
        ca: mqttConfig.ca ? mqttConfig.ca : null,
        cert: mqttConfig.cert ? mqttConfig.cert : null,
        rejectUnauthorized: rejectUnauthorized,
        username: mqttConfig.username ? mqttConfig.username : null,
        password: mqttConfig.password ? mqttConfig.password : null,
        keepalive: 0,
        connectTimeout: 60 * 60 * 1000
    };
    if (config.getConfig().mqtt.keepalive) {
        options.keepalive = parseInt(config.getConfig().mqtt.keepalive) || 0;
    }
    var retries, retryTime;
    if (config.getConfig() && config.getConfig().mqtt && config.getConfig().mqtt.retries) {
        retries = config.getConfig().mqtt.retries;
    } else {
        retries = constants.MQTT_DEFAULT_RETRIES;
    }
    if (config.getConfig() && config.getConfig().mqtt && config.getConfig().mqtt.retrytime) {
        retryTime = config.getConfig().mqtt.retryTime;
    } else {
        retryTime = constants.MQTT_DEFAULT_RETRY_TIME;
    }
    var isConnecting = false;
    var numRetried = 0;
    config.getLogger().info(context, 'Starting MQTT binding');


    function createConnection(callback) {
        config.getLogger().info(context, 'creating connection');
        if (isConnecting) {
            return;
        }
        isConnecting = true;
        mqttClient = mqtt.connect(
            'mqtt://' + config.getConfig().mqtt.host + ':' + config.getConfig().mqtt.port,
            options
        );
        //mqttClient = mqtt.connect(options);
        isConnecting = false;
        // TDB: check if error
        if (!mqttClient) {
            config.getLogger().error(context, 'error mqttClient not created');
            if (numRetried <= retries) {
                numRetried++;
                return setTimeout(createConnection, retryTime * 1000, callback);
            }
        }
        mqttClient.on('error', function(e) {
            /*jshint quotmark: double */
            config.getLogger().fatal("GLOBAL-002: Couldn't connect with MQTT broker: %j", e);
            /*jshint quotmark: single */
            callback(e);
        });
        mqttClient.on('message', commonBindings.mqttMessageHandler);
        mqttClient.on('connect', function(ack) {
            config.getLogger().info(context, 'MQTT Client connected');
            recreateSubscriptions();
        });
        mqttClient.on('close', function() {
            // If mqttConn is null, the connection has been closed on purpose
            if (mqttConn) {
                config.getLogger().error(context, 'reconnecting');
                if (numRetried <= retries) {
                    numRetried++;
                    return setTimeout(createConnection, retryTime * 1000);
                }
            } else {
                return;
            }
        });

        config.getLogger().info(context, 'connected');
        mqttConn = mqttClient;
        if (callback) {
            callback();
        }
    } // function createConnection


    async.waterfall([createConnection], function(error) {
        if (error) {
            config.getLogger().debug('MQTT error %j', error);
        }
        callback();
    });

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
 * Stop the binding, releasing its resources.
 */
function stop(callback) {
    config.getLogger().info('Stopping MQTT Binding');

    async.series([unsubscribeAll, mqttClient.end.bind(mqttClient, true)], function() {
        config.getLogger().info('MQTT Binding Stopped');
        if (mqttConn) {
            mqttConn = null;
        }
        callback();
    });
}

/**
 * Execute a command for the device represented by the device object and the given APIKey, sending the serialized
 * JSON payload (already containing the command information).
 *
 * @param {String} apiKey                   APIKey of the device that will be receiving the command.
 * @param {Object} device                   Data object for the device receiving the command.
 * @param {String} serializedPayload        String payload in JSON format for the command.
 */
function executeCommand(apiKey, device, serializedPayload, callback) {
    var options = {};
    if (config.getConfig().mqtt.qos) {
        options.qos = parseInt(config.getConfig().mqtt.qos) || 0;
    }
    if (config.getConfig().mqtt.retain === true) {
        options.retain = config.getConfig().mqtt.retain;
    }
    config.getLogger().debug(context, 'Sending cmd to the device:\n %j', serializedPayload);
    mqttClient.publish('/' + apiKey + '/' + device.id + '/cmd', serializedPayload, options);
    callback();
}

exports.start = start;
exports.stop = stop;
exports.sendConfigurationToDevice = sendConfigurationToDevice;
exports.deviceProvisioningHandler = deviceProvisioningHandler;
exports.executeCommand = executeCommand;
exports.protocol = 'MQTT';
