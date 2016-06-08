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

var iotagentMqtt = require('../../'),
    config = require('../config-test.js'),
    nock = require('nock'),
    should = require('should'),
    iotAgentLib = require('iotagent-node-lib'),
    async = require('async'),
    request = require('request'),
    utils = require('../utils'),
    mockedClientServer,
    contextBrokerMock;

describe('HTTP: Get configuration from the devices', function() {
    describe('When a configuration request is received in the path /configuration/commands', function() {
        it('should ask the Context Broker for the request attributes');
        it('should return the requested attributes to the client in the client endpoint');
        it('should add the system timestamp in compressed format to the request');
    });
    describe('When a subscription request is received in the IoT Agent', function() {
        it('should create a subscription in the ContextBroker');
        it('should update the values in the MQTT topic when a notification is received');
    });
});