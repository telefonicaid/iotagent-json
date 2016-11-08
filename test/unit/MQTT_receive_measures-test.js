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

/* jshint camelcase: false */

'use strict';

var iotagentMqtt = require('../../'),
    mqtt = require('mqtt'),
    config = require('../config-test.js'),
    nock = require('nock'),
    iotAgentLib = require('iotagent-node-lib'),
    async = require('async'),
    request = require('request'),
    utils = require('../utils'),
    groupCreation = {
        url: 'http://localhost:' + config.iota.server.port + '/iot/services',
        method: 'POST',
        json: {
            services: [
                {
                    resource: '',
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
    mqttClient;

describe('MQTT: Measure reception ', function() {
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

    describe('When a new multiple measure arrives to the MQTT Topic', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/multipleMeasures.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));
        });
        it('should send its value to the Context Broker', function(done) {
            var values = {
                humidity: '32',
                temperature: '87'
            };

            mqttClient.publish('/1234/MQTT_2/attrs', JSON.stringify(values), null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new multiple measure arrives for an unprovisioned device', function() {
        beforeEach(function(done) {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext')
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/unprovisionedDevice.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            request(groupCreation, function(error, response, body) {
                done();
            });
        });
        it('should send its value to the Context Broker', function(done) {
            var values = {
                humidity: '32',
                temperature: '87'
            };

            mqttClient.publish('/KL223HHV8732SFL1/MQTT_UNPROVISIONED/attrs', JSON.stringify(values), null,
                function(error) {
                    setTimeout(function() {
                        contextBrokerMock.done();
                        done();
                    }, 100);
                });
        });
    });

    describe('When a new multiple measure arrives to the MQTT Topic with unknown attributes', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/unknownMeasures.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/unknownMeasuresSuccess.json'));
        });
        it('should send its value to the Context Broker', function(done) {
            var values = {
                humidity: '32',
                weight: '87'
            };

            mqttClient.publish('/1234/MQTT_2/attrs', JSON.stringify(values), null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new multiple measure arrives with a timestamp to the MQTT Topic', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/timestampMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/timestampMeasureSuccess.json'));
        });
        it('should send its value to the Context Broker', function(done) {
            var values = {
                humidity: '32',
                temperature: '87',
                TimeInstant: '20071103T131805'
            };

            mqttClient.publish('/1234/MQTT_2/attrs', JSON.stringify(values), null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new single measure arrives to the MQTT Topic', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200,
                utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));
        });
        it('should send its values to the Context Broker', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs/temperature', '87', null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a malformed multiple measure arrives to the MQTT Topic', function() {
        it('should not crash', function(done) {
            mqttClient.publish('/1234/MQTT_2/attrs', '{"humidity": " }(}', null, function(error) {
                setTimeout(function() {
                    done();
                }, 100);
            });
        });
    });
});
