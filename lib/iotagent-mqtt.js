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
    context = {
        op: 'IoTAgentMQTT.Agent'
    },
    mqttClient,
    config;

function guessType(attribute, device) {
    for (var i = 0; i < device.active.length; i++) {
        if (device.active[i].name === attribute) {
            return device.active[i].type;
        }
    }

    return null;
}

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

function mqttMessageHandler(topic, message) {
    var topicInformation = topic.split('/'),
        apiKey = topicInformation[1],
        deviceId = topicInformation[2];

    iotAgentLib.getDevice(deviceId, function(error, device) {
        if (error) {
            logger.error(context, 'Device not found for topic [%s]', topic);
        } else {
            if (topicInformation[4]) {
                singleMeasure(apiKey, deviceId, topicInformation[4], device, message);
            } else {
                multipleMeasures(apiKey, deviceId, device, message);
            }
        }
    });
}

function deviceProvisioningHandler(device, callback) {
    var topics = [];

    if (mqttClient) {
        for (var i = 0; i < device.active.length; i++) {
            topics.push('/' + config.mqtt.defaultKey + '/' + device.id + '/attributes/' + device.active[i].name);
        }

        topics.push('/' + config.mqtt.defaultKey + '/' + device.id + '/attributes');

        mqttClient.subscribe(topics);

        callback(null, device);
    } else {
        callback();
    }
}

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

            callback(null);
        }
    });
}

function stop(callback) {
    iotAgentLib.deactivate(callback);
}

exports.start = start;
exports.stop = stop;
