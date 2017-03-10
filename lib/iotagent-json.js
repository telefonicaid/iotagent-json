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

'use strict';

var iotAgentLib = require('iotagent-node-lib'),
    transportSelector = require('./transportSelector'),
    commandHandler = require('./commandHandler'),
    iotaUtils = require('./iotaUtils'),
    async = require('async'),
    errors = require('./errors'),
    thinkingThingPlugin = require('./thinkingThingPlugin'),
    apply = async.apply,
    context = {
        op: 'IoTAgentMQTT.Agent'
    },
    config = require('./configService');

/**
 * Handler for incoming notifications for the configuration subscription mechanism.
 *
 * @param {Object} device           Object containing all the device information.
 * @param {Array} updates           List of all the updated attributes.

 */
function configurationNotificationHandler(device, updates, callback) {
    function invokeConfiguration(apiKey, callback) {
        transportSelector.applyFunctionFromBinding(
            [apiKey, device.id, updates],
            'sendConfigurationToDevice',
            device.transport || config.getConfig().defaultTransport,
            callback);
    }

    async.waterfall([
        apply(iotaUtils.getEffectiveApiKey, device.service, device.subservice),
        invokeConfiguration
    ], callback);

}

function configurationHandler(configuration, callback) {
    if (configuration.resource && config.getConfig().iota.iotManager && config.getConfig().iota.defaultResource &&
        configuration.resource !== config.getConfig().iota.defaultResource) {
        callback(new errors.InvalidResource());
    } else {
        callback();
    }}

/**
 * Handles incoming updateContext requests related with lazy attributes. This handler is still just registered,
 * but empty.
 *
 * @param {String} id               ID of the entity for which the update was issued.
 * @param {String} type             Type of the entity for which the update was issued.
 * @param {Array} attributes        List of NGSI attributes to update.
 */
function updateHandler(id, type, attributes, service, subservice, callback) {
    callback();
}

function bidirectionalityNotificationHandler(device, updates, callback) {
    transportSelector.applyFunctionFromBinding([device, updates], 'notificationHandler',
        device.transport || config.getConfig().defaultTransport, callback);
}

/**
 * Calls all the device provisioning handlers for each transport protocol binding whenever a new device is provisioned
 * in the Agent.
 *
 * @param {Object} device           Device provisioning information.
 */
function deviceProvisioningHandler(device, callback) {
    transportSelector.applyFunctionFromBinding([device], 'deviceProvisioningHandler', null, function(error, devices) {
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

    iotAgentLib.activate(config.getConfig().iota, function(error) {
        if (error) {
            callback(error);
        } else {
            config.getLogger().info(context, 'IoT Agent services activated');

            iotAgentLib.setConfigurationHandler(configurationHandler);
            iotAgentLib.setCommandHandler(commandHandler.handler);
            iotAgentLib.setProvisioningHandler(deviceProvisioningHandler);

            iotAgentLib.setDataUpdateHandler(updateHandler);
            iotAgentLib.addUpdateMiddleware(iotAgentLib.dataPlugins.attributeAlias.update);
            iotAgentLib.addUpdateMiddleware(iotAgentLib.dataPlugins.addEvents.update);

            if (config.getConfig().iota && config.getConfig().iota.compressTimestamp) {
                iotAgentLib.addUpdateMiddleware(iotAgentLib.dataPlugins.compressTimestamp.update);
                iotAgentLib.addQueryMiddleware(iotAgentLib.dataPlugins.compressTimestamp.query);
            }

            if (config.getConfig().mqtt.thinkingThingsPlugin) {
                iotAgentLib.addUpdateMiddleware(thinkingThingPlugin.updatePlugin);
            }

            iotAgentLib.addUpdateMiddleware(iotAgentLib.dataPlugins.expressionTransformation.update);
            iotAgentLib.addUpdateMiddleware(iotAgentLib.dataPlugins.multiEntity.update);
            iotAgentLib.addUpdateMiddleware(iotAgentLib.dataPlugins.timestampProcess.update);

            iotAgentLib.addDeviceProvisionMiddleware(iotAgentLib.dataPlugins.bidirectionalData.deviceProvision);
            iotAgentLib.addConfigurationProvisionMiddleware(iotAgentLib.dataPlugins.bidirectionalData.groupProvision);
            iotAgentLib.addNotificationMiddleware(iotAgentLib.dataPlugins.bidirectionalData.notification);

            if (config.getConfig().configRetrieval) {
                iotAgentLib.setNotificationHandler(configurationNotificationHandler);
            } else {
                iotAgentLib.setNotificationHandler(bidirectionalityNotificationHandler);
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
    async.series([
        transportSelector.stopTransportBindings,
        iotAgentLib.resetMiddlewares,
        iotAgentLib.deactivate
    ], callback);
}

exports.start = start;
exports.stop = stop;
