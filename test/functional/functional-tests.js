/*
 * Copyright 2023 Telefonica Investigación y Desarrollo, S.A.U
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
 * Modified by: Miguel Angel Pedraza
 */

/* eslint-disable no-unused-vars */

const iotaJson = require('../..');
const config = require('./config-test.js');
const nock = require('nock');
const iotAgentLib = require('iotagent-node-lib');
const should = require('should');
const async = require('async');

const utils = require('../utils');
const request = utils.request;

const logger = require('logops');

let contextBrokerMock;

describe('FUNCTIONAL TESTS', function () {
    beforeEach(function (done) {
        nock.cleanAll();
        iotaJson.start(config, function () {
            done();
        });
    });

    afterEach(function (done) {
        nock.cleanAll();

        async.series([iotAgentLib.clearAll, iotaJson.stop], done);
    });

    describe('Basic group provision without attributes', function () {
        const provision = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/services',
            method: 'POST',
            json: {
                services: [
                    {
                        resource: '/iot/json',
                        apikey: '123456',
                        entity_type: 'TheLightType',
                        cbHost: 'http://192.168.1.1:1026',
                        commands: [],
                        lazy: [],
                        attributes: [],
                        static_attributes: []
                    }
                ]
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        const measure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                status: true
            },
            qs: {
                i: 'MQTT_2',
                k: '123456'
            }
        };

        const expectation = {
            id: 'TheLightType:MQTT_2',
            type: 'TheLightType',
            status: {
                value: true,
                type: 'string'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert', expectation)
                .reply(204);

            request(provision, function (error, response, body) {
                done();
            });
        });

        it('should return a 200 OK with no error', function (done) {
            request(measure, function (error, result, body) {
                should.not.exist(error);
                result.statusCode.should.equal(200);
                done();
            });
        });

        it('should send its value to the Context Broker', function (done) {
            request(measure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('Basic group provision with attributes', function () {
        const provision = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/services',
            method: 'POST',
            json: {
                services: [
                    {
                        resource: '/iot/json',
                        apikey: '123456',
                        entity_type: 'TheLightType2',
                        cbHost: 'http://192.168.1.1:1026',
                        commands: [],
                        lazy: [],
                        attributes: [
                            {
                                object_id: 's',
                                name: 'status',
                                type: 'Boolean'
                            },
                            {
                                object_id: 't',
                                name: 'temperature',
                                type: 'Number'
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

        const measure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                s: true,
                t: 20
            },
            qs: {
                i: 'MQTT_2',
                k: '123456'
            }
        };

        const expectation = {
            id: 'TheLightType2:MQTT_2',
            type: 'TheLightType2',
            status: {
                value: true,
                type: 'Boolean'
            },
            temperature: {
                value: 20,
                type: 'Number'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert', expectation)
                .reply(204);

            request(provision, function (error, response, body) {
                done();
            });
        });

        it('should return a 200 OK with no error', function (done) {
            request(measure, function (error, result, body) {
                should.not.exist(error);
                result.statusCode.should.equal(200);
                done();
            });
        });

        it('should send its value to the Context Broker', function (done) {
            request(measure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });
});
