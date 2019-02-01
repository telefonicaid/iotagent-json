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

var config = {},
    logger = require('logops');
    securityService,
    context = {
        op: 'IoTAgentNGSI.CommonConfig'
    };


function anyIsSet(variableSet) {
    for (var i = 0; i < variableSet.length; i++) {
        if (process.env[variableSet[i]]) {
            return true;
        }
    }

    return false;
}

function processEnvironmentVariables() {
    var environmentVariables = [
            'IOTA_MQTT_HOST',
            'IOTA_MQTT_PORT',
            'IOTA_MQTT_USERNAME',
            'IOTA_MQTT_PASSWORD',
            'IOTA_MQTT_QOS',
            'IOTA_MQTT_RETAIN',
            'IOTA_AMQP_HOST',
            'IOTA_AMQP_PORT',
            'IOTA_AMQP_USERNAME',
            'IOTA_AMQP_PASSWORD',
            'IOTA_AMQP_EXCHANGE',
            'IOTA_AMQP_QUEUE',
            'IOTA_AMQP_DURABLE',
            'IOTA_AMQP_RETRIES',
            'IOTA_AMQP_RETRY_TIME',
            'IOTA_HTTP_HOST',
            'IOTA_HTTP_PORT',
            'IOTA_HTTP_TIMEOUT',
            'IOTA_CB_URL',
            'IOTA_CB_HOST',
            'IOTA_CB_PORT',
            'IOTA_MONGO_HOST',
            'IOTA_MONGO_PORT',
            'IOTA_AUTH_ENABLED',
            'IOTA_AUTH_TYPE',
            'IOTA_AUTH_HEADER',
            'IOTA_AUTH_HOST',
            'IOTA_AUTH_PORT',
            'IOTA_AUTH_USER',
            'IOTA_AUTH_PASSWORD',
            'IOTA_AUTH_PERMANENT_TOKEN',
            'IOTA_NORTH_HOST'
        ],
        mqttVariables = [
            'IOTA_MQTT_HOST',
            'IOTA_MQTT_PORT',
            'IOTA_MQTT_USERNAME',
            'IOTA_MQTT_PASSWORD',
            'IOTA_MQTT_QOS',
            'IOTA_MQTT_RETAIN'
        ],
        amqpVariables = [
            'IOTA_AMQP_HOST',
            'IOTA_AMQP_PORT',
            'IOTA_AMQP_USERNAME',
            'IOTA_AMQP_PASSWORD',
            'IOTA_AMQP_EXCHANGE',
            'IOTA_AMQP_QUEUE',
            'IOTA_AMQP_DURABLE',
            'IOTA_AMQP_RETRIES',
            'IOTA_AMQP_RETRY_TIME',
        ],
        httpVariables = [
            'IOTA_HTTP_HOST',
            'IOTA_HTTP_PORT',
            'IOTA_HTTP_TIMEOUT'
        ],
        mongoVariables = [
            'IOTA_MONGO_HOST',
            'IOTA_MONGO_PORT'
        ],
        cbVariables = [
            'IOTA_CB_HOST',
            'IOTA_CB_PORT'
        ],

        iotamVariables = [
            'IOTA_IOTAM_HOST'
        ];


    for (var i = 0; i < environmentVariables.length; i++) {
        if (process.env[environmentVariables[i]]) {
            logger.info('Setting %s to environment value: %s',
                environmentVariables[i], process.env[environmentVariables[i]]);
        }
    }

    if (anyIsSet(mqttVariables)) {
        config.mqtt = {};
    }

    if (process.env.IOTA_MQTT_HOST) {
        config.mqtt.host = process.env.IOTA_MQTT_HOST;
    }

    if (process.env.IOTA_MQTT_PORT) {
        config.mqtt.port = process.env.IOTA_MQTT_PORT;
    }

    if (process.env.IOTA_MQTT_USERNAME) {
        config.mqtt.username = process.env.IOTA_MQTT_USERNAME;
    }

    if (process.env.IOTA_MQTT_PASSWORD) {
        config.mqtt.password = process.env.IOTA_MQTT_PASSWORD;
    }

    if (process.env.IOTA_MQTT_QOS) {
        config.mqtt.qos = process.env.IOTA_MQTT_QOS;
    }

    if (process.env.IOTA_MQTT_RETAIN) {
        config.mqtt.retain = process.env.IOTA_MQTT_RETAIN === 'true';
    }

    if (anyIsSet(amqpVariables)) {
        config.amqp = {};
    }

    if (process.env.IOTA_AMQP_HOST) {
        config.amqp.host = process.env.IOTA_AMQP_HOST;
    }

    if (process.env.IOTA_AMQP_PORT) {
        config.amqp.port = process.env.IOTA_AMQP_PORT;
    }

    if (process.env.IOTA_AMQP_USERNAME) {
        config.amqp.username = process.env.IOTA_AMQP_USERNAME;
    }

    if (process.env.IOTA_AMQP_PASSWORD) {
        config.amqp.password = process.env.IOTA_AMQP_PASSWORD;
    }

    if (process.env.IOTA_AMQP_EXCHANGE) {
        config.amqp.exchange = process.env.IOTA_AMQP_EXCHANGE;
    }

    if (process.env.IOTA_AMQP_QUEUE) {
        config.amqp.queue = process.env.IOTA_AMQP_QUEUE;
    }

    if (process.env.IOTA_AMQP_DURABLE) {
        config.amqp.options = {};
        config.amqp.options.durable = process.env.IOTA_AMQP_DURABLE === 'true';
    }

    if (process.env.IOTA_AMQP_RETRIES) {
        config.amqp.retries = process.env.IOTA_AMQP_RETRIES;
    }

    if (process.env.IOTA_AMQP_RETRY_TIME) {
        config.amqp.retryTime = process.env.IOTA_AMQP_RETRY_TIME;
    }

    if (anyIsSet(httpVariables)) {
        config.http = {};
    }

    if (process.env.IOTA_HTTP_HOST) {
        config.http.host = process.env.IOTA_HTTP_HOST;
    }

    if (process.env.IOTA_HTTP_PORT) {
        config.http.port = process.env.IOTA_HTTP_PORT;
    }
    
    if (process.env.IOTA_HTTP_TIMEOUT) {
        config.http.timeout = process.env.IOTA_HTTP_TIMEOUT;
    }

    if (anyIsSet(mongoVariables)) {
        config.mongodb = {};
    }

    if (process.env.IOTA_MONGO_HOST) {
        config.mongodb.host = process.env.IOTA_MONGO_HOST;
    }
    
    if (process.env.IOTA_MONGO_PORT) {
        config.mongodb.port = process.env.IOTA_MONGO_PORT;
    }

    if (anyIsSet(cbVariables)) {
        config.contextBroker = {};
    }


    if (process.env.IOTA_CB_URL) {
        config.iota.contextBroker.url = process.env.IOTA_CB_URL;
    } else if (process.env.IOTA_CB_HOST) {
        config.iota.contextBroker.host = process.env.IOTA_CB_HOST;
        config.iota.contextBroker.url = 'http://' + process.env.IOTA_CB_HOST;
        if (process.env.IOTA_CB_PORT) {
            config.iota.contextBroker.url += ':' + process.env.IOTA_CB_PORT;
        } else {
            config.iota.contextBroker.url += ':' + config.contextBroker.port;
        }
    }

    if (process.env.IOTA_CB_NGSI_VERSION) {
        config.iota.contextBroker.ngsiVersion = process.env.IOTA_CB_NGSI_VERSION;
    }

    if (process.env.IOTA_NORTH_HOST) {
        config.iota.server.host = process.env.IOTA_NORTH_HOST;
    }

    if (process.env.IOTA_NORTH_PORT) {
        config.iota.server.port = process.env.IOTA_NORTH_PORT;
    }
    
    if (process.env.IOTA_PROVIDER_URL) {
        config.iota.providerUrl = process.env.IOTA_PROVIDER_URL;
    }

   if (process.env.IOTA_AUTH_ENABLED) {
        config.iota.authentication = {};
        config.iota.authentication.enabled = process.env.IOTA_AUTH_ENABLED === 'true';
    }

   if (process.env.IOTA_AUTH_TYPE) {
        config.iota.authentication.type = process.env.IOTA_AUTH_TYPE;
    }
    if (process.env.IOTA_AUTH_HEADER) {
        config.iota.authentication.header = process.env.IOTA_AUTH_HEADER;
    }

    if (process.env.IOTA_AUTH_HOST) {
        config.iota.authentication.host = process.env.IOTA_AUTH_HOST;
    }
    if (process.env.IOTA_AUTH_PORT) {
        config.iota.authentication.port = process.env.IOTA_AUTH_PORT;
    }
    if (process.env.IOTA_AUTH_USER) {
        config.iota.authentication.user = process.env.IOTA_AUTH_USER;
    }
    if (process.env.IOTA_AUTH_PASSWORD) {
        config.iota.authentication.password = process.env.IOTA_AUTH_PASSWORD;
    }
    
    if (process.env.IOTA_AUTH_PERMANENT_TOKEN) {
        config.iota.authentication.permanentToken = process.env.IOTA_AUTH_PERMANENT_TOKEN;
    }


    if (process.env.IOTA_IOTAM_HOST) {
        config.iotManager.url = 'http://' + process.env.IOTA_IOTAM_HOST;
    }
}

function setConfig(newConfig) {
    config = newConfig;

    processEnvironmentVariables();
}

function getConfig() {
    return config;
}

function setLogger(newLogger) {
    logger = newLogger;
}

function getLogger() {
    return logger;
}

function setSecurityService(newSecurityService) {
    securityService = newSecurityService;
}

function getSecurityService() {
    return securityService;
}


exports.setConfig = setConfig;
exports.getConfig = getConfig;
exports.setLogger = setLogger;
exports.getLogger = getLogger;
exports.setSecurityService = setSecurityService;
exports.getSecurityService = getSecurityService;
