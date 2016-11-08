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

var async = require('async'),
    iotAgentLib = require('iotagent-node-lib'),
    constants = require('./constants'),
    transportSelector = require('./transportSelector'),
    config = require('./configService'),
    context = {
        op: 'IoTAgentMQTT.Commands'
    };

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
        serialized,
        executions;

    payload[attribute.name] = attribute.value;
    serialized = JSON.stringify(payload);

    config.getLogger().debug(context, 'Sending command execution to device [%s] with apikey [%s] and payload [%s] ',
        apiKey, device.id, attribute);

    executions = transportSelector.createExecutionsForBinding(
        [apiKey, device, serialized], 'executeCommand', device.transport);

    return executions;
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
    config.getLogger().debug(context,
        'Handling MQTT command for device [%s] in service [%s - %s]', id, service, subservice);

    function concat(previous, current) {
        previous = previous.concat(current);
        return previous;
    }

    iotAgentLib.getDeviceByName(id, service, subservice, function(error, device) {
        if (error) {
            config.getLogger().error(context,
                'COMMAND-001: Command execution could not be handled, as device for entity [%s] [%s] wasn\'t found',
                id, type);
            callback(error);
        } else {
            iotAgentLib.getEffectiveApiKey(device.service, device.subservice, device.type, function(error, apiKey) {
                if (error) {
                    callback(error);
                } else {
                    async.series(attributes
                        .map(generateCommandExecution.bind(null, apiKey, device))
                        .reduce(concat, []),
                        callback);
                }
            });
        }
    });
}

/**
 * Process an update in the state of a command with information coming from the device.
 *
 * @param {String} apiKey           API Key corresponding to the Devices configuration.
 * @param {String} deviceId         Id of the device to be updated.
 * @param {Object} device           Device object containing all the information about a device.
 * @param {Object} messageObj       JSON object sent using MQTT.
 */
function updateCommand(apiKey, deviceId, device, messageObj) {
    var commandList = Object.keys(messageObj),
        commandUpdates = [];

    for (var i = 0; i < commandList.length; i++) {
        commandUpdates.push(
            async.apply(iotAgentLib.setCommandResult,
                device.name,
                config.getConfig().iota.defaultResource,
                apiKey,
                commandList[i],
                messageObj[commandList[i]],
                constants.COMMAND_STATUS_COMPLETED,
                device)
        );
    }

    async.series(commandUpdates, function(error) {
        if (error) {
            config.getLogger().error(context,
                'COMMANDS-002: Couldn\'t update command status in the Context broker ' +
                'for device [%s] with apiKey [%s]: %s',
                device.id, apiKey, error);
        } else {
            config.getLogger().debug(context, 'Single measure for device [%s] with apiKey [%s] successfully updated',
                device.id, apiKey);
        }
    });
}

exports.generateCommandExecution = generateCommandExecution;
exports.updateCommand = updateCommand;
exports.handler = commandHandler;
