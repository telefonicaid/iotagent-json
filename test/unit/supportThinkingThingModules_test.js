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

var iotagentMqtt = require('../../'),
    mqtt = require('mqtt'),
    async = require('async'),
    iotAgentLib = require('iotagent-node-lib'),
    config = require('../config-test.js'),
    nock = require('nock'),
    request = require('request'),
    utils = require('../utils'),
    contextBrokerMock,
    mqttClient;

describe('Support for Thinking Things Modules', function() {
    beforeEach(function(done) {
        var provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionDevice1.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        mqttClient = mqtt.connect('mqtt://' + config.mqtt.host, {
            keepalive: 0,
            connectTimeout: 60 * 60 * 1000
        });

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

        iotagentMqtt.start(config, function() {
            request(provisionOptions, function(error, response, body) {
                done();
            });
        });
    });

    afterEach(function(done) {
        nock.cleanAll();
        mqttClient.end();
        async.series([
            iotAgentLib.clearAll,
            iotagentMqtt.stop
        ], done);

    });

    describe('When a new measure with Thinking Thing module P1 arrives to a multiattribute topic', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/TTModuleP1.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/TTModuleP1Success.json'));
        });
        it('should send its value to the Context Broker', function(done) {
            var values = {
                humidity: '32',
                P1: '214,7,d22,b00,-64,'
            };

            mqttClient.publish('/1234/MQTT_2/attrs', JSON.stringify(values), null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new measure with Thinking Thing module P1 arrives to a single attribute topic', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/TTModuleP1Single.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/TTModuleP1SingleSuccess.json'));
        });
        it('should send its value to the Context Broker', function(done) {
            var values = '214,7,d22,b00,-64,';

            mqttClient.publish('/1234/MQTT_2/attrs/P1', values, null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new measure with Thinking Thing module C1 arrives in multiattribute topic', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/TTModuleC1.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/TTModuleP1Success.json'));
        });
        it('should send its value to the Context Broker', function(done) {
            var values = {
                humidity: '32',
                C1: '00D600070d220b00'
            };

            mqttClient.publish('/1234/MQTT_2/attrs', JSON.stringify(values), null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new measure with Thinking Thing module C1 arrives in the single attribute topic', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/TTModuleC1Single.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/TTModuleP1SingleSuccess.json'));
        });
        it('should send its value to the Context Broker', function(done) {
            var values = '00D600070d220b00';

            mqttClient.publish('/1234/MQTT_2/attrs/C1', values, null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new measure with Thinking Thing module B short version arrives', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/TTModuleB.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/TTModuleBSuccess.json'));
        });
        it('should send its value to the Context Broker', function(done) {
            var values = {
                humidity: '32',
                B: '4.70,1,1,1,1,0'
            };

            mqttClient.publish('/1234/MQTT_2/attrs', JSON.stringify(values), null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new measure with Thinking Thing module B long version arrives', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/TTModuleBLong.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/TTModuleBSuccess.json'));
        });
        it('should send its value to the Context Broker', function(done) {
            var values = {
                humidity: '32',
                B: '4.70,1,1,1,1,0,9,18'
            };

            mqttClient.publish('/1234/MQTT_2/attrs', JSON.stringify(values), null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });
});
