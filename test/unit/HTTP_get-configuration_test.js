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

/* jshint camelcase: false */

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
    contextBrokerMock,
    oldConfigurationFlag;

describe('HTTP: Get configuration from the devices', function() {
    beforeEach(function(done) {
        var provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionCommandHTTP.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/NGSI9/registerContext')
            .reply(200,
                utils.readExampleFile('./test/contextAvailabilityResponses/registerIoTAgent1Success.json'));

        contextBrokerMock
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus1Success.json'));

        oldConfigurationFlag = config.configRetrieval;
        config.configRetrieval = true;

        iotagentMqtt.start(config, function() {
            request(provisionOptions, function(error, response, body) {
                done();
            });
        });
    });

    afterEach(function(done) {
        nock.cleanAll();
        config.configRetrieval = oldConfigurationFlag;

        async.series([
            iotAgentLib.clearAll,
            iotagentMqtt.stop
        ], done);
    });

    describe('When a configuration request is received in the path /configuration/commands', function() {
        var configurationRequest = {
            url: 'http://localhost:' + config.http.port + '/iot/d/configuration',
            method: 'POST',
            json: {
                type: 'configuration',
                fields: [
                    'sleepTime',
                    'warningLevel'
                ]
            },
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'MQTT_2',
                k: '1234'
            }
        };

        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/queryContext', utils.readExampleFile('./test/contextRequests/getConfiguration.json'))
                .reply(200,
                    utils.readExampleFile('./test/contextResponses/getConfigurationSuccess.json'));

            mockedClientServer = nock('http://localhost:9876')
                .post('/command/configuration', function(result) {
                    return result.sleepTime && result.sleepTime === '200' &&
                        result.warningLevel && result.warningLevel === '80' &&
                        result.dt;
                })
                .reply(200, '');
        });

        it('should reply with a 200 OK', function(done) {
            request(configurationRequest, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });

        it('should ask the Context Broker for the request attributes', function(done) {
            request(configurationRequest, function(error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
        it('should return the requested attributes to the client in the client endpoint', function(done) {
            request(configurationRequest, function(error, response, body) {
                mockedClientServer.done();
                done();
            });
        });
    });
    describe('When a subscription request is received in the IoT Agent', function() {
        var configurationRequest = {
            url: 'http://localhost:' + config.http.port + '/iot/d/configuration',
            method: 'POST',
            json: {
                type: 'subscription',
                fields: [
                    'sleepTime',
                    'warningLevel'
                ]
            },
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'MQTT_2',
                k: '1234'
            }
        };

        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/subscribeContext', utils.readExampleFile('./test/subscriptions/subscriptionRequest.json'))
                .reply(200,
                    utils.readExampleFile('./test/subscriptions/subscriptionResponse.json'));

            mockedClientServer = nock('http://localhost:9876')
                .post('/command/configuration', function(result) {
                    return result.sleepTime && result.sleepTime === '200' &&
                        result.warningLevel && result.warningLevel === 'ERROR' &&
                        result.dt;
                })
                .reply(200, '');
        });

        it('should create a subscription in the ContextBroker', function(done) {
            request(configurationRequest, function(error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
        it('should update the values in the MQTT topic when a notification is received', function(done) {
            var optionsNotify = {
                url: 'http://localhost:' + config.iota.server.port + '/notify',
                method: 'POST',
                json: utils.readExampleFile('./test/subscriptions/notification.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            };

            request(configurationRequest, function(error, response, body) {
                setTimeout(function() {
                    request(optionsNotify, function() {
                        setTimeout(function() {
                            mockedClientServer.done();
                            done();
                        }, 100);
                    });
                }, 100);
            });
        });
    });
});
