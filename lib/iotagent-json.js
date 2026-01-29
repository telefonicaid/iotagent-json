/*
 * Copyright 2015 Telefonica Investigación y Desarrollo, S.A.U
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
const transportSelector = require('./transportSelector');
const commandHandler = require('./commandHandler');
const iotaUtils = require('./iotaUtils');
const async = require('async');
const errors = require('./errors');
const apply = async.apply;
const context = {
    op: 'IoTAgentJSON.Agent'
};
const config = require('./configService');

/**
 * Handler for incoming notifications for the configuration subscription mechanism.
 *
 * @param {Object} device           Object containing all the device information.
 * @param {Array} updates           List of all the updated attributes.

 */
function configurationNotificationHandler(device, updates, callback) {
    config.getLogger().debug(context, 'configurationNotificationHandler command %j and device %j', updates, device);
    function invokeConfiguration(apiKey, callback) {
        let group = {};
        iotAgentLib.getConfigurationSilently(config.getConfig().iota.defaultResource || '', apiKey, function (
            error,
            foundGroup
        ) {
            if (!error) {
                group = foundGroup;
            }

            transportSelector.applyFunctionFromBinding(
                [apiKey, group, device.id, updates],
                'sendConfigurationToDevice',
                device.transport ||
                    (group && group.transport ? group.transport : undefined) ||
                    config.getConfig().defaultTransport,
                callback
            );
        });
    }

    async.waterfall(
        [apply(iotaUtils.getEffectiveApiKey, device.service, device.subservice, device), invokeConfiguration],
        callback
    );
}

function configurationHandler(configuration, callback) {
    if (
        configuration.resource &&
        config.getConfig().iota.iotManager &&
        config.getConfig().iota.defaultResource &&
        configuration.resource !== config.getConfig().iota.defaultResource
    ) {
        callback(new errors.InvalidResource());
    } else {
        callback();
    }
}

/**
 * Calls all the command execution handlers for each transport protocol binding whenever a new notification request
 * arrives from the Context Broker.
 *
 * @param {Object} device               Device data object containing all stored information about the device.
 * @param {Array} values                Values recieved in the notification.
 */
function notificationHandler(device, values, callback) {
    config.getLogger().debug(context, 'notificationHandler command %j and device %j', values, device);
    function invokeWithConfiguration(apiKey, callback) {
        let group = {};
        iotAgentLib.getConfigurationSilently(config.getConfig().iota.defaultResource || '', apiKey, function (
            error,
            foundGroup
        ) {
            if (!error) {
                group = foundGroup;
            }
            transportSelector.applyFunctionFromBinding(
                [device, values],
                'notificationHandler',
                device.transport ||
                    (group && group.transport ? group.transport : undefined) ||
                    config.getConfig().defaultTransport,
                callback
            );
        });
    }

    async.waterfall(
        [apply(iotaUtils.getEffectiveApiKey, device.service, device.subservice, device), invokeWithConfiguration],
        callback
    );
}

/**
 * Handles incoming updateContext requests related with lazy attributes. This handler is still just registered,
 * but empty.
 *
 * @param {String} id               ID of the entity for which the update was issued.
 * @param {String} type             Type of the entity for which the update was issued.
 * @param {Array} attributes        List of NGSI attributes to update.
 */
function updateHandler(id, type, attributes, service, subservice, callback) {
    config.getLogger().debug(context, 'updateHandler');
    callback();
}

/**
 * Calls all the device provisioning handlers for each transport protocol binding whenever a new device is provisioned
 * in the Agent.
 *
 * @param {Object} device           Device provisioning information.
 */
function deviceProvisioningHandler(device, callback) {
    config.getLogger().debug(context, 'deviceProvisioningHandler for device %j', device);
    transportSelector.applyFunctionFromBinding([device], 'deviceProvisioningHandler', null, function (error, devices) {
        if (error) {
            callback(error);
        } else {
            callback(null, devices[0]);
        }
    });
}

/**
 * Calls all the device updating handlers for each transport protocol binding whenever a device is updated
 * in the Agent.
 *
 * @param {Object} device           Device updating information.
 */
function deviceUpdatingHandler(newDevice, oldDevice, callback) {
    config.getLogger().debug(context, 'deviceUpdatingHandler for newDevice %j oldDevice %j', newDevice, oldDevice);
    transportSelector.applyFunctionFromBinding([newDevice, oldDevice], 'deviceUpdatingHandler', null, function (
        error,
        devices
    ) {
        if (error) {
            callback(error);
        } else {
            callback(null, devices[0]);
        }
    });
}

/**
 * Starts the IOTA with the given configuration.
 *
 * @param {Object} newConfig        New configuration object.
 */
function start(newConfig, callback) {
    config.setLogger(iotAgentLib.logModule);
    config.setConfig(newConfig);

    iotAgentLib.activate(config.getConfig().iota, function (error) {
        if (error) {
            callback(error);
        } else {
            config.getLogger().info(context, 'IoT Agent services activated');
            //append config JEXL transformation to built in transformations
            iotAgentLib.dataPlugins.expressionTransformation.setJEXLTransforms(newConfig.extraJexlTransformations);

            iotAgentLib.setConfigurationHandler(configurationHandler);
            iotAgentLib.setCommandHandler(commandHandler.handler);
            iotAgentLib.setProvisioningHandler(deviceProvisioningHandler);
            iotAgentLib.setUpdatingHandler(deviceUpdatingHandler);
            iotAgentLib.setDataUpdateHandler(updateHandler);

            if (config.getConfig().configRetrieval === true) {
                iotAgentLib.setNotificationHandler(configurationNotificationHandler);
            } else {
                iotAgentLib.setNotificationHandler(notificationHandler);
            }

            transportSelector.startTransportBindings(newConfig, callback);
        }
    });
}

/**
 * Stops the current IoT Agent.
 *
 */
function stop(callback) {
    config.getLogger().info(context, 'Stopping IoT Agent');
    async.series(
        [transportSelector.stopTransportBindings, iotAgentLib.resetMiddlewares, iotAgentLib.deactivate],
        callback
    );
}

/**
 * Shuts down the IoT Agent in a graceful manner
 *
 */
function handleShutdown(signal) {
    config.getLogger().info(context, 'Received %s, starting shutdown processs', signal);
    stop((err) => {
        if (err) {
            config.getLogger().error(context, err);
            return process.exit(1);
        }
        return process.exit(0);
    });
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
process.on('SIGHUP', handleShutdown);

exports.start = start;
exports.stop = stop;
