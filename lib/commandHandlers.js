/*
 * Copyright 2016 Telefonica Investigación y Desarrollo, S.A.U
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

var async = require('async'),
    logger = require('logops'),
    iotAgentLib = require('iotagent-node-lib'),
    mqttClient;

/**
 * Generate a function that executes the given command in the device.
 *
 * @param {String} apiKey           APIKey of the device's service or default APIKey.
 * @param {Object} device           Object containing all the information about a device.
 * @param {Object} attribute        Attribute in NGSI format.
 * @return {Function}               Command execution function ready to be called with async.series.
 */
function generateCommandExecution(apiKey, device, attribute) {
    var payload = {},
        serialized;

    payload[attribute.name] = attribute.value;
    serialized = JSON.stringify(payload);

    logger.debug('Sending command execution to device [%s] with apikey [%s] and payload [%s] ',
        apiKey, device.id, attribute);

    return mqttClient.publish.bind(mqttClient, '/' + apiKey + '/' + device.id + '/cmd', serialized, null);
}

/**
 * Handles a command execution request coming from the Context Broker. This handler should:
 *  - Identify the device affected by the command.
 *  - Send the command to the appropriate MQTT topic.
 *  - Update the command status in the Context Broker.
 *
 * @param {String} id               ID of the entity for which the command execution was issued.
 * @param {String} type             Type of the entity for which the command execution was issued.
 * @param {String} service          Service ID.
 * @param {String} subservice       Subservice ID.
 * @param {Array} attributes        List of NGSI attributes of type command to execute.
 */
function commandHandler(id, type, service, subservice, attributes, callback) {
    logger.debug('Handling MQTT command for device [%s] in service [%s - %s]', id, service, subservice);

    iotAgentLib.getDeviceByName(id, service, subservice, function(error, device) {
        if (error) {
            logger.error('Command execution could not be handled, as device for entity [%s] [%s] wasn\'t found',
                id, type);
            callback(error);
        } else {
            iotAgentLib.getEffectiveApiKey(device.service, device.subservice, device.type, function(error, apiKey) {
                if (error) {
                    callback(error);
                } else {
                    async.series(attributes.map(generateCommandExecution.bind(null, apiKey, device)), callback);
                }
            });
        }
    });
}

function init(newMqttClient) {
    mqttClient = newMqttClient;
}

exports.handler = commandHandler;
exports.init = init;
