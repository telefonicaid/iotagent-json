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
const config = require('./config-test.js');
const nock = require('nock');
const iotAgentLib = require('iotagent-node-lib');
const should = require('should');
const async = require('async');

const utils = require('../../utils');
const request = utils.request;
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

describe('HTTP: Measure reception ', function () {
    beforeEach(function (done) {
        const provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionDeviceHTTP.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

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

        async.series([iotAgentLib.clearAll, iotaJson.stop], done);
    });

    describe('When a POST single JSON measure arrives for the HTTP binding', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json/attrs/humidity',
            method: 'POST',
            json: '32',
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'MQTT_2',
                k: '1234'
            }
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasuresJsonTypes.json')
                )
                .reply(204);
        });
        it('should return a 200 OK with no error', function (done) {
            request(optionsMeasure, function (error, result, body) {
                should.not.exist(error);
                result.statusCode.should.equal(200);
                done();
            });
        });

        it('should send its value to the Context Broker', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a POST single JSON measure with NGSIv2 format arrives for the HTTP binding', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json/',
            method: 'POST',
            json: {
                actionType: 'APPEND',
                entities: [
                    {
                        id: 'urn:ngsi-ld:Streetlight:Streetlight-Mylightpoint-2',
                        type: 'Streetlight',
                        name: {
                            type: 'Text',
                            value: 'MyLightPoint-test1'
                        },
                        description: {
                            type: 'Text',
                            value: 'testdescription'
                        },
                        status: {
                            type: 'Text',
                            value: 'connected'
                        },
                        dateServiceStarted: {
                            type: 'DateTime',
                            value: '2020-06-04T09: 55: 02'
                        },
                        locationComment: {
                            type: 'Text',
                            value: 'Test1'
                        },
                        location: {
                            type: 'geo:json',
                            value: {
                                coordinates: [-87.88429, 41.99499],
                                type: 'Point'
                            }
                        },
                        address: {
                            type: 'Text',
                            value: {
                                streetAddress: 'MyStreet'
                            }
                        },
                        isRemotelyManaged: {
                            type: 'Integer',
                            value: 1
                        },
                        installationDate: {
                            type: 'DateTime',
                            value: '2022-04-17T02: 30: 04'
                        }
                    }
                ]
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'MQTT_2',
                k: '1234'
            }
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/ngsiv2Measure.json')
                )
                .reply(204);
        });
        it('should return a 200 OK with no error', function (done) {
            request(optionsMeasure, function (error, result, body) {
                should.not.exist(error);
                result.statusCode.should.equal(200);
                done();
            });
        });

        it('should send its value to the Context Broker', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a POST single JSON measure with NGSILD format arrives for the HTTP binding', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json/',
            method: 'POST',
            json: {
                actionType: 'APPEND',
                entities: [
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
                    }
                ]
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'MQTT_2',
                k: '1234'
            }
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/ngsildMeasure.json')
                )
                .reply(204);
        });
        it('should return a 200 OK with no error', function (done) {
            request(optionsMeasure, function (error, result, body) {
                should.not.exist(error);
                result.statusCode.should.equal(200);
                done();
            });
        });

        it('should send its value to the Context Broker', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a POST single Text measure arrives for the HTTP binding', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json/attrs/humidity',
            method: 'POST',
            json: false,
            body: '32',
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens',
                'content-type': 'text/plain'
            },
            qs: {
                i: 'MQTT_2',
                k: '1234'
            }
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasuresTextTypes.json')
                )
                .reply(204);
        });
        it('should return a 200 OK with no error', function (done) {
            request(optionsMeasure, function (error, result, body) {
                should.not.exist(error);
                result.statusCode.should.equal(200);
                done();
            });
        });

        it('should send its value to the Context Broker', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a POST single Raw measure arrives for the HTTP binding', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json/attrs/humidity',
            method: 'POST',
            json: false,
            body: '32',
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens',
                'content-type': 'application/octet-stream'
            },
            qs: {
                i: 'MQTT_2',
                k: '1234'
            }
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasuresRawTypes.json')
                )
                .reply(204);
        });
        it('should return a 200 OK with no error', function (done) {
            request(optionsMeasure, function (error, result, body) {
                should.not.exist(error);
                result.statusCode.should.equal(200);
                done();
            });
        });

        it('should send its value to the Context Broker', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a POST single SOAP/XML measure arrives for the HTTP binding', function () {
        var soapReq =
            '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"> ' +
            '<soapenv:Header xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope"/> ' +
            '<soapenv:Body ' +
            'xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope"> ' +
            '<ns21:notificationEventRequest ' +
            'xmlns:ns21="http://myurl.com"> ' +
            '<ns21:Param1>ABC12345</ns21:Param1> ' +
            '<ns21:Param2/> ' +
            '<ns21:Date>28/09/2023 11:48:15 +0000</ns21:Date> ' +
            '<ns21:NestedAttr> ' +
            '<ns21:SubAttr>This is a description</ns21:SubAttr> ' +
            '</ns21:NestedAttr> ' +
            '<ns21:Status>Assigned</ns21:Status> ' +
            '<ns21:OriginSystem/> ' +
            '</ns21:notificationEventRequest> ' +
            '</soapenv:Body> ' +
            '</soap:Envelope>';
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json/attrs/data',
            method: 'POST',
            json: false,
            body: soapReq,
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens',
                'content-type': 'application/soap+xml'
            },
            qs: {
                i: 'MQTT_2',
                k: '1234'
            }
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasureSoapXml.json')
                )
                .reply(204);
        });
        it('should return a 200 OK with no error', function (done) {
            request(optionsMeasure, function (error, result, body) {
                should.not.exist(error);
                result.statusCode.should.equal(200);
                done();
            });
        });

        it('should send its value to the Context Broker', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });
});
