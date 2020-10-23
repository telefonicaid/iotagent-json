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
const async = require('async');
const iotaUtils = require('../iotaUtils');
const constants = require('../constants');
const context = {
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
    config.getLogger().debug(context, 'Recreating subscriptions for all devices');

    function subscribeToTopics(topics, callback) {
        config.getLogger().debug(context, 'Subscribing to topics: %j', topics);

        mqttClient.subscribe(topics, null, function (error) {
            if (error) {
                iotAgentLib.alarms.raise(constants.MQTTB_ALARM, error);
                config.getLogger().error(context, 'GLOBAL-001: Error subscribing to topics: %s', error);
                callback(error);
            } else {
                iotAgentLib.alarms.release(constants.MQTTB_ALARM);
                config.getLogger().debug(context, 'Successfully subscribed to the following topics:\n%j\n', topics);
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
    mqttClient.publish(
        commandTopic,
        JSON.stringify(configurations),
        options,
        callback
    );
    config.getLogger().info(context, 'Configuration:\n %j was sent to the device: %s', configurations, commandTopic);
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
    const mqttConfig = config.getConfig().mqtt;
    if (!mqttConfig) {
        return config.getLogger().error(context, 'Error MQTT is not configured');
    }
    const rejectUnauthorized =
        typeof mqttConfig.rejectUnauthorized === 'boolean' ? mqttConfig.rejectUnauthorized : true;
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
        keepalive: mqttConfig.keepalive ? parseInt(mqttConfig.keepalive) : 0,
        connectTimeout: 60 * 60 * 1000
    };

    const retries = mqttConfig.retries ? mqttConfig.retries : constants.MQTT_DEFAULT_RETRIES;
    const retryTime = mqttConfig.retryTime ? mqttConfig.retryTime : constants.MQTT_DEFAULT_RETRY_TIME;
    let isConnecting = false;
    let numRetried = 0;
    config.getLogger().info(context, 'Starting MQTT binding');

    function createConnection(callback) {
        config.getLogger().info(context, 'creating connection');
        if (isConnecting) {
            return;
        }
        isConnecting = true;
        mqttClient = mqtt.connect(options.protocol + '://' + mqttConfig.host + ':' + mqttConfig.port, options);
        //mqttClient = mqtt.connect(options);
        isConnecting = false;
        // TDB: check if error
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
            if (callback) {
                callback(e);
            }
        });
        mqttClient.on('message', commonBindings.mqttMessageHandler);
        mqttClient.on('connect', function (ack) {
            config.getLogger().info(context, 'MQTT Client connected');
            recreateSubscriptions();
        });
        mqttClient.on('close', function () {
            // If mqttConn is null, the connection has been closed on purpose
            if (mqttConn) {
                if (numRetried <= retries) {
                    config.getLogger().warn(context, 'reconnecting...');
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
            config.getLogger().debug('MQTT error %j', error);
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
function executeCommand(apiKey, device, serializedPayload, callback) {
    const options = {};
    options.qos = serializedPayload.mqtt.qos ? serializedPayload.mqtt.qos :
        config.getConfig().mqtt.qos ? parseInt(config.getConfig().mqtt.qos) : 0;
    options.retain = serializedPayload.mqtt.retain ? serializedPayload.mqtt.retain :
        config.getConfig().mqtt.retain ? config.getConfig().mqtt.retain : false;

    config.getLogger().debug(context, 'Sending cmd to the device:\n %j', serializedPayload);
    const commandTopic = '/' + apiKey + '/' + device.id + '/cmd';
    mqttClient.publish(commandTopic, serializedPayload, options);
    config.getLogger().info(context, 'Cmd:\n %j was sent to the device %s', serializedPayload, commandTopic);
    callback();
}

exports.start = start;
exports.stop = stop;
exports.sendConfigurationToDevice = sendConfigurationToDevice;
exports.deviceProvisioningHandler = deviceProvisioningHandler;
exports.executeCommand = executeCommand;
exports.protocol = 'MQTT';
