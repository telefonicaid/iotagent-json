/*
 * Copyright 2016 Telefonica Investigación y Desarrollo, S.A.U
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

var iotAgentLib = require('iotagent-node-lib'),
    commandHandler = require('./commandHandler'),
    transportSelector = require('./transportSelector'),
    async = require('async'),
    iotaUtils = require('./iotaUtils'),
    constants = require('./constants'),
    context = {
        op: 'IoTAgentJSON.MQTTBinding'
    },
    config = require('./configService');


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
 * Find the attribute given by its name between all the active attributes of the given device, returning its type, or
 * null otherwise.
 *
 * @param {String} attribute        Name of the attribute to find.
 * @param {Object} device           Device object containing all the information about a device.
 * @return {String}                 String identifier of the attribute type.
 */
function guessType(attribute, device) {
    if (device.active) {
        for (var i = 0; i < device.active.length; i++) {
            if (device.active[i].name === attribute) {
                return device.active[i].type;
            }
        }
    }

    if (attribute === constants.TIMESTAMP_ATTRIBUTE) {
        return constants.TIMESTAMP_TYPE;
    } else {
        return constants.DEFAULT_ATTRIBUTE_TYPE;
    }
}

function extractAttributes(device, current) {
    var values = [];

    for (var i in current) {
        if (current.hasOwnProperty(i)) {
            values.push({
                name: i,
                type: guessType(i, device),
                value: current[i]
            });
        }
    }

    return values;
}

function sendConfigurationToDevice(device, apiKey, deviceId, results, callback) {
    transportSelector.applyFunctionFromBinding(
        [apiKey, deviceId, results],
        'sendConfigurationToDevice',
        device.transport,
        callback);
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
    iotaUtils.manageConfiguration(
        apiKey, deviceId, device, objMessage,
        async.apply(sendConfigurationToDevice, device),
        function(error) {
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
            type: guessType(attribute, device),
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
                type: guessType(i, device),
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
 * Handles an incoming MQTT message, extracting the API Key, device Id and attribute to update (in the case of single
 * measures) from the MQTT topic.
 *
 * @param {String} topic        Topic of the form: '/<APIKey>/deviceId/attrs[/<attributeName>]'.
 * @param {Object} message      MQTT message body (Object or Buffer, depending on the value).
 */
function messageHandler(topic, message) {
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

exports.messageHandler = messageHandler;
exports.extractAttributes = extractAttributes;
exports.guessType = guessType;
