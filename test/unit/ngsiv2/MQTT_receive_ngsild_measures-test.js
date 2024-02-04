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

/* eslint-disable no-unused-vars */

const iotaJson = require('../../../');
const mqtt = require('mqtt');
const config = require('./config-test.js');
const nock = require('nock');
const iotAgentLib = require('iotagent-node-lib');
const should = require('should');
const async = require('async');

const utils = require('../../utils');
const request = utils.request;
let contextBrokerMock;
let contextBrokerUnprovMock;
let mqttClient;

describe('MQTT: NGSILD Measure reception ', function () {
    beforeEach(function (done) {
        const provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionDeviceHTTP3.json'),
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
        contextBrokerMock = nock('http://192.168.1.1:1026');

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


    describe('When a publish single NGSILD entity measure with NGSILD format arrives for the HTTP binding and NGSILD is the expected payload type', function () {
        const measure = {
            id: 'urn:ngsi-ld:ParkingSpot:santander:daoiz_velarde_1_5:3',
            type: 'ParkingSpot',
            status: {
                type: 'Property',
                value: 'free',
                observedAt: '2018-09-21T12:00:00Z'
            },
            category: {
                type: 'Property',
                value: ['onstreet']
            },
            refParkingSite: {
                type: 'Relationship',
                object: 'urn:ngsi-ld:ParkingSite:santander:daoiz_velarde_1_5'
            },
            name: {
                type: 'Property',
                value: 'A-13'
            },
            location: {
                type: 'GeoProperty',
                value: {
                    type: 'Point',
                    coordinates: [-3.80356167695194, 43.46296641666926]
                }
            },
            '@context': [
                'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld',
                'https://schema.lab.fiware.org/ld/context'
            ]
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/ngsildPayloadMeasure.json')
                )
                .reply(204);
        });

        it('should send its value to the Context Broker', function (done) {
            mqttClient.publish('json/1234/MQTT_2/attrs', JSON.stringify(measure), null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a publish multiple NGSILD entity measure with NGSILD format arrives for the HTTP binding and NGSILD is the expected payload type', function () {
        const measure = [
            {
                id: 'urn:ngsi-ld:ParkingSpot:santander:daoiz_velarde_1_5:3',
                type: 'ParkingSpot',
                status: {
                    type: 'Property',
                    value: 'free',
                    observedAt: '2018-09-21T12:00:00Z'
                },
                category: {
                    type: 'Property',
                    value: ['onstreet']
                },
                refParkingSite: {
                    type: 'Relationship',
                    object: 'urn:ngsi-ld:ParkingSite:santander:daoiz_velarde_1_5'
                },
                name: {
                    type: 'Property',
                    value: 'A-13'
                },
                location: {
                    type: 'GeoProperty',
                    value: {
                        type: 'Point',
                        coordinates: [-3.80356167695194, 43.46296641666926]
                    }
                },
                '@context': [
                    'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld',
                    'https://schema.lab.fiware.org/ld/context'
                ]
            },
            {
                id: 'urn:ngsi-ld:ParkingSpot:santander:reyes_magos_1_1:1',
                type: 'ParkingSpot',
                status: {
                    type: 'Property',
                    value: 'free',
                    observedAt: '2012-09-21T12:00:00Z'
                },
                category: {
                    type: 'Property',
                    value: ['onstreet']
                },
                refParkingSite: {
                    type: 'Relationship',
                    object: 'urn:ngsi-ld:ParkingSite:santander:reyes_magos_1_1'
                },
                name: {
                    type: 'Property',
                    value: 'A-12'
                },
                location: {
                    type: 'GeoProperty',
                    value: {
                        type: 'Point',
                        coordinates: [-3.90356167695194, 42.46296641666926]
                    }
                },
                '@context': [
                    'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld',
                    'https://schema.lab.fiware.org/ld/context'
                ]
            }
        ];

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/ngsildPayloadMeasure.json')
                )
                .reply(204);
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/ngsildPayloadMeasure2.json')
                )
                .reply(204);
        });

        it('should send its value to the Context Broker', function (done) {
            mqttClient.publish('json/1234/MQTT_2/attrs', JSON.stringify(measure), null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });
});
