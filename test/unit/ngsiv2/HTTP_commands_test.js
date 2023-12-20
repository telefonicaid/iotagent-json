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

const iotagentMqtt = require('../../../');
const config = require('./config-test.js');
const nock = require('nock');
const should = require('should');
const iotAgentLib = require('iotagent-node-lib');
const async = require('async');
const utils = require('../../utils');
const request = utils.request;
let mockedClientServer;
let contextBrokerMock;

const groupCreation = {
    url: 'http://localhost:' + config.iota.server.port + '/iot/services',
    method: 'POST',
    json: {
        services: [
            {
                resource: '/iot/json',
                apikey: 'KL223HHV8732SFL1',
                entity_type: 'TheLightType',
                endpoint: 'http://localhost:9876/command',
                transport: 'HTTP',
                commands: [
                    {
                        name: 'cmd1',
                        type: 'command'
                    }
                ],
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

describe('HTTP: Commands', function () {
    beforeEach(function (done) {
        const provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionCommandHTTP.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        config.logLevel = 'INFO';

        nock.cleanAll();

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/registrations')
            .reply(201, null, { Location: '/v2/registrations/6319a7f5254b05844116584d' });

        iotagentMqtt.start(config, function () {
            request(provisionOptions, function (error, response, body) {
                done();
            });
        });
    });

    afterEach(function (done) {
        nock.cleanAll();
        async.series([iotAgentLib.clearAll, iotagentMqtt.stop], done);
    });

    describe('When a command arrive to the Agent for a device with the HTTP protocol', function () {
        const commandOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/v2/op/update',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateCommand1.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus1.json')
                )
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus6.json')
                )
                .reply(204);

            mockedClientServer = nock('http://localhost:9876')
                .post('/command', function (body) {
                    return body.PING || body.PING.data || body.PING.data === 22;
                })
                .reply(200, '{"PING":{"data":"22"}}');
        });

        it('should return a 204 OK without errors', function (done) {
            request(commandOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(204);
                done();
            });
        });
        it('should update the status in the Context Broker', function (done) {
            request(commandOptions, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
        it('should publish the command information in the HTTP endpoint', function (done) {
            request(commandOptions, function (error, response, body) {
                setTimeout(function () {
                    mockedClientServer.done();
                    done();
                }, 100);
            });
        });
    });
});

describe('HTTP: Commands with expressions', function () {
    beforeEach(function (done) {
        const provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionCommandHTTP2.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        config.logLevel = 'INFO';

        nock.cleanAll();

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/registrations')
            .reply(201, null, { Location: '/v2/registrations/6319a7f5254b05844116584d' });

        iotagentMqtt.start(config, function () {
            request(provisionOptions, function (error, response, body) {
                done();
            });
        });
    });

    afterEach(function (done) {
        nock.cleanAll();
        async.series([iotAgentLib.clearAll, iotagentMqtt.stop], done);
    });

    describe('When a command arrive to the Agent for a device with the HTTP protocol', function () {
        const commandOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/v2/op/update',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateCommand1.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus1.json')
                )
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus6.json')
                )
                .reply(204);

            mockedClientServer = nock('http://localhost:9876')
                .post('/command', function (body) {
                    return body || body === 'MQTT_2AnMQTTDevice';
                })
                .reply(200, '{"PING":{"data":"22"}}');
        });

        it('should return a 204 OK without errors', function (done) {
            request(commandOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(204);
                done();
            });
        });
        it('should update the status in the Context Broker', function (done) {
            request(commandOptions, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
        it('should publish the command information in the HTTP endpoint', function (done) {
            request(commandOptions, function (error, response, body) {
                setTimeout(function () {
                    mockedClientServer.done();
                    done();
                }, 100);
            });
        });
    });
});

describe('HTTP: Commands from groups', function () {
    beforeEach(function (done) {
        config.logLevel = 'INFO';

        nock.cleanAll();

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/registrations')
            .reply(201, null, { Location: '/v2/registrations/6319a7f5254b05844116584d' });

        iotagentMqtt.start(config, function () {
            done();
        });
    });

    afterEach(function (done) {
        nock.cleanAll();
        async.series([iotAgentLib.clearAll, iotagentMqtt.stop], done);
    });
    describe('When a POST measure arrives for an unprovisioned device in a command group', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                h: '33'
            },
            headers: {
                'fiware-service': 'smartgondor',
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
        beforeEach(function (done) {
            //contextBrokerUnprovMock = nock('http://192.168.1.1:1026');

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/unprovisionedDevice3.json')
                )
                .reply(204);

            request(groupCreation, function (error, response, body) {
                done();
            });
        });

        it('should send its value to the Context Broker', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });

        it('should not add a transport to the registered devices', function (done) {
            const getDeviceOptions = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
                method: 'GET',
                headers: {
                    'fiware-service': 'smartgondor',
                    'fiware-servicepath': '/gardens'
                },
                qs: {
                    i: 'JSON_UNPROVISIONED',
                    k: 'KL223HHV8732SFL1'
                }
            };
            request(optionsMeasure, function (error, result, body) {
                request(getDeviceOptions, function (error, response, body) {
                    should.not.exist(error);
                    response.statusCode.should.equal(200);
                    should.not.exist(body.devices[0].transport);
                    done();
                });
            });
        });

        describe('When a command arrive to the Agent for a device with the HTTP protocol', function () {
            const commandOptions = {
                url: 'http://localhost:' + config.iota.server.port + '/v2/op/update',
                method: 'POST',
                json: utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateCommand2.json'),
                headers: {
                    'fiware-service': 'smartgondor',
                    'fiware-servicepath': '/gardens'
                }
            };
            beforeEach(function () {
                contextBrokerMock
                    .matchHeader('fiware-service', 'smartgondor')
                    .matchHeader('fiware-servicepath', '/gardens')
                    .post(
                        '/v2/entities?options=upsert',
                        utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus9.json')
                    )
                    .reply(204);
                contextBrokerMock
                    .matchHeader('fiware-service', 'smartgondor')
                    .matchHeader('fiware-servicepath', '/gardens')
                    .post(
                        '/v2/entities?options=upsert',
                        utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus10.json')
                    )
                    .reply(204);
                mockedClientServer = nock('http://localhost:9876')
                    .post('/command', function (body) {
                        return body.cmd1 || body.cmd1.data || body.cmd1.data === 22;
                    })
                    .reply(200, '{"cmd1":{"data":"22"}}');
            });
            it('should return a 204 OK without errors', function (done) {
                request(optionsMeasure, function (error, result, body) {
                    request(commandOptions, function (error, response, body) {
                        should.not.exist(error);
                        response.statusCode.should.equal(204);
                        contextBrokerMock.done();
                        done();
                    });
                });
            });
        });
    });
});
