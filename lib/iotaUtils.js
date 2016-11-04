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
    errors = require('./errors'),
    dateFormat = require('dateformat'),
    async = require('async'),
    apply = async.apply,
    constants = require('./constants'),
    context = {
        op: 'IoTAgentMQTT.Utils'
    },
    config = require('./configService');

/**
 * Get the API Key for the selected service if there is any, or the default API Key if a specific one does not exist.
 *
 * @param {String} service          Name of the service whose API Key we are retrieving.
 * @param {String} subservice       Name of the subservice whose API Key we are retrieving.
 */
function getEffectiveApiKey(service, subservice, callback) {
    config.getLogger().debug(context, 'Getting effective API Key');

    iotAgentLib.findConfiguration(service, subservice, function(error, group) {
        if (group) {
            config.getLogger().debug(context, 'Using found group: %j', group);
            callback(null, group.apikey);
        } else if (config.getConfig().mqtt.defaultKey) {
            config.getLogger().debug(context, 'Using default API Key: %s', config.getConfig().mqtt.defaultKey);
            callback(null, config.getConfig().mqtt.defaultKey);
        } else {
            config.getLogger().ierror(context, 'Could not find any API Key information for device.');
            callback(new errors.GroupNotFound(service, subservice));
        }
    });
}

function manageConfiguration(apiKey, deviceId, device, objMessage, sendFunction, callback) {
    function handleSendConfigurationError(error, results) {
        if (error) {
            config.getLogger().error(context,
                'CONFIG-001: Couldn\'t get the requested values from the Context Broker: %s', error);
        } else {
            config.getLogger().debug(context, 'Configuration attributes sent to the device successfully.',
                deviceId, apiKey);
        }

        callback(error);
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
            apply(sendFunction, apiKey, deviceId)
        ], handleSendConfigurationError);
    } else if (objMessage.type === 'subscription') {
        iotAgentLib.subscribe(device, objMessage.fields, objMessage.fields, function(error) {
            if (error) {
                config.getLogger().error(
                    context,
                    'CONFIG-002: There was an error subscribing device [%s] to attributes [%j]',
                    device.name, objMessage.fields);
            } else {
                config.getLogger().debug(context, 'Successfully subscribed device [%s] to attributes[%j]',
                    device.name, objMessage.fields);
            }

            callback(error);
        });
    } else {
        config.getLogger().error(context, 'CONFIG-003: Unknown command type from device [%s]', device.name);
        callback();
    }
}

function createConfigurationNotification(results) {
    var configurations = {},
        now = new Date();

    for (var i = 0; i < results.length; i++) {
        configurations[results[i].name] =
            results[i].value;
    }

    configurations.dt = dateFormat(now, constants.DATE_FORMAT);
    return configurations;
}

exports.createConfigurationNotification = createConfigurationNotification;
exports.getEffectiveApiKey = getEffectiveApiKey;
exports.manageConfiguration = manageConfiguration;
