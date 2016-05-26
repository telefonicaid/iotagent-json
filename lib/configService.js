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
            'MQTT_HOST',
            'MQTT_PORT',
            'MQTT_USERNAME',
            'MQTT_PASSWORD',
            'HTTP_HOST',
            'HTTP_PORT'
        ],
        mqttVariables = [
            'MQTT_HOST',
            'MQTT_PORT',
            'MQTT_USERNAME',
            'MQTT_PASSWORD'
        ],
        httpVariables = [
            'HTTP_HOST',
            'HTTP_PORT'
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

    if (process.env.MQTT_HOST) {
        config.mqtt.host = process.env.MQTT_HOST;
    }

    if (process.env.MQTT_PORT) {
        config.mqtt.port = process.env.MQTT_PORT;
    }

    if (process.env.MQTT_USERNAME) {
        config.mqtt.username = process.env.MQTT_USERNAME;
    }

    if (process.env.MQTT_PASSWORD) {
        config.mqtt.password = process.env.MQTT_PASSWORD;
    }

    if (anyIsSet(httpVariables)) {
        config.http = {};
    }

    if (process.env.HTTP_HOST) {
        config.http.host = process.env.HTTP_HOST;
    }

    if (process.env.HTTP_PORT) {
        config.http.port = process.env.HTTP_PORT;
    }
}

function setConfig(newConfig) {
    config = newConfig;

    processEnvironmentVariables();
}

function getConfig() {
    return config;
}

exports.setConfig = setConfig;
exports.getConfig = getConfig;
