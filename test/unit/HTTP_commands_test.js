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
 */

/* eslint-disable no-unused-vars */

const iotagentMqtt = require('../../');
const config = require('../config-test.js');
const nock = require('nock');
const should = require('should');
const iotAgentLib = require('iotagent-node-lib');
const async = require('async');
const request = require('request');
const utils = require('../utils');
let mockedClientServer;
let contextBrokerMock;

describe('HTTP: Commands', function() {
    beforeEach(function(done) {
        const provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionCommandHTTP.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };

        config.logLevel = 'INFO';

        nock.cleanAll();

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/NGSI9/registerContext')
            .reply(200, utils.readExampleFile('./test/contextAvailabilityResponses/registerIoTAgent1Success.json'));

        contextBrokerMock
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus1Success.json'));

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

    describe('When a command arrive to the Agent for a device with the HTTP protocol', function() {
        const commandOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/v1/updateContext',
            method: 'POST',
            json: utils.readExampleFile('./test/contextRequests/updateCommand1.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/updateStatus1.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus1Success.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/updateStatus6.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus1Success.json'));

            mockedClientServer = nock('http://localhost:9876')
                .post('/command', function(body) {
                    return body.PING || body.PING.data || body.PING.data === 22;
                })
                .reply(200, '{"PING":{"data":"22"}}');
        });

        it('should return a 200 OK without errors', function(done) {
            request(commandOptions, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });
        it('should reply with the appropriate command information', function(done) {
            request(commandOptions, function(error, response, body) {
                should.exist(body);
                body.contextResponses['0'].statusCode.code.should.equal(200);
                done();
            });
        });
        it('should update the status in the Context Broker', function(done) {
            request(commandOptions, function(error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
        it('should publish the command information in the MQTT topic', function(done) {
            request(commandOptions, function(error, response, body) {
                setTimeout(function() {
                    mockedClientServer.done();
                    done();
                }, 100);
            });
        });
    });
});
