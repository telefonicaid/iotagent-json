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

/*jshint camelcase:false */

var iotagentMqtt = require('../../'),
    iotAgentLib = require('iotagent-node-lib'),
    mqtt = require('mqtt'),
    config = require('../config-test.js'),
    nock = require('nock'),
    should = require('should'),
    request = require('request'),
    utils = require('../utils'),
    contextBrokerMock,
    iotamMock,
    mqttClient;

describe('Configuration API support', function() {
    var provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionDevice1.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        },
        configurationOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/services',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionConfiguration1.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        },
        configurationOptionsWithResource = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/services',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionConfiguration2.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };


    beforeEach(function(done) {
        nock.cleanAll();

        mqttClient = mqtt.connect('mqtt://' + config.mqtt.host, {
            keepalive: 0,
            connectTimeout: 60 * 60 * 1000
        });

        config.iota.iotManager = {
            host: '127.0.0.1',
            port: 8081,
            path: '/iot/protocols',
            protocol: 'TT_MQTT-JSON',
            description: 'MQTT-JSON protocol for TT'
        };

        config.iota.defaultResource = '/iotamqtt';

        iotamMock = nock('http://127.0.0.1:8081')
            .post('/iot/protocols', {
                    protocol: 'TT_MQTT-JSON',
                    description: 'MQTT-JSON protocol for TT',
                    iotagent: 'http://localhost:4041',
                    resource: '/iotamqtt',
                    services: []
                })
            .reply(200, {});

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

        iotagentMqtt.start(config, done);
    });

    afterEach(function(done) {
        delete config.iota.iotManager;
        delete config.iota.defaultResource;
        iotAgentLib.clearAll();
        nock.cleanAll();
        mqttClient.end();
        iotagentMqtt.stop(done);
    });

    describe('When a configuration is provisioned for a service', function() {
        beforeEach(function() {
            iotamMock.post('/iot/protocols', {
                    protocol: 'TT_MQTT-JSON',
                    description: 'MQTT-JSON protocol for TT',
                    iotagent: 'http://localhost:4041',
                    resource: '/iotamqtt',
                    services: [
                        {
                            apikey: '728289',
                            token: '8970A9078A803H3BL98PINEQRW8342HBAMS',
                            entity_type: 'Light',
                            resource: '',
                            service: 'smartGondor',
                            service_path: '/gardens'
                        }
                    ]
                })
                .reply(200, {});

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200,
                utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));
        });

        it('should use the API Key of that configuration in device topics', function(done) {
            request(configurationOptions, function(error, response, body) {
                request(provisionOptions, function(error, response, body) {
                    mqttClient.publish('/728289/MQTT_2/attrs/temperature', '87', null, function(error) {
                        setTimeout(function() {
                            contextBrokerMock.done();
                            done();
                        }, 100);
                    });
                });
            });
        });
    });

    describe('When a configuration is provisioned with a Resource set', function() {
        beforeEach(function() {
            /*jshint camelcase:false */

            var configurationProvision = {
                protocol: 'TT_MQTT-JSON',
                description: 'MQTT-JSON protocol for TT',
                iotagent: 'http://localhost:4041',
                resource: '/iotamqtt',
                services: [
                    {
                        apikey: '728289',
                        token: '8970A9078A803H3BL98PINEQRW8342HBAMS',
                        entity_type: 'Light',
                        resource: '/AnotherValue',
                        service: 'smartGondor',
                        service_path: '/gardens'
                    }
                ]
            };

            iotamMock
                .post('/iot/protocols', configurationProvision)
                .reply(200, {});

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200,
                    utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));
        });

        it('should reject the configuration provisioning with a BAD FORMAT error', function(done) {
            request(configurationOptionsWithResource, function(error, response, body) {
                should.not.exist(error);

                response.statusCode.should.equal(400);
                done();
            });
        });
    });
});
