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
            'IOTA_HTTP_HOST',
            'IOTA_HTTP_PORT'
        ],
        mqttVariables = [
            'IOTA_MQTT_HOST',
            'IOTA_MQTT_PORT',
            'IOTA_MQTT_USERNAME',
            'IOTA_MQTT_PASSWORD',
            'IOTA_MQTT_QOS',
            'IOTA_MQTT_RETAIN'
        ],
        httpVariables = [
            'IOTA_HTTP_HOST',
            'IOTA_HTTP_PORT'
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

    if (anyIsSet(httpVariables)) {
        config.http = {};
    }

    if (process.env.IOTA_HTTP_HOST) {
        config.http.host = process.env.IOTA_HTTP_HOST;
    }

    if (process.env.IOTA_HTTP_PORT) {
        config.http.port = process.env.IOTA_HTTP_PORT;
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

exports.setConfig = setConfig;
exports.getConfig = getConfig;
exports.setLogger = setLogger;
exports.getLogger = getLogger;
