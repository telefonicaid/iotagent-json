#!/usr/bin/env node

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

var fs = require('fs'),
    defaultConfig = require('../client-config.js'),
    commandLine = require('iotagent-node-lib').commandLine,
    clUtils = commandLine.clUtils,
    mqtt = require('mqtt'),
    async = require('async'),
    _ = require('underscore'),
    mqttClient,
    configCb = {
        host: 'localhost',
        port: 1026,
        service: 'tester',
        subservice: '/test'
    },
    configIot = {
        host: 'localhost',
        port: 4041,
        name: 'default',
        service: 'tester',
        subservice: '/test'
    },
    config = {
        host: defaultConfig.mqtt.host,
        port: defaultConfig.mqtt.port,
        apikey: defaultConfig.device.apikey,
        deviceId: defaultConfig.device.id
    },
    separator = '\n\n\t',
    token;

function setConfig(commands) {
    config.host = commands[0];
    config.port = commands[1];
    config.apikey = commands[2];
    config.deviceId = commands[3];
}

function getConfig(commands) {
    console.log('\nCurrent configuration:\n\n');
    console.log(JSON.stringify(config, null, 4));
    console.log('\n');
    clUtils.prompt();
}

function mqttPublishHandler(error) {
    if (error) {
        console.log('There was an error publishing to the MQTT broker: %s', error);
    } else {
        console.log('Message successfully published');
    }

    clUtils.prompt();
}

function checkConnection(fn) {
    return function(commands) {
        if (mqttClient) {
            fn(commands);
        } else {
            console.log('Please, check your configuration and connect before using MQTT commands.');
        }
    }
}

function singleMeasure(commands) {
    var topic = '/' + config.apikey + '/' + config.deviceId + '/attributes/' + commands[0];

    mqttClient.publish(topic, commands[1], null, mqttPublishHandler);
}

function parseMultipleAttributes(attributeString) {
    var result,
        attributes,
        attribute;

    if (!attributeString) {
        result = null;
    } else {
        attributes = attributeString.split(';');
        result = {};

        for (var i = 0; i < attributes.length; i++) {
            attribute = attributes[i].split('=');
            result[attribute[0]] = attribute[1];
        }
    }

    return result;
}

function multipleMeasure(commands) {
    var values = parseMultipleAttributes(commands[0]),
        topic = '/' + config.apikey + '/' + config.deviceId + '/attributes';

    mqttClient.publish(topic, JSON.stringify(values), null, mqttPublishHandler);
}

function connect(commands) {
    console.log('\nConnecting to MQTT Broker...');

    mqttClient = mqtt.connect('mqtt://' + config.host, defaultConfig.mqtt.options);

    clUtils.prompt();
}

function exitClient() {
    process.exit(0);
}

var commands = {
    'config': {
        parameters: ['host', 'port', 'apiKey', 'deviceId'],
        description: '\tConfigure the client to emulate the selected device, connecting to the given host.',
        handler: setConfig
    },
    'showConfig': {
        parameters: [],
        description: '\tConfigure the client to emulate the selected device, connecting to the given host.',
        handler: getConfig
    },
    'connect': {
        parameters: [],
        description: '\tConnect to the MQTT broker.',
        handler: connect
    },
    'singleMeasure': {
        parameters: ['attribute', 'value'],
        description: '\tSend the given value for the selected attribute to the MQTT broker.',
        handler: checkConnection(singleMeasure)
    },
    'multipleMeasure': {
        parameters: ['attributes'],
        description: '\tSend a collection of attributes to the MQTT broker, using JSON format. The "attributes"\n' +
            '\tstring should have the following syntax: name=value[;name=value]*',
        handler: checkConnection(multipleMeasure)
    },
    'exit': {
        parameters: [],
        description: '\tExit the client',
        handler: exitClient
    }
};

commands = _.extend(commands, commandLine.commands);
commandLine.init(configCb, configIot);

clUtils.initialize(commands, 'MQTT Agent tester> ');
