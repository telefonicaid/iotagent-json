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
 *
 * Modified by: Daniel Calvo - ATOS Research & Innovation
 */

/* jshint camelcase: false */

'use strict';

var iotaJson = require('../../../'),
    config = require('./config-test.js'),
    nock = require('nock'),
    iotAgentLib = require('iotagent-node-lib'),
    should = require('should'),
    async = require('async'),
    request = require('request'),
    utils = require('../../utils'),
    groupCreation = {
        url: 'http://localhost:' + config.iota.server.port + '/iot/services',
        method: 'POST',
        json: {
            services: [
                {
                    resource: '/iot/json',
                    apikey: 'KL223HHV8732SFL1',
                    entity_type: 'TheLightType',
                    trust: '8970A9078A803H3BL98PINEQRW8342HBAMS',
                    cbHost: 'http://unexistentHost:1026',
                    commands: [],
                    lazy: [],
                    attributes: [
                        {
                            name: 'status',
                            type: 'Boolean'
                        }
                    ],
                    static_attributes: []
                }
            ]
        },
        headers: {
            'fiware-service': 'smartGondor',
            'fiware-servicepath': '/gardens'
        }
    },
    contextBrokerMock;

describe('HTTP: Measure reception ', function() {
    beforeEach(function(done) {
        var provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionDeviceHTTP.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();
        
        // This mock does not check the payload since the aim of the test is not to verify
        // device provisioning functionality. Appropriate verification is done in tests under
        // provisioning folder of iotagent-node-lib
        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/entities?options=upsert')
            .reply(204);

        iotaJson.start(config, function() {
            request(provisionOptions, function(error, response, body) {
                done();
            });
        });
    });

    afterEach(function(done) {
        nock.cleanAll();

        async.series([
            iotAgentLib.clearAll,
            iotaJson.stop
        ], done);
    });

    describe('When a POST measure arrives for the HTTP binding', function() {
        var optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                humidity: '32',
                temperature: '87',
                luminosity: 10,
                pollution: 43.4,
                configuration: {firmware: {version: '1.1.0', hash: 'cf23df2207d99a74fbe169e3eba035e633b65d94'}},
                tags: ['iot', 'device'],
                enabled: true,
                alive: null
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
                .post('/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasuresJsonTypes.json'))
                .reply(204);
        });
        it('should return a 200 OK with no error', function(done) {
            request(optionsMeasure, function(error, result, body) {
                should.not.exist(error);
                result.statusCode.should.equal(200);
                done();
            });
        });

        it('should send its value to the Context Broker', function(done) {
            request(optionsMeasure, function(error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });

    });

    describe('When a POST measure arrives with a TimeInstant attribute in the body', function() {
        var optionsMeasure = {
                url: 'http://localhost:' + config.http.port + '/iot/json',
                method: 'POST',
                json: {
                    humidity: '111222',
                    TimeInstant: '20200222T222222'
                },
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                },
                qs: {
                    i: 'dev0130101',
                    k: '1234'
                }
            },
            provisionOptions = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
                method: 'POST',
                json: utils.readExampleFile('./test/deviceProvisioning/provisionDeviceTimeinstant.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
        };

        beforeEach(function(done) {
            nock.cleanAll();
            // This mock does not check the payload since the aim of the test is not to verify
            // device provisioning functionality. Appropriate verification is done in tests under
            // provisioning folder of iotagent-node-lib
            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities/e0130101/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/timeInstantMeasures.json'))
                .reply(204);

            iotaJson.stop(function() {
                config.iota.timestamp = true;
                config.compressTimestamp = false;
                iotaJson.start(config, function() {
                    request(provisionOptions, function(error, response, body) {
                        done();
                    });
                });
            });
        });

        afterEach(function() {
            config.iota.timestamp = false;
            config.compressTimestamp = true;
        });

        it('should send its value to the Context Broker', function(done) {
            request(optionsMeasure, function(error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a POST measure arrives with a TimeInstant query parameter in the body', function() {
        var optionsMeasure = {
                url: 'http://localhost:' + config.http.port + '/iot/json',
                method: 'POST',
                json: {
                    humidity: '111222'
                },
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                },
                qs: {
                    i: 'dev0130101',
                    k: '1234',
                    t: '20200222T222222'
                }
            },
            provisionOptions = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
                method: 'POST',
                json: utils.readExampleFile('./test/deviceProvisioning/provisionDeviceTimeinstant.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            };

        beforeEach(function(done) {
            nock.cleanAll();
            // This mock does not check the payload since the aim of the test is not to verify
            // device provisioning functionality. Appropriate verification is done in tests under
            // provisioning folder of iotagent-node-lib
            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities/e0130101/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/timeInstantMeasures.json'))
                .reply(204);

            iotaJson.stop(function() {
                config.iota.timestamp = true;
                config.compressTimestamp = false;
                iotaJson.start(config, function() {
                    request(provisionOptions, function(error, response, body) {
                        done();
                    });
                });
            });
        });

        afterEach(function() {
            config.iota.timestamp = false;
            config.compressTimestamp = true;
        });

        it('should send its value to the Context Broker', function(done) {
            request(optionsMeasure, function(error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a POST measure arrives for an unprovisioned device', function() {
        var optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                humidity: '32',
                temperature: '87'
            },
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'JSON_UNPROVISIONED',
                k: 'KL223HHV8732SFL1'
            }
        };
        // This mock does not check the payload since the aim of the test is not to verify
        // device provisioning functionality. Appropriate verification is done in tests under
        // provisioning folder of iotagent-node-lib
        beforeEach(function(done) {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities/TheLightType:JSON_UNPROVISIONED/attrs',
                 utils.readExampleFile('./test/unit/ngsiv2/contextRequests/unprovisionedDevice.json'))
                .reply(204);

            request(groupCreation, function(error, response, body) {
                done();
            });
        });

        it('should send its value to the Context Broker', function(done) {
            request(optionsMeasure, function(error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });


});


