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
    commandHandler = require('../commandHandler'),
    async = require('async'),
    iotaUtils = require('../iotaUtils'),
    constants = require('../constants'),
    context = {
        op: 'IoTAgentJSON.MQTTBinding'
    },
    mqttClient,
    config = require('../configService');


/**
 * Adds a single MQTT measure to the context broker. The message for single measures contains the direct value to
 * be inserted in the attribute, given by its name.
 *
 * @param {String} apiKey           API Key corresponding to the Devices configuration.
 * @param {String} deviceId         Id of the device to be updated.
 * @param {String} attribute        Name of the attribute to update.
 * @param {Object} device           Device object containing all the information about a device.
 * @param {Buffer} message          Raw message coming from the MQTT client.
 */
function singleMeasure(apiKey, deviceId, attribute, device, message) {
    var values;

    config.getLogger().debug(context, 'Processing single measure for device [%s] with apiKey [%s]', deviceId, apiKey);

    values = [
        {
            name: attribute,
            type: commonBindings.guessType(attribute, device),
            value: message.toString()
        }
    ];

    iotAgentLib.update(device.name, device.type, '', values, device, function(error) {
        if (error) {
            config.getLogger().error(context,
                'MEASURES-002: Couldn\'t send the updated values to the Context Broker due to an error: %s', error);
        } else {
            config.getLogger().debug(context, 'Single measure for device [%s] with apiKey [%s] successfully updated',
                deviceId, apiKey);
        }
    });
}

/**
 * Adds multiple MQTT measures to the Context Broker. Multiple measures come in the form of single-level JSON objects,
 * whose keys are the attribute names and whose values are the attribute values.
 *
 * @param {String} apiKey           API Key corresponding to the Devices configuration.
 * @param {String} deviceId         Id of the device to be updated.
 * @param {Object} device           Device object containing all the information about a device.
 * @param {Object} messageObj       JSON object sent using MQTT.
 */
function multipleMeasures(apiKey, deviceId, device, messageObj) {
    var values = [];

    config.getLogger().debug(context,
        'Processing multiple measures for device [%s] with apiKey [%s]', deviceId, apiKey);

    for (var i in messageObj) {
        if (messageObj.hasOwnProperty(i)) {
            values.push({
                name: i,
                type: commonBindings.guessType(i, device),
                value: messageObj[i]
            });
        }
    }

    iotAgentLib.update(device.name, device.type, '', values, device, function(error) {
        if (error) {
            config.getLogger().error(context,
                'MEASURES-002: Couldn\'t send the updated values to the Context Broker due to an error: %s', error);
        } else {
            config.getLogger().debug(context, 'Multiple measures for device [%s] with apiKey [%s] successfully updated',
                deviceId, apiKey);
        }
    });
}

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
 * Parse a message received from a MQTT Topic.
 *
 * @param {Buffer} message          Message to be parsed
 * @return {Object}                 Parsed message or null if an error has occurred.
 */
function parseMessage(message) {
    var parsedMessage,
        stringMessage;

    try {
        stringMessage = message.toString();
        parsedMessage = JSON.parse(stringMessage);
    } catch (e) {
        config.getLogger().debug(context, 'Parse error treating message [%s]: %j', stringMessage, e);
        parsedMessage = null;
    }

    if (!parsedMessage) {
        config.getLogger().error(context, 'MEASURES-003: Impossible to handle malformed message: %s', message);
    }

    return parsedMessage;
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
 * Deals with configuration requests coming from the device. Whenever a new configuration requests arrives with a list
 * of attributes to retrieve, this handler asks the Context Broker for the values of those attributes, and publish a
 * new message in the "/1234/MQTT_2/configuration/values" topic
 *
 * @param {String} apiKey           API Key corresponding to the Devices configuration.
 * @param {String} deviceId         Id of the device to be updated.
 * @param {Object} device           Device object containing all the information about a device.
 * @param {Object} objMessage          JSON object received with MQTT.
 */
function manageConfigurationRequest(apiKey, deviceId, device, objMessage) {
    iotaUtils.manageConfiguration(apiKey, deviceId, device, objMessage, sendConfigurationToDevice, function(error) {
        if (error) {
            iotAgentLib.alarms.raise(constants.MQTTB_ALARM, error);
        } else {
            iotAgentLib.alarms.release(constants.MQTTB_ALARM);
            config.getLogger().debug(
                context, 'Configuration request finished for APIKey [%s] and Device [%s]', apiKey, deviceId);
        }
    });
}

/**
 * Handles an incoming MQTT message, extracting the API Key, device Id and attribute to update (in the case of single
 * measures) from the MQTT topic.
 *
 * @param {String} topic        Topic of the form: '/<APIKey>/deviceId/attrs[/<attributeName>]'.
 * @param {Object} message      MQTT message body (Object or Buffer, depending on the value).
 */
function mqttMessageHandler(topic, message) {
    var topicInformation = topic.split('/'),
        apiKey = topicInformation[1],
        deviceId = topicInformation[2],
        parsedMessage = parseMessage(message);

    function processDeviceMeasure(error, device) {
        if (error) {
            config.getLogger().error(context, 'MEASURES-004: Device not found for topic [%s]', topic);
        } else {
            if (topicInformation[3] === 'configuration' && topicInformation[4] === 'commands' && parsedMessage) {
                manageConfigurationRequest(apiKey, deviceId, device, parsedMessage);
            } else if (topicInformation[4]) {
                singleMeasure(apiKey, deviceId, topicInformation[4], device, message);
            } else if (topicInformation[3] === constants.CONFIGURATION_COMMAND_UPDATE) {
                commandHandler.updateCommand(apiKey, deviceId, device, parsedMessage);
            } else if (parsedMessage && typeof parsedMessage === 'object') {
                multipleMeasures(apiKey, deviceId, device, parsedMessage);
            } else {
                config.getLogger().error(context, 'Couldn\'t process message [%s] due to format issues.', message);
            }
        }
    }

    iotAgentLib.alarms.release(constants.MQTTB_ALARM);
    iotAgentLib.retrieveDevice(deviceId, apiKey, processDeviceMeasure);
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

    mqttClient.on('message', mqttMessageHandler);

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
