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

var iotagentJson = require('../../'),
    config = require('../config-test.js'),
    nock = require('nock'),
    iotAgentLib = require('iotagent-node-lib'),
    should = require('should'),
    request = require('request'),
    utils = require('../utils'),
    mockedClientServer,
    contextBrokerMock;

describe('Data Bidirectionality: HTTP', function() {
    var notificationOptions = {
        url: 'http://localhost:' + config.iota.server.port + '/notify',
        method: 'POST',
        json: utils.readExampleFile('./test/subscriptions/bidirectionalNotification.json'),
        headers: {
            'fiware-service': 'smartGondor',
            'fiware-servicepath': '/gardens'
        }
    };

    afterEach(function(done) {
        nock.cleanAll();

        iotAgentLib.clearAll(function() {
            iotagentJson.stop(done);
        });
    });

    describe('When a bidirectional attribute is set and a new value arrives to a device without endpoint', function() {
        beforeEach(function(done) {
            var provisionOptions = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
                method: 'POST',
                json: utils.readExampleFile('./test/deviceProvisioning/provisionCommandBidirectional.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            };

            nock.cleanAll();

            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/subscribeContext', utils.readExampleFile(
                    './test//subscriptions/bidirectionalSubscriptionRequest.json'))
                .reply(200, utils.readExampleFile(
                    './test/subscriptionResponses/bidirectionalSubscriptionSuccess.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile(
                    './test/contextRequests/createBidirectionalDevice.json'))
                .reply(200, utils.readExampleFile(
                    './test/contextResponses/createBidirectionalDeviceSuccess.json'));

            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/unsubscribeContext', utils.readExampleFile(
                    './test/subscriptions/simpleSubscriptionRemove.json'))
                .reply(200, utils.readExampleFile(
                    './test/subscriptionResponses/bidirectionalSubscriptionSuccess.json'));

            iotagentJson.start(config, function(error) {
                request(provisionOptions, function(error, response, body) {
                    done();
                });
            });
        });

        it('should return a 200 OK', function(done) {
            request(notificationOptions, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });

        it('should leave the data in the polling queue', function(done) {
            request(notificationOptions, function(error, response, body) {
                iotAgentLib.commandQueue('smartGondor', '/gardens', 'MQTT_2', function(error, list) {
                    should.not.exist(error);

                    list.commands.length.should.equal(3);
                    done();
                });
            });
        });

        it('should send all the data from the notification in command syntax', function(done) {
            request(notificationOptions, function(error, response, body) {
                iotAgentLib.commandQueue('smartGondor', '/gardens', 'MQTT_2', function(error, list) {
                    var latitudeFound = false,
                        longitudeFound = false;

                    for (var i = 0; i < list.commands.length; i++) {
                        if (list.commands[i].name === 'latitude' &&
                            list.commands[i].type === 'string' &&
                            list.commands[i].value === '-9.6') {
                            latitudeFound = true;
                        }

                        if (list.commands[i].name === 'longitude' &&
                            list.commands[i].type === 'string' &&
                            list.commands[i].value === '12.4') {
                            longitudeFound = true;
                        }
                    }

                    latitudeFound.should.equal(true);
                    longitudeFound.should.equal(true);

                    done();
                });
            });
        });
    });

    describe('When a bidirectional attribute is set and a new value arrives to a device with endpoint', function() {
        beforeEach(function(done) {
            var provisionOptions = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
                method: 'POST',
                json: utils.readExampleFile('./test/deviceProvisioning/provisionCommandBidirectionalWithUrl.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            };

            nock.cleanAll();

            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/subscribeContext', utils.readExampleFile(
                    './test//subscriptions/bidirectionalSubscriptionRequest.json'))
                .reply(200, utils.readExampleFile(
                    './test/subscriptionResponses/bidirectionalSubscriptionSuccess.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile(
                    './test/contextRequests/createBidirectionalDevice.json'))
                .reply(200, utils.readExampleFile(
                    './test/contextResponses/createBidirectionalDeviceSuccess.json'));

            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/unsubscribeContext', utils.readExampleFile(
                    './test/subscriptions/simpleSubscriptionRemove.json'))
                .reply(200, utils.readExampleFile(
                    './test/subscriptionResponses/bidirectionalSubscriptionSuccess.json'));

            mockedClientServer = nock('http://localhost:9876')
                .post('/command', '{"location":"12.4, -9.6"}')
                .reply(200, '')
                .post('/command', '{"latitude":"-9.6"}')
                .reply(200, '')
                .post('/command', '{"longitude":"12.4"}')
                .reply(200, '');

            iotagentJson.start(config, function(error) {
                request(provisionOptions, function(error, response, body) {
                    done();
                });
            });
        });

        it('should return a 200 OK', function(done) {
            request(notificationOptions, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });

        it('should send all the data from the notification in command syntax', function(done) {
            request(notificationOptions, function(error, response, body) {
                mockedClientServer.done();
                done();
            });
        });
    });
});
