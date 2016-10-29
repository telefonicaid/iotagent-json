/*
 * Copyright 2016 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of iotagent-ul
 *
 * iotagent-ul is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * iotagent-ul is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with iotagent-ul.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[iot_support@tid.es]
 */

'use strict';

var iotagentUl = require('../../'),
    config = require('../config-test.js'),
    nock = require('nock'),
    iotAgentLib = require('iotagent-node-lib'),
    should = require('should'),
    request = require('request'),
    utils = require('../utils'),
    mockedClientServer,
    contextBrokerMock;

describe('HTTP Transport binding: polling commands', function() {
    var commandOptions = {
        url: 'http://localhost:' + config.iota.server.port + '/v1/updateContext',
        method: 'POST',
        json: utils.readExampleFile('./test/contextRequests/updateCommand1.json'),
        headers: {
            'fiware-service': 'smartGondor',
            'fiware-servicepath': '/gardens'
        }
    };

    beforeEach(function(done) {
        var provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionCommand4.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/NGSI9/registerContext')
            .reply(200,
                utils.readExampleFile('./test/contextAvailabilityResponses/registerIoTAgent1Success.json'));

        contextBrokerMock
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus1Success.json'));

        mockedClientServer = nock('http://localhost:9876')
            .post('/command', 'MQTT_2@PING|data=22')
            .reply(200, 'MQTT_2@PING|1234567890');

        contextBrokerMock
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus2Success.json'));

        iotagentUl.start(config, function(error) {
            request(provisionOptions, function(error, response, body) {
                done();
            });
        });
    });

    afterEach(function(done) {
        nock.cleanAll();

        iotAgentLib.clearAll(function() {
            iotagentUl.stop(done);
        });
    });

    describe('When a command arrives to the IoTA with HTTP transport and no endpoint', function() {
        it('should return a 200 OK without errors', function(done) {
            request(commandOptions, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });

        it('should be stored in the commands collection', function(done) {
            request(commandOptions, function(error, response, body) {
                iotAgentLib.commandQueue('smartGondor', '/gardens', 'MQTT_2', function(error, list) {
                    should.not.exist(error);
                    list.count.should.equal(1);
                    list.commands[0].name.should.equal('PING');
                    done();
                });
            });
        });
    });

    describe('When a device asks for the pending commands', function() {
        var deviceRequest = {
            url: 'http://localhost:' + config.http.port + '/iot/d',
            method: 'POST',
            json: {
                a: 23
            },
            qs: {
                i: 'MQTT_2',
                k: '1234',
                getCmd: 1
            }
        };

        beforeEach(function(done) {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/pollingMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/pollingMeasureSuccess.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/updateStatus4.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus4Success.json'));

            request(commandOptions, done);
        });

        it('should return a list of the pending commands', function(done) {
            request(deviceRequest, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                should.exist(body.PING);
                should.exist(body.PING.data);
                body.PING.data.should.equal('22');
                done();
            });
        });

        it('should be marked as delivered in the Context Broker', function(done) {
            request(deviceRequest, function(error, response, body) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 50);
            });
        });

        it('should remove them from the IoTAgent', function(done) {
            request(deviceRequest, function(error, response, body) {
                iotAgentLib.commandQueue('smartGondor', '/gardens', 'MQTT_2', function(error, list) {
                    should.not.exist(error);
                    list.count.should.equal(0);
                    done();
                });
            });
        });
    });

    describe('When a device asks for the list of commands and there is more than one command', function() {
        it('should retrieve the list sepparated by the "#" character');
    });

    describe('When a device sends the result for a pending command', function() {
        var commandResponse = {
            uri: 'http://localhost:' + config.http.port + '/iot/d/commands',
            method: 'POST',
            json: {
                PING: 'MADE_OK'
            },
            qs: {
                i: 'MQTT_2',
                k: '1234'
            }
        };

        beforeEach(function(done) {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/updateStatus5.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus4Success.json'));

            request(commandOptions, done);
        });

        it('should update the entity in the Context Broker with the OK status and the result', function(done) {
            request(commandResponse, function(error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When the device sends the result for multiple pending commands', function() {
        it('should make all the updates in the Context Broker');
    });

    describe('When a device sends measures and command responses mixed in a message', function() {
        it('should send both the command updates and the measures to the Context Broker');
    });
});
