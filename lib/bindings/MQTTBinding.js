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
        op: 'IoTAgentJSON.MQTTBinding'
    },
    mqttClient,
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
                callback(null);
            }
        });
    }

    async.waterfall([
        generateTopics,
        subscribeToTopics
    ], callback);
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

    config.getLogger().debug(context, 'Sending requested configuration to the device:\n %j', configurations);

    mqttClient.publish(
        '/' + apiKey + '/' + deviceId + '/' + constants.CONFIGURATION_SUFIX + '/' +
        constants.CONFIGURATION_VALUES_SUFIX,
        JSON.stringify(configurations), null, callback);
}

/**
 * Unsubscribe the MQTT Client from all the topics.
 */
function unsubscribeAll(callback) {
    function unsubscribeFromTopics(topics, callback) {
        mqttClient.unsubscribe(topics, null);

        callback();
    }

    async.waterfall([
        generateTopics,
        unsubscribeFromTopics
    ], callback);
}

/**
 * Start the binding.
 */
function start(callback) {
    var options = {
        keepalive: 0,
        connectTimeout: 60 * 60 * 1000
    };

    if (config.getConfig().mqtt.username && config.getConfig().mqtt.password) {
        options.username = config.getConfig().mqtt.username;
        options.password = config.getConfig().mqtt.password;
    }

    mqttClient = mqtt.connect(
        'mqtt://' + config.getConfig().mqtt.host + ':' + config.getConfig().mqtt.port, options);

    mqttClient.on('message', commonBindings.messageHandler);

    mqttClient.on('connect', function() {
        config.getLogger().info(context, 'MQTT Client connected');
        recreateSubscriptions(callback);
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
    async.series([
        unsubscribeAll,
        mqttClient.end.bind(mqttClient, true)
    ], callback);
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
    mqttClient.publish('/' + apiKey + '/' + device.id + '/cmd', serializedPayload, null);
    callback();
}

exports.start = start;
exports.stop = stop;
exports.sendConfigurationToDevice = sendConfigurationToDevice;
exports.deviceProvisioningHandler = deviceProvisioningHandler;
exports.executeCommand = executeCommand;
exports.protocol = 'MQTT';
