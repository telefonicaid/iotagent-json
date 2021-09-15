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

const iotAgentLib = require('iotagent-node-lib');
const errors = require('./errors');
const dateFormat = require('dateformat');
const async = require('async');
const apply = async.apply;
const constants = require('./constants');
const context = {
    op: 'IoTAgentJSON.Utils'
};
const config = require('./configService');

/**
 * Get the API Key for the selected service if there is any, or the default API Key if a specific one does not exist.
 *
 * @param {String} service          Name of the service whose API Key we are retrieving.
 * @param {String} subservice       Name of the subservice whose API Key we are retrieving.
 * @param {Json} device             Device object.
 */
function getEffectiveApiKey(service, subservice, device, callback) {
    config.getLogger().debug(context, 'Getting effective API Key');

    if (device && device.apikey) {
        config.getLogger().debug(context, 'Using device apikey: %s', device.apikey);
        callback(null, device.apikey);
    } else {
        iotAgentLib.findConfiguration(service, subservice, function (error, group) {
            if (group) {
                config.getLogger().debug(context, 'Using found group: %j', group);
                callback(null, group.apikey);
            } else if (config.getConfig().defaultKey) {
                config.getLogger().debug(context, 'Using default API Key: %s', config.getConfig().defaultKey);
                callback(null, config.getConfig().defaultKey);
            } else {
                config.getLogger().error(context, 'Could not find any API Key information for device.');
                callback(new errors.GroupNotFound(service, subservice));
            }
        });
    }
}

function manageConfiguration(apiKey, deviceId, device, objMessage, sendFunction, callback) {
    /* eslint-disable no-unused-vars */
    function handleSendConfigurationError(error, results) {
        if (error) {
            config.getLogger().error(
                context,

                "CONFIG-001: Couldn't get the requested values from the Context Broker: %s",

                error
            );
        } else {
            config
                .getLogger()
                .debug(context, 'Configuration attributes sent to the device successfully.', deviceId, apiKey);
        }

        callback(error);
    }

    if (objMessage.type === 'configuration') {
        async.waterfall(
            [
                apply(iotAgentLib.query, device.name, device.type, '', objMessage.fields, device),
                apply(sendFunction, apiKey, deviceId)
            ],
            handleSendConfigurationError
        );
    } else if (objMessage.type === 'subscription') {
        iotAgentLib.subscribe(device, objMessage.fields, objMessage.fields, function (error) {
            if (error) {
                config
                    .getLogger()
                    .error(
                        context,
                        'CONFIG-002: There was an error subscribing device [%s] to attributes [%j]',
                        device.name,
                        objMessage.fields
                    );
            } else {
                config
                    .getLogger()
                    .debug(
                        context,
                        'Successfully subscribed device [%s] to attributes[%j]',
                        device.name,
                        objMessage.fields
                    );
            }

            callback(error);
        });
    } else {
        config.getLogger().error(context, 'CONFIG-003: Unknown command type from device [%s]', device.name);
        callback();
    }
}

function createConfigurationNotification(results) {
    const configurations = {};
    const now = new Date();

    // If it is the result of a subscription, results is an array
    if (Array.isArray(results)) {
        for (let i = 0; i < results.length; i++) {
            configurations[results[i].name] = results[i].value;
        }
    } else {
        for (var att in results) {
            configurations[att] = results[att].value;
        }
    }

    configurations.dt = dateFormat(now, constants.DATE_FORMAT);
    return configurations;
}

function findOrCreate(deviceId, transport, group, callback) {
    iotAgentLib.getDeviceSilently(deviceId, group.service, group.subservice, function (error, device) {
        if (!error && device) {
            callback(null, device, group);
        } else if (error.name === 'DEVICE_NOT_FOUND') {
            const newDevice = {
                id: deviceId,
                service: group.service,
                subservice: group.subservice,
                type: group.type
            };
            if (
                config.getConfig().iota &&
                config.getConfig().iota.iotManager &&
                config.getConfig().iota.iotManager.protocol
            ) {
                newDevice.protocol = config.getConfig().iota.iotManager.protocol;
            }
            // Fix transport depending on binding
            if (!newDevice.transport) {
                newDevice.transport = transport;
            }
            if ('timestamp' in group && group.timestamp !== undefined) {
                newDevice.timestamp = group.timestamp;
            }
            if ('ngsiVersion' in group && group.ngsiVersion !== undefined) {
                newDevice.ngsiVersion = group.ngsiVersion;
            }
            if ('explicitAttrs' in group && group.explicitAttrs !== undefined) {
                newDevice.explicitAttrs = group.explicitAttrs;
            }
            if ('expressionLanguage' in group && group.expressionLanguage !== undefined) {
                newDevice.expressionLanguage = group.expressionLanguage;
            }
            // Check autoprovision flag in order to register or not device
            if (group.autoprovision === undefined || group.autoprovision === true) {
                iotAgentLib.register(newDevice, function (error, device) {
                    callback(error, device, group);
                });
            } else {
                config
                    .getLogger()
                    .info(
                        context,
                        'Device %j not provisioned due autoprovision is disabled by its conf %j',
                        newDevice,
                        group
                    );
                callback(new errors.DeviceNotFound(deviceId));
            }
        } else {
            callback(error);
        }
    });
}

/**
 * Retrieve a device from the device repository based on the given APIKey and DeviceID, creating one if none is
 * found for the given data.
 *
 * @param {String} deviceId         Device ID of the device that wants to be retrieved or created.
 * @param {String} apiKey           APIKey of the Device Group (or default APIKey).
 */
function retrieveDevice(deviceId, apiKey, transport, callback) {
    if (apiKey === config.getConfig().defaultKey) {
        iotAgentLib.getDevicesByAttribute('id', deviceId, null, null, function (error, devices) {
            if (error) {
                callback(error);
            } else if (devices && devices.length === 1) {
                callback(null, devices[0]);
            } else {
                config.getLogger().error(
                    context,

                    "MEASURES-001: Couldn't find device data for APIKey [%s] and DeviceId[%s]",

                    apiKey,
                    deviceId
                );

                callback(new errors.DeviceNotFound(deviceId));
            }
        });
    } else {
        async.waterfall(
            [
                apply(iotAgentLib.getConfigurationSilently, config.getConfig().iota.defaultResource || '', apiKey),
                apply(findOrCreate, deviceId, transport),
                apply(
                    iotAgentLib.mergeDeviceWithConfiguration,
                    ['lazy', 'active', 'staticAttributes', 'commands', 'subscriptions'],
                    [null, null, [], [], [], [], []]
                )
            ],
            callback
        );
    }
}

exports.createConfigurationNotification = createConfigurationNotification;
exports.getEffectiveApiKey = getEffectiveApiKey;
exports.manageConfiguration = manageConfiguration;
exports.retrieveDevice = retrieveDevice;
