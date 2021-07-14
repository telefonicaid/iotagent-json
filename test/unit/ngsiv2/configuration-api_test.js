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
 *
 * Modified by: Daniel Calvo - ATOS Research & Innovation
 */

/* eslint-disable no-unused-vars */

const iotagentJson = require('../../../');
const iotAgentLib = require('iotagent-node-lib');
const mqtt = require('mqtt');
const config = require('./config-test.js');
const nock = require('nock');
const should = require('should');
const request = require('request');
const utils = require('../../utils');
let contextBrokerMock;
let contextBrokerUnprovMock;
let iotamMock;
let mqttClient;
let originalResource;

describe('Configuration API support', function () {
    const provisionOptions = {
        url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
        method: 'POST',
        json: utils.readExampleFile('./test/deviceProvisioning/provisionDevice1.json'),
        headers: {
            'fiware-service': 'smartgondor',
            'fiware-servicepath': '/gardens'
        }
    };
    const configurationOptions = {
        url: 'http://localhost:' + config.iota.server.port + '/iot/services',
        method: 'POST',
        json: utils.readExampleFile('./test/deviceProvisioning/provisionConfiguration1.json'),
        headers: {
            'fiware-service': 'smartgondor',
            'fiware-servicepath': '/gardens'
        }
    };
    const configurationOptionsWithResource = {
        url: 'http://localhost:' + config.iota.server.port + '/iot/services',
        method: 'POST',
        json: utils.readExampleFile('./test/deviceProvisioning/provisionConfiguration2.json'),
        headers: {
            'fiware-service': 'smartgondor',
            'fiware-servicepath': '/gardens'
        }
    };

    beforeEach(function (done) {
        nock.cleanAll();
        originalResource = config.iota.defaultResource;
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

        // This mock does not check the payload since the aim of the test is not to verify
        // device provisioning functionality. Appropriate verification is done in tests under
        // provisioning folder of iotagent-node-lib
        contextBrokerMock = nock('http://unexistentHost:1026')
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/entities?options=upsert')
            .reply(204);

        iotagentJson.start(config, done);
    });

    afterEach(function (done) {
        delete config.iota.iotManager;
        delete config.iota.defaultResource;
        config.iota.defaultResource = originalResource;
        iotAgentLib.clearAll();
        nock.cleanAll();
        mqttClient.end();
        iotagentJson.stop(done);
    });

    describe('When a configuration is provisioned for a service', function () {
        beforeEach(function () {
            iotamMock
                .post('/iot/protocols', {
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
                            service: 'smartgondor',
                            service_path: '/gardens'
                        }
                    ]
                })
                .reply(200, {});

            contextBrokerUnprovMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasure.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);
        });

        it('should use the API Key of that configuration in device topics', function (done) {
            request(configurationOptions, function (error, response, body) {
                request(provisionOptions, function (error, response, body) {
                    mqttClient.publish('/json/728289/MQTT_2/attrs/temperature', '87', null, function (error) {
                        setTimeout(function () {
                            contextBrokerUnprovMock.done();
                            done();
                        }, 100);
                    });
                });
            });
        });
    });

    describe('When a configuration is provisioned with a Resource set', function () {
        beforeEach(function () {
            const configurationProvision = {
                protocol: 'TT_MQTT-JSON',
                description: 'MQTT-JSON protocol for TT',
                iotagent: 'http://localhost:4041',
                resource: '/iotamqtt',
                services: [
                    {
                        apikey: '728289',
                        token: '8970A9078A803H3BL98PINEQRW8342HBAMS',
                        entity_type: 'Light',
                        cbHost: 'http://unexistentHost:1026',
                        resource: '/AnotherValue',
                        service: 'smartgondor',
                        service_path: '/gardens'
                    }
                ]
            };

            iotamMock.post('/iot/protocols', configurationProvision).reply(200, {});
        });

        it('should reject the configuration provisioning with a BAD FORMAT error', function (done) {
            request(configurationOptionsWithResource, function (error, response, body) {
                should.not.exist(error);

                response.statusCode.should.equal(400);
                done();
            });
        });
    });
});
