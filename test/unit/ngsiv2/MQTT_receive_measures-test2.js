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

const iotaJson = require('../../../');
const mqtt = require('mqtt');
const config = require('./config-test.js');
const nock = require('nock');
const iotAgentLib = require('iotagent-node-lib');
const async = require('async');
const request = require('request');
const utils = require('../../utils');
const groupCreation = {
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
        'fiware-service': 'smartgondor',
        'fiware-servicepath': '/gardens'
    }
};
let contextBrokerMock;
let contextBrokerUnprovMock;
let mqttClient;

describe('MQTT: Measure reception ', function () {
    beforeEach(function (done) {
        const provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionDevice1.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        mqttClient = mqtt.connect('mqtt://' + config.mqtt.host, {
            keepalive: 0,
            connectTimeout: 60 * 60 * 1000
        });

        // This mock does not check the payload since the aim of the test is not to verify
        // device provisioning functionality. Appropriate verification is done in tests under
        // provisioning folder of iotagent-node-lib
        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/entities?options=upsert')
            .reply(204);

        iotaJson.start(config, function () {
            request(provisionOptions, function (error, response, body) {
                done();
            });
        });
    });

    afterEach(function (done) {
        nock.cleanAll();
        mqttClient.end();

        async.series([iotAgentLib.clearAll, iotaJson.stop], done);
    });

    describe('When a new multiple measure arrives to the MQTT Topic', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasuresJsonTypes.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasuresJsonTypes2.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);
        });
        it('should send its value to the Context Broker', function (done) {
            const values = [
                {
                    humidity: '32',
                    temperature: '87',
                    luminosity: 10,
                    pollution: 43.4,
                    configuration: {
                        firmware: { version: '1.1.0', hash: 'cf23df2207d99a74fbe169e3eba035e633b65d94' }
                    },
                    tags: ['iot', 'device'],
                    enabled: true,
                    alive: null
                },
                {
                    humidity: '33',
                    temperature: '89',
                    luminosity: 10,
                    pollution: 43.4,
                    configuration: {
                        firmware: { version: '1.1.0', hash: 'cf23df2207d99a74fbe169e3eba035e633b65d94' }
                    },
                    tags: ['iot', 'device'],
                    enabled: true,
                    alive: null
                }
            ];

            mqttClient.publish('/1234/MQTT_2/attrs', JSON.stringify(values), null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
        it('should send its value to the Context Broker (without leading slash)', function (done) {
            const values = [
                {
                    humidity: '32',
                    temperature: '87',
                    luminosity: 10,
                    pollution: 43.4,
                    configuration: {
                        firmware: { version: '1.1.0', hash: 'cf23df2207d99a74fbe169e3eba035e633b65d94' }
                    },
                    tags: ['iot', 'device'],
                    enabled: true,
                    alive: null
                },
                {
                    humidity: '33',
                    temperature: '89',
                    luminosity: 10,
                    pollution: 43.4,
                    configuration: {
                        firmware: { version: '1.1.0', hash: 'cf23df2207d99a74fbe169e3eba035e633b65d94' }
                    },
                    tags: ['iot', 'device'],
                    enabled: true,
                    alive: null
                }
            ];

            mqttClient.publish('json/1234/MQTT_2/attrs', JSON.stringify(values), null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new multiple measure arrives for an unprovisioned device', function () {
        beforeEach(function (done) {
            // This mock does not check the payload since the aim of the test is not to verify
            // device provisioning functionality. Appropriate verification is done in tests under
            // provisioning folder of iotagent-node-lib
            contextBrokerUnprovMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerUnprovMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/TheLightType:JSON_UNPROVISIONED/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/unprovisionedDevice.json')
                )
                .query({ type: 'TheLightType' })
                .reply(204);

            contextBrokerUnprovMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/TheLightType:JSON_UNPROVISIONED/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/unprovisionedDevice2.json')
                )
                .query({ type: 'TheLightType' })
                .reply(204);

            request(groupCreation, function (error, response, body) {
                done();
            });
        });
        it('should send its value to the Context Broker', function (done) {
            const values = [
                {
                    humidity: '32',
                    temperature: '87'
                },
                {
                    humidity: '33',
                    temperature: '89'
                }
            ];

            mqttClient.publish('/KL223HHV8732SFL1/JSON_UNPROVISIONED/attrs', JSON.stringify(values), null, function (
                error
            ) {
                setTimeout(function () {
                    contextBrokerUnprovMock.done();
                    done();
                }, 100);
            });
        });
        it('should send its value to the Context Broker (without leading slash)', function (done) {
            const values = [
                {
                    humidity: '32',
                    temperature: '87'
                },
                {
                    humidity: '33',
                    temperature: '89'
                }
            ];

            mqttClient.publish(
                'json/KL223HHV8732SFL1/JSON_UNPROVISIONED/attrs',
                JSON.stringify(values),
                null,
                function (error) {
                    setTimeout(function () {
                        contextBrokerUnprovMock.done();
                        done();
                    }, 100);
                }
            );
        });
    });

    describe('When a new multiple measure arrives to the MQTT Topic with unknown attributes', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/unknownMeasures.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/unknownMeasures2.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);
        });
        it('should send its value to the Context Broker', function (done) {
            const values = [
                {
                    humidity: '32',
                    weight: '87'
                },
                {
                    humidity: '33',
                    weight: '89'
                }
            ];

            mqttClient.publish('/1234/MQTT_2/attrs', JSON.stringify(values), null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
        it('should send its value to the Context Broker (without leading slash)', function (done) {
            const values = [
                {
                    humidity: '32',
                    weight: '87'
                },
                {
                    humidity: '33',
                    weight: '89'
                }
            ];

            mqttClient.publish('json/1234/MQTT_2/attrs', JSON.stringify(values), null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new multiple measure arrives with a timestamp to the MQTT Topic', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/timestampMeasure.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/timestampMeasure2.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);
        });
        it('should send its value to the Context Broker', function (done) {
            const values = [
                {
                    humidity: '32',
                    temperature: '87',
                    TimeInstant: '20071103T131805'
                },
                {
                    humidity: '33',
                    temperature: '89',
                    TimeInstant: '20071103T131805'
                }
            ];

            mqttClient.publish('/1234/MQTT_2/attrs', JSON.stringify(values), null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
        it('should send its value to the Context Broker (without leading slash)', function (done) {
            const values = [
                {
                    humidity: '32',
                    temperature: '87',
                    TimeInstant: '20071103T131805'
                },
                {
                    humidity: '33',
                    temperature: '89',
                    TimeInstant: '20071103T131805'
                }
            ];

            mqttClient.publish('json/1234/MQTT_2/attrs', JSON.stringify(values), null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });
});
