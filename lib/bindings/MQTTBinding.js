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

var iotAgentLib = require('iotagent-node-lib'),
    mqtt = require('mqtt'),
    dateFormat = require('dateformat'),
    commandHandler = require('../commandHandler'),
    logger = require('logops'),
    async = require('async'),
    iotaUtils = require('../iotaUtils'),
    constants = require('../constants'),
    apply = async.apply,
    context = {
        op: 'IoTAgentMQTT.Agent'
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

    logger.debug('Processing single measure for device [%s] with apiKey [%s]', deviceId, apiKey);

    values = [
        {
            name: attribute,
            type: iotaUtils.guessType(attribute, device),
            value: message.toString()
        }
    ];

    iotAgentLib.update(device.name, device.type, '', values, device, function(error) {
        if (error) {
            logger.error(context, 'Couldn\'t send the updated values to the Context Broker due to an error: %s', error);
        } else {
            logger.debug(context, 'Single measure for device [%s] with apiKey [%s] successfully updated',
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

    logger.debug('Processing multiple measures for device [%s] with apiKey [%s]', deviceId, apiKey);

    for (var i in messageObj) {
        if (messageObj.hasOwnProperty(i)) {
            values.push({
                name: i,
                type: iotaUtils.guessType(i, device),
                value: messageObj[i]
            });
        }
    }

    iotAgentLib.update(device.name, device.type, '', values, device, function(error) {
        if (error) {
            logger.error(context, 'Couldn\'t send the updated values to the Context Broker due to an error: %s', error);
        } else {
            logger.debug(context, 'Multiple measures for device [%s] with apiKey [%s] successfully updated',
                deviceId, apiKey);
        }
    });
}

/**
 * Generate the list of global topics to listen to.
 */
function generateTopics(callback) {
    var topics = [];

    logger.debug(context, 'Generating topics');
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
        logger.debug('Parse error treating message [%s]: %j', stringMessage, e);
        parsedMessage = null;
    }

    if (!parsedMessage) {
        logger.error(context, 'Impossible to handle malformed message: %s', message);
    }

    return parsedMessage;
}

/**
 * Recreate the MQTT subscriptions for all the registered devices.
 */
function recreateSubscriptions(callback) {
    logger.debug(context, 'Recreating subscriptions for all devices');

    function subscribeToTopics(topics, callback) {
        logger.debug('Subscribing to topics: %j', topics);

        mqttClient.subscribe(topics, null, function(error) {
            if (error) {
                logger.error('Error subscribing to topics: %s', error);
                callback(error);
            } else {
                logger.debug('Successfully subscribed to the following topics:\n%j\n', topics);
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
    var configurations = {},
        now = new Date();

    for (var i = 0; i < results.length; i++) {
        configurations[results[i].name] =
            results[i].value;
    }

    configurations.dt = dateFormat(now, constants.DATE_FORMAT);

    logger.debug('Sending requested configuration to the device:\n %j', configurations);

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
    function handleSendConfigurationError(error, results) {
        if (error) {
            logger.error(context, 'Couldn\'t get the requested values from the Context Broker: %s', error);
        } else {
            logger.debug(context, 'Configuration attributes sent to the device successfully.', deviceId, apiKey);
        }
    }

    function extractAttributes(results, callback) {
        if (results.contextResponses && results.contextResponses[0] &&
            results.contextResponses[0].contextElement.attributes) {
            callback(null, results.contextResponses[0].contextElement.attributes);
        } else {
            callback('Couldn\'t find any information in Context Broker response');
        }
    }

    if (objMessage.type === 'configuration') {
        async.waterfall([
            apply(iotAgentLib.query, device.name, device.type, '', objMessage.fields, device),
            extractAttributes,
            apply(sendConfigurationToDevice, apiKey, deviceId)
        ], handleSendConfigurationError);
    } else if (objMessage.type === 'subscription') {
        iotAgentLib.subscribe(device, objMessage.fields, objMessage.fields, function(error) {
            if (error) {
                logger.error('There was an error subscribing device [%s] to attributes [%j]',
                    device.name, objMessage.fields);
            } else {
                logger.debug('Successfully subscribed device [%s] to attributes[%j]', device.name, objMessage.fields);
            }
        });
    } else {
        logger.error('Unknown command type from device [%s]', device.name);
    }
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
            logger.error(context, 'Device not found for topic [%s]', topic);
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
                logger.error(context, 'Couldn\'t process message [%s] due to format issues.', message);
            }
        }
    }

    function extractServiceAndSubservice(group, callback) {
        callback(null, group.service, group.subservice);
    }

    if (apiKey === config.getConfig().mqtt.defaultKey) {
        iotAgentLib.getDevicesByAttribute('id', deviceId, undefined, undefined, function(error, devices) {
            if (error) {
                logger.error(context, 'Unexpected error receiving measure from APIKey [%s] DeviceId [%s]: %s',
                    deviceId, apiKey, error);
            } else if (devices && devices.length === 1) {
                processDeviceMeasure(null, devices[0]);
            } else {
                logger.error(context, 'Couldn\'t find device data for APIKey [%s] and DeviceId[%s]',
                    deviceId, apiKey);
            }
        });
    } else {
        async.waterfall([
            apply(iotAgentLib.getConfiguration, config.getConfig().iota.defaultResource, apiKey),
            extractServiceAndSubservice,
            apply(iotAgentLib.getDevice, deviceId)
        ], processDeviceMeasure);
    }
}

/**
 * Unsubscribe the MQTT Client of all the topics.
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
        logger.info(context, 'MQTT Client connected');
        commandHandler.init(mqttClient);
        recreateSubscriptions(callback);
    });
}

function stop(callback) {
    async.series([
        unsubscribeAll,
        mqttClient.end.bind(mqttClient, true)
    ], callback);
}

exports.start = start;
exports.stop = stop;
exports.unsubscribeAll = unsubscribeAll;
exports.sendConfigurationToDevice = sendConfigurationToDevice;
