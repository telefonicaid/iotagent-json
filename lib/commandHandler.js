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

const async = require('async');
const iotAgentLib = require('iotagent-node-lib');
const iotaUtils = require('./iotaUtils');
const constants = require('./constants');
const transportSelector = require('./transportSelector');
const config = require('./configService');
const context = {
    op: 'IoTAgentJSON.Commands'
};

/**
 * Serializes a payload for a command depending on its payloadType if provided
 *
 * @param {String} payload          Payload to serialized
 * @param {Object} command          Command attribute
 * @return {Function}               Returns a serialized payload
 */
function serializedPayloadCommand(payload, command) {
    let serialized;
    if (command && command.payloadType) {
        switch (command.payloadType.toLowerCase()) {
            case 'binaryfromstring':
                serialized = Buffer.from(payload.toString());
                break;
            case 'binaryfromhex':
                serialized = Buffer.from(payload, 'HEX');
                break;
            case 'binaryfromjson': // used by AMQP transport
                serialized = Buffer.from(JSON.stringify(payload));
                break;
            case 'json': // passthrough
            default:
                serialized = JSON.stringify(payload);
        }
    } else {
        serialized = JSON.stringify(payload);
    }
    return serialized;
}

/**
 * Generate a function that executes the given command in the device.
 *
 * @param {String} apiKey           APIKey of the device's service or default APIKey.
 * @param {Object} device           Object containing all the information about a device.
 * @param {Object} attribute        Attribute in NGSI format.
 * @return {Function}               Command execution function ready to be called with async.series.
 */
function generateCommandExecution(apiKey, device, attribute) {
    let payload = {};
    let command = device && device.commands.find((att) => att.name === attribute.name);
    if (command && command.expression) {
        let parser = iotAgentLib.dataPlugins.expressionTransformation;
        let ctxt = parser.extractContext(device.staticAttributes.concat(attribute), device);
        // expression result will be the full command payload
        payload = parser.applyExpression(command.expression, ctxt, device);
    } else {
        payload[attribute.name] = attribute.value;
    }
    if (device.transport === 'AMQP') {
        // to ensure backward compability
        command.payloadType = command.payloadType ? command.payloadType : 'binaryfromjson';
    }
    const serialized = serializedPayloadCommand(payload, command);
    const contentType = command && command.contentType ? command.contentType : 'application/json';
    config
        .getLogger()
        .debug(
            context,
            'Sending command execution to device [%s] with apikey [%s] and payload [%j] ',
            device.id,
            apiKey,
            payload
        );

    const executions = transportSelector.createExecutionsForBinding(
        [apiKey, device, attribute.name, serialized, contentType],
        'executeCommand',
        device.transport
    );

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
    config
        .getLogger()
        .debug(
            context,
            'Handling command %j for device [%s] in service [%s - %s]',
            attributes,
            id,
            service,
            subservice
        );

    function concat(previous, current) {
        previous = previous.concat(current);
        return previous;
    }

    iotAgentLib.getDeviceByNameAndType(id, type, service, subservice, function (error, device) {
        if (error) {
            config.getLogger().error(
                context,

                "COMMAND-001: Command execution could not be handled, as device for entity [%s] [%s] wasn't found",

                id,
                type
            );
            callback(error);
        } else {
            iotaUtils.getEffectiveApiKey(device.service, device.subservice, device, function (error, apiKey) {
                if (error) {
                    callback(error);
                } else {
                    async.series(
                        attributes.map(generateCommandExecution.bind(null, apiKey, device)).reduce(concat, []),
                        callback
                    );
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
    const commandList = Object.keys(messageObj);
    const commandUpdates = [];

    for (let i = 0; i < commandList.length; i++) {
        commandUpdates.push(
            async.apply(
                iotAgentLib.setCommandResult,
                device.name,
                config.getConfig().iota.defaultResource,
                apiKey,
                commandList[i],
                messageObj[commandList[i]],
                constants.COMMAND_STATUS_COMPLETED,
                device
            )
        );
    }

    async.series(commandUpdates, function (error) {
        if (error) {
            config.getLogger().error(
                context,

                "COMMANDS-002: Couldn't update command status in the Context broker " +
                    'for device [%s] with apiKey [%s]: %s',
                device.id,
                apiKey,
                error
            );
        } else {
            config
                .getLogger()
                .debug(
                    context,
                    'Single measure for device [%s] with apiKey [%s] successfully updated',
                    device.id,
                    apiKey
                );
        }
    });
}

exports.generateCommandExecution = generateCommandExecution;
exports.updateCommand = updateCommand;
exports.handler = commandHandler;
