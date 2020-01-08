/*
 * Copyright 2016 Telefonica InvestigaciÃ³n y Desarrollo, S.A.U
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
    iotAgentLib = require('iotagent-node-lib'),
    should = require('should'),
    async = require('async'),
    request = require('request'),
    utils = require('../utils'),
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
    contextBrokerMock,
    contextBrokerUnprovMock;

describe('HTTP: Measure reception ', function() {
    beforeEach(function(done) {
        var provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionDeviceHTTP.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

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

        async.series([iotAgentLib.clearAll, iotagentMqtt.stop], done);
    });

    describe('When a POST multimeasure arrives for the HTTP binding', function() {
        var optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: [
                {
                    humidity: '33',
                    temperature: '89'
                },
                {
                    humidity: '32',
                    temperature: '87'
                }
            ],
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
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/multipleMeasures2.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/multipleMeasures.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));
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

    describe('When a POST multimeasure arrives with a TimeInstant attribute in the body', function() {
        var optionsMeasure = {
                url: 'http://localhost:' + config.http.port + '/iot/json',
                method: 'POST',
                json: [
                    {
                        humidity: '111222',
                        TimeInstant: '20200222T222222'
                    },
                    {
                        humidity: '111333',
                        TimeInstant: '20200222T222224'
                    }
                ],
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

            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext')
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/timeInstantMeasures.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/timeInstantMeasuresSuccess.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/timeInstantMeasures2.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/timeInstantMeasuresSuccess.json'));

            iotagentMqtt.stop(function() {
                config.iota.timestamp = true;
                config.compressTimestamp = false;
                iotagentMqtt.start(config, function() {
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

    describe('When a POST multimeasure arrives with a TimeInstant query parameter in the body', function() {
        var optionsMeasure = {
                url: 'http://localhost:' + config.http.port + '/iot/json',
                method: 'POST',
                json: [
                    {
                        humidity: '111222'
                    },
                    {
                        humidity: '111333'
                    }
                ],
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

            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext')
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/timeInstantMeasures.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/timeInstantMeasuresSuccess.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/timeInstantMeasures3.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/timeInstantMeasuresSuccess.json'));

            iotagentMqtt.stop(function() {
                config.iota.timestamp = true;
                config.compressTimestamp = false;
                iotagentMqtt.start(config, function() {
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

    describe('When a POST multimeasure arrives for an unprovisioned device', function() {
        var optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: [
                {
                    humidity: '33',
                    temperature: '89'
                },
                {
                    humidity: '32',
                    temperature: '87'
                }
            ],
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'MQTT_UNPROVISIONED',
                k: 'KL223HHV8732SFL1'
            }
        };

        beforeEach(function(done) {
            contextBrokerUnprovMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext')
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            contextBrokerUnprovMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/unprovisionedDevice2.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            contextBrokerUnprovMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/unprovisionedDevice.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            request(groupCreation, function(error, response, body) {
                done();
            });
        });

        it('should send its value to the Context Broker', function(done) {
            request(optionsMeasure, function(error, result, body) {
                contextBrokerUnprovMock.done();
                done();
            });
        });
        it('should add a transport to the registered devices', function(done) {
            var getDeviceOptions = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
                method: 'GET',
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                },
                qs: {
                    i: 'MQTT_UNPROVISIONED',
                    k: 'KL223HHV8732SFL1'
                }
            };

            request(optionsMeasure, function(error, response, body) {
                request(getDeviceOptions, function(error, response, body) {
                    var parsedBody;

                    should.not.exist(error);
                    parsedBody = JSON.parse(body);

                    response.statusCode.should.equal(200);
                    should.exist(parsedBody.devices[0].transport);
                    parsedBody.devices[0].transport.should.equal('HTTP');
                    done();
                });
            });
        });
    });
});
