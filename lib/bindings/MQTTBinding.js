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

/* eslint-disable consistent-return */
/* eslint-disable no-unused-vars */

const fs = require('fs');
const iotAgentLib = require('iotagent-node-lib');
const mqtt = require('mqtt');
const commonBindings = require('../commonBindings');
const fillService = iotAgentLib.fillService;
const async = require('async');
const iotaUtils = require('../iotaUtils');
const constants = require('../constants');
let context = {
    op: 'IOTAJSON.MQTT.Binding'
};
let mqttClient;
let mqttConn;
const config = require('../configService');

/**
 * Generate the list of global topics to listen to.
 */
function generateTopics(callback) {
    const topics = [];

    config.getLogger().debug(context, 'Generating topics');

    // With leading slashes
    topics.push(constants.MQTT_SHARE_SUBSCRIPTION_GROUP + '/+/+/' + constants.MEASURES_SUFIX + '/+');
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            '/' +
            constants.MQTT_TOPIC_PROTOCOL +
            '/+/+/' +
            constants.MEASURES_SUFIX +
            '/+'
    );
    topics.push(constants.MQTT_SHARE_SUBSCRIPTION_GROUP + '/+/+/' + constants.MEASURES_SUFIX);
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            '/' +
            constants.MQTT_TOPIC_PROTOCOL +
            '/+/+/' +
            constants.MEASURES_SUFIX
    );
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            '/+/+/' +
            constants.CONFIGURATION_SUFIX +
            '/' +
            constants.CONFIGURATION_COMMAND_SUFIX
    );
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            '/' +
            constants.MQTT_TOPIC_PROTOCOL +
            '/+/+/' +
            constants.CONFIGURATION_SUFIX +
            '/' +
            constants.CONFIGURATION_COMMAND_SUFIX
    );
    topics.push(constants.MQTT_SHARE_SUBSCRIPTION_GROUP + '/+/+/' + constants.CONFIGURATION_COMMAND_UPDATE);
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            '/' +
            constants.MQTT_TOPIC_PROTOCOL +
            '/+/+/' +
            constants.CONFIGURATION_COMMAND_UPDATE
    );

    //Without leading slashes
    topics.push(constants.MQTT_SHARE_SUBSCRIPTION_GROUP + '/+/+/' + constants.MEASURES_SUFIX + '/+');
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            constants.MQTT_TOPIC_PROTOCOL +
            '/+/+/' +
            constants.MEASURES_SUFIX +
            '/+'
    );
    topics.push(constants.MQTT_SHARE_SUBSCRIPTION_GROUP + '/+/+/' + constants.MEASURES_SUFIX);
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP + constants.MQTT_TOPIC_PROTOCOL + '/+/+/' + constants.MEASURES_SUFIX
    );
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            '/+/+/' +
            constants.CONFIGURATION_SUFIX +
            '/' +
            constants.CONFIGURATION_COMMAND_SUFIX
    );
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            constants.MQTT_TOPIC_PROTOCOL +
            '/+/+/' +
            constants.CONFIGURATION_SUFIX +
            '/' +
            constants.CONFIGURATION_COMMAND_SUFIX
    );
    topics.push(constants.MQTT_SHARE_SUBSCRIPTION_GROUP + '/+/+/' + constants.CONFIGURATION_COMMAND_UPDATE);
    topics.push(
        constants.MQTT_SHARE_SUBSCRIPTION_GROUP +
            constants.MQTT_TOPIC_PROTOCOL +
            '/+/+/' +
            constants.CONFIGURATION_COMMAND_UPDATE
    );

    callback(null, topics);
}

/**
 * Recreate the MQTT subscriptions for all the registered devices.
 */
function recreateSubscriptions(callback) {
    context = fillService(context, { service: 'n/a', subservice: 'n/a' });
    config.getLogger().debug(context, 'Recreating subscriptions for all devices');

    function subscribeToTopics(topics, callback) {
        config.getLogger().debug(context, 'Subscribing to topics: %j', topics);
        const options = {};
        mqttClient.subscribe(topics, options, function (error) {
            if (error) {
                iotAgentLib.alarms.raise(constants.MQTTB_ALARM, error);
                config.getLogger().error(context, 'GLOBAL-001: Error subscribing to topics: %s', error);
                callback(error);
            } else {
                iotAgentLib.alarms.release(constants.MQTTB_ALARM);
                config.getLogger().info(context, 'Successfully subscribed to the following topics:\n%j\n', topics);
                if (callback) {
                    callback(null);
                }
            }
        });
    }

    async.waterfall([generateTopics, subscribeToTopics], callback);
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
    const configurations = iotaUtils.createConfigurationNotification(results);
    const options = {};
    context = fillService(context, { service: 'n/a', subservice: 'n/a' });
    if (config.getConfig().mqtt.qos) {
        options.qos = parseInt(config.getConfig().mqtt.qos) || 0;
    }
    if (config.getConfig().mqtt.retain === true) {
        options.retain = config.getConfig().mqtt.retain;
    }
    config.getLogger().debug(context, 'Sending requested configuration to the device:\n %j', configurations);
    const leadingSlash = config.getConfig().mqtt.avoidLeadingSlash ? '' : '/';

    const commandTopic =
        leadingSlash +
        apiKey +
        '/' +
        deviceId +
        '/' +
        constants.CONFIGURATION_SUFIX +
        '/' +
        constants.CONFIGURATION_VALUES_SUFIX;
    //prettier-ignore
    if (mqttClient.connected) {
        mqttClient.publish(
            commandTopic,
            JSON.stringify(configurations),
            options,
            (error) => {
                if (error) {
                    config
                        .getLogger()
                        .error(
                            context,
                            'Error %j in Configuration:\n %j sent to the device %s with mqtt options %j',
                            error,
                            JSON.stringify(configurations),
                            commandTopic,
                            options
                        );
                }
            });
        config.getLogger().info(context, 'Configuration:\n %j was sent to the device: %s', configurations, commandTopic);
    } else {
        config.getLogger().error(context, 'Configuration:\n %j was not set to the device: %s due to not connected', configurations, commandTopic);
    }
    callback();
}

/**
 * Unsubscribe the MQTT Client from all the topics.
 */
function unsubscribeAll(callback) {
    function unsubscribeFromTopics(topics, callback) {
        mqttClient.unsubscribe(topics, null);

        callback();
    }

    async.waterfall([generateTopics, unsubscribeFromTopics], callback);
}

/**
 * Start the binding.
 */
function start(callback) {
    context = fillService(context, { service: 'n/a', subservice: 'n/a' });
    const mqttConfig = config.getConfig().mqtt;
    if (!mqttConfig) {
        return config.getLogger().error(context, 'Error MQTT is not configured');
    }
    if (mqttConfig.disabled) {
        return config.getLogger().warn(context, 'MQTT is disabled');
    }
    const rejectUnauthorized =
        typeof mqttConfig.rejectUnauthorized === 'boolean' ? mqttConfig.rejectUnauthorized : true;
    let rndSuffix = '_' + Math.random().toString(16).substr(2, 8);
    const options = {
        protocol: mqttConfig.protocol ? mqttConfig.protocol : 'mqtt',
        host: mqttConfig.host ? mqttConfig.host : 'localhost',
        port: mqttConfig.port ? mqttConfig.port : 1883,
        key: mqttConfig.key ? fs.readFileSync(mqttConfig.key, 'utf8') : null,
        ca: mqttConfig.ca ? fs.readFileSync(mqttConfig.ca, 'utf8') : null,
        cert: mqttConfig.cert ? fs.readFileSync(mqttConfig.cert, 'utf8') : null,
        rejectUnauthorized,
        username: mqttConfig.username ? mqttConfig.username : null,
        password: mqttConfig.password ? mqttConfig.password : null,
        clean: typeof mqttConfig.clean === 'boolean' ? mqttConfig.clean : true,
        clientId: mqttConfig.clientId ? mqttConfig.clientId + rndSuffix : 'iotajson' + rndSuffix,
        keepalive: mqttConfig.keepalive ? parseInt(mqttConfig.keepalive) : 60,
        connectTimeout: 60 * 60 * 1000
    };

    const retries = mqttConfig.retries ? mqttConfig.retries : constants.MQTT_DEFAULT_RETRIES;
    const retryTime = mqttConfig.retryTime ? mqttConfig.retryTime : constants.MQTT_DEFAULT_RETRY_TIME;
    let isConnecting = false;
    let numRetried = 1; // retries will be disabled when MQTT_DEFAULT_RETRIES=0
    config
        .getLogger()
        .info(context, 'Starting MQTT binding with options %j retries %s retryTIme %s', options, retries, retryTime);

    function createConnection(callback) {
        config.getLogger().debug(context, 'creating connection');
        if (isConnecting) {
            return;
        }
        isConnecting = true;
        // Ensure clientId is unique when reconnect to avoid loop closing old connection which the same name
        rndSuffix = '_' + Math.random().toString(16).substr(2, 8);
        options.clientId = mqttConfig.clientId ? mqttConfig.clientId + rndSuffix : 'iotajson' + rndSuffix;
        mqttClient = mqtt.connect(options.protocol + '://' + mqttConfig.host + ':' + mqttConfig.port, options);
        isConnecting = false;
        if (!mqttClient) {
            config.getLogger().error(context, 'error mqttClient not created');
            if (numRetried <= retries) {
                numRetried++;
                return setTimeout(createConnection, retryTime * 1000, callback);
            }
        }
        mqttClient.on('error', function (e) {
            /*jshint quotmark: double */
            config.getLogger().fatal("GLOBAL-002: Couldn't connect with MQTT broker: %j", e);
            /*jshint quotmark: single */
            mqttClient.end();
        });
        mqttClient.on('message', commonBindings.mqttMessageHandler);
        mqttClient.on('connect', function (ack) {
            config.getLogger().info(context, 'MQTT Client connected');
            recreateSubscriptions();
            numRetried = 1;
        });
        mqttClient.on('reconnect', function () {
            config.getLogger().debug(context, 'MQTT Client reconnect');
        });
        mqttClient.on('offline', function () {
            config.getLogger().debug(context, 'MQTT Client offline');
        });
        mqttClient.on('close', function () {
            config.getLogger().info(context, 'MQTT Client closed');
            // If mqttConn is null, the connection has been closed on purpose
            if (mqttConn) {
                config.getLogger().debug(context, 'MQTT Client closed connected? %s', mqttClient.connected);
                if (!mqttClient.connected && numRetried <= retries) {
                    config.getLogger().warn(context, 'reconnecting #%s...', numRetried);
                    numRetried++;
                    return setTimeout(createConnection, retryTime * 1000);
                }
            } else {
                // Do nothing
            }
        });
        config.getLogger().info(context, 'connected');
        mqttConn = mqttClient;
        if (callback) {
            callback();
        }
    } // function createConnection

    async.waterfall([createConnection], function (error) {
        if (error) {
            config.getLogger().info('MQTT error %j', error);
        }
        callback();
    });
}

/**
 * Device provisioning handler.
 *
 * @param {Object} device           Device object containing all the information about the provisioned device.
 */
function deviceProvisioningHandler(device, callback) {
    callback(null, device);
}

/**
 * Device updating handler.
 *
 * @param {Object} device           Device object containing all the information about the provisioned device.
 */
function deviceUpdatingHandler(device, callback) {
    callback(null, device);
}

/**
 * Stop the binding, releasing its resources.
 */
function stop(callback) {
    config.getLogger().info('Stopping MQTT Binding');

    async.series([unsubscribeAll, mqttClient.end.bind(mqttClient, true)], function () {
        config.getLogger().info('MQTT Binding Stopped');
        if (mqttConn) {
            mqttConn = null;
        }
        callback();
    });
}

/**
 * Execute a command for the device represented by the device object and the given APIKey, sending the serialized
 * JSON payload (already containing the command information).
 *
 * @param {String} apiKey                   APIKey of the device that will be receiving the command.
 * @param {Object} device                   Data object for the device receiving the command.
 * @param {String} serializedPayload        String payload in JSON format for the command.
 */
function executeCommand(apiKey, device, cmdName, serializedPayload, contentType, callback) {
    const options = {};
    // retrieve command mqtt options from device
    const commands = Object.assign({}, ...device.commands.map((c) => ({ [c.name]: c })));

    options.qos =
        commands[cmdName].mqtt && commands[cmdName].mqtt.qos
            ? parseInt(commands[cmdName].mqtt.qos)
            : config.getConfig().mqtt.qos
            ? parseInt(config.getConfig().mqtt.qos)
            : 0;
    options.retain =
        commands[cmdName].mqtt && commands[cmdName].mqtt.retain
            ? commands[cmdName].mqtt.retain
            : config.getConfig().mqtt.retain
            ? config.getConfig().mqtt.retain
            : false;

    const commandTopic = '/' + apiKey + '/' + device.id + '/cmd';
    config
        .getLogger()
        .debug(
            context,
            'Sending command execution to [%s] with payload [%s] and with mqtt options [%j]',
            commandTopic,
            serializedPayload,
            options
        );
    if (mqttClient.connected) {
        mqttClient.publish(commandTopic, serializedPayload, options, (error) => {
            if (error) {
                config
                    .getLogger()
                    .error(
                        context,
                        'Error %j in Cmd:\n %j sent to the device %s with mqtt options %j',
                        error,
                        serializedPayload,
                        commandTopic,
                        options
                    );
            }
        });
        config
            .getLogger()
            .info(
                context,
                'Cmd:\n %j was sent to the device %s with mqtt options %j',
                serializedPayload,
                commandTopic,
                options
            );
    } else {
        config.getLogger().error(context, 'Cmd: not set due to not connected');
    }
    callback();
}

exports.start = start;
exports.stop = stop;
exports.sendConfigurationToDevice = sendConfigurationToDevice;
exports.deviceProvisioningHandler = deviceProvisioningHandler;
exports.deviceUpdatingHandler = deviceUpdatingHandler;
exports.executeCommand = executeCommand;
exports.protocol = 'MQTT';
