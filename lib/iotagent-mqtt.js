/*
 * Copyright 2015 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of iotagent-mqtt
 *
 * iotagent-mqtt is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * iotagent-mqtt is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with iotagent-mqtt.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 */

'use strict';

var iotAgentLib = require('iotagent-node-lib'),
    mqtt = require('mqtt'),
    logger = require('logops'),
    async = require('async'),
    errors = require('./errors'),
    apply = async.apply,
    context = {
        op: 'IoTAgentMQTT.Agent'
    },
    mqttClient,
    config;

/**
 * Find the attribute given by its name between all the active attributes of the given device, returning its type, or
 * null otherwise.
 *
 * @param {String} attribute        Name of the attribute to find.
 * @param {Object} device           Device object containing all the information about a device.
 * @return {String}                 String identifier of the attribute type.
 */
function guessType(attribute, device) {
    for (var i = 0; i < device.active.length; i++) {
        if (device.active[i].name === attribute) {
            return device.active[i].type;
        }
    }

    return null;
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

    logger.debug('Processing single measure for device [%s] with apiKey [%s]', deviceId, apiKey);

    values = [
        {
            name: attribute,
            type: guessType(attribute, device),
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
 * @param {Object} message          JSON object sent using MQTT.
 */
function multipleMeasures(apiKey, deviceId, device, message) {
    var messageObj = JSON.parse(message),
        values = [];

    logger.debug('Processing multiple measures for device [%s] with apiKey [%s]', deviceId, apiKey);

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
            logger.error(context, 'Couldn\'t send the updated values to the Context Broker due to an error: %s', error);
        } else {
            logger.debug(context, 'Multiple measures for device [%s] with apiKey [%s] successfully updated',
                deviceId, apiKey);
        }
    });
}

/**
 * Deals with configuration requests coming from the device. Whenever a new configuration requests arrives with a list
 * of attributes to retrieve, this handler asks the Context Broker for the values of those attributes, and publish a
 * new message in the "/1234/MQTT_2/configuration/values" topic
 *
 * @param {String} apiKey           API Key corresponding to the Devices configuration.
 * @param {String} deviceId         Id of the device to be updated.
 * @param {Object} device           Device object containing all the information about a device.
 * @param {Object} message          JSON object received with MQTT.
 */
function manageConfigurationRequest(apiKey, deviceId, device, message) {
    var objMessage = JSON.parse(message.toString());

    function handleSendConfigurationError(error, results) {
        if (error) {
            logger.error(context, 'Couldn\'t get the requested values from the Context Broker: %s', error);
        } else {
            logger.debug(context, 'Configuration attributes sent to the device successfully.', deviceId, apiKey);
        }
    }

    function sendConfigurationToDevice(results, callback) {
        var configurations = [];

        if (results.contextResponses && results.contextResponses[0] &&
            results.contextResponses[0].attributes) {

            for (var i = 0; i < results.contextResponses[0].attributes; i++) {
                configurations.push({
                    name: results.contextResponses[0].attributes[i].name,
                    value: results.contextResponses[0].attributes[i].value
                });
            }

            mqttClient.publish(
                '/' + apiKey + '/' + deviceId + '/configuration/values',
                JSON.stringify(configurations), null, callback);
        } else {
            callback();
        }
    }

    async.waterfall([
        apply(iotAgentLib.query, device.name, device.type, '', objMessage.fields, device),
        sendConfigurationToDevice
    ], handleSendConfigurationError);
}

/**
 * Handles an incoming MQTT message, extracting the API Key, device Id and attribute to update (in the case of single
 * measures) from the MQTT topic.
 *
 * @param {String} topic        Topic of the form: '/<APIKey>/deviceId/attributes[/<attributeName>]'.
 * @param {Object} message      MQTT message body (Object or Buffer, depending on the value).
 */
function mqttMessageHandler(topic, message) {
    var topicInformation = topic.split('/'),
        apiKey = topicInformation[1],
        deviceId = topicInformation[2];

    iotAgentLib.getDevice(deviceId, function(error, device) {
        if (error) {
            logger.error(context, 'Device not found for topic [%s]', topic);
        } else {
            if (topicInformation[3] === 'configuration' && topicInformation[4] === 'commands') {
                manageConfigurationRequest(apiKey, deviceId, device, message);
            } else if (topicInformation[4]) {
                singleMeasure(apiKey, deviceId, topicInformation[4], device, message);
            } else {
                multipleMeasures(apiKey, deviceId, device, message);
            }
        }
    });
}

/**
 * Generate the list of topics related to the device, based on the device attribute definitions.
 *
 * @param {Object} device           Device object containing all the information about the provisioned device.
 */
function generateDeviceTopics(device, apikey, callback) {
    var topics = [];

    if (device.active) {
        for (var i = 0; i < device.active.length; i++) {
            topics.push('/' + apikey + '/' + device.id + '/attributes/' + device.active[i].name);
        }
    }

    topics.push('/' + apikey + '/' + device.id + '/attributes');
    topics.push('/' + apikey + '/' + device.id + '/configuration/commands');

    callback(null, topics);
}

function getEffectiveApiKey(service, subservice, callback) {
    iotAgentLib.findConfiguration(service, subservice, function(error, group) {
        if (group) {
            callback(null, group.apikey);
        } else if (config.mqtt.defaultKey) {
            callback(null, config.mqtt.defaultKey);
        } else {
            logger.error(context, 'Could not find any API Key information for device.');
            callback(new errors.GroupNotFound(service, subservice));
        }
    });
}

/**
 * Handles the provisioning of devices. Each time a device is provisioned, the IOT Agent must subscribe itself to the
 * MQTT broker, for all the topics the device is going to use (one for multiple measures and one per attribute for
 * single measures).
 *
 * @param {Object} device           Device object containing all the information about the provisioned device.
 */
function deviceProvisioningHandler(device, callback) {
    function subscribeToTopics(topics, callback) {
        mqttClient.subscribe(topics, null, function(error) {
            if (error) {
                callback(error);
            } else {
                callback(null, device);
            }
        });
    }

    if (mqttClient) {
        async.waterfall([
            apply(getEffectiveApiKey, device.service, device.subservice),
            apply(generateDeviceTopics, device),
            subscribeToTopics
        ], callback);
    } else {
        callback();
    }
}

/**
 * Recreate the MQTT subscriptions for all the registered devices.
 */
function recreateSubscriptions(callback) {
    iotAgentLib.listDevices(function(error, devices) {
        if (error) {
            callback(error);
        } else {
            async.map(devices, deviceProvisioningHandler, callback);
        }
    });
}

/**
 * Unsubscribe the MQTT Client of all the topics for a single device.
 *
 * @param {Object} device       Object containing all the information about the device from the registry.
 */
function unsubscribeSingleDevice(device, callback) {
    function unsubscribeFromTopics(topics, callback) {
        mqttClient.unsubscribe(topics, null);

        callback();
    }

    async.waterfall([
        apply(getEffectiveApiKey, device.service, device.subservice),
        apply(generateDeviceTopics, device),
        unsubscribeFromTopics
    ], callback);
}

/**
 * Unsubscribe the MQTT Client for all the topics of all the devices of all the services.
 */
function unsubscribeAll(callback) {
    iotAgentLib.listDevices(function(error, devices) {
        if (error) {
            callback(error);
        } else {
            async.map(devices, unsubscribeSingleDevice, callback);
        }
    });
}

/**
 * Starts the IOTA with the given configuration.
 *
 * @param {Object} newConfig        New configuration object.
 */
function start(newConfig, callback) {
    var options = {
        keepalive: 0,
        connectTimeout: 60 * 60 * 1000
    };

    config = newConfig;

    iotAgentLib.activate(config.iota, function(error) {
        if (error) {
            callback(error);
        } else {
            mqttClient = mqtt.connect('mqtt://' + config.mqtt.host + ':' + config.mqtt.port, options);
            mqttClient.on('message', mqttMessageHandler);
            iotAgentLib.setProvisioningHandler(deviceProvisioningHandler);
            recreateSubscriptions(callback);
        }
    });
}

/**
 * Stops the current IoT Agent.
 *
 */
function stop(callback) {
    async.series([
        unsubscribeAll,
        mqttClient.end.bind(mqttClient, true),
        iotAgentLib.deactivate
    ], callback);
}

exports.start = start;
exports.stop = stop;
