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
 *
 * Modified by: Daniel Calvo - ATOS Research & Innovation
 */

'use strict';

var iotagentJson = require('../../../'),
    config = require('./config-test.js'),
    nock = require('nock'),
    iotAgentLib = require('iotagent-node-lib'),
    should = require('should'),
    request = require('request'),
    utils = require('../../utils'),
    moment = require('moment'),
    mockedClientServer,
    contextBrokerMock;

describe('Data Bidirectionality: HTTP', function() {
    var notificationOptions = {
        url: 'http://localhost:' + config.iota.server.port + '/notify',
        method: 'POST',
        json: utils.readExampleFile('./test/unit/ngsiv2/subscriptions/bidirectionalNotification.json'),
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
                .post('/v2/subscriptions', function(body) {

                    var expectedBody = utils.readExampleFile(
                    './test/unit/ngsiv2/subscriptions/bidirectionalSubscriptionRequest.json');
                    // Note that expired field is not included in the json used by this mock as it is a dynamic
                    // field. The following code performs such calculation and adds the field to the subscription
                    // payload of the mock.
                    if (!body.expires)
                    {
                        return false;
                    }
                    else if (moment(body.expires, 'YYYY-MM-DDTHH:mm:ss.SSSZ').isValid())
                    {
                        expectedBody.expires = moment().add(config.deviceRegistrationDuration);
                        var expiresDiff = moment(expectedBody.expires).diff(body.expires, 'milliseconds');
                        if (expiresDiff < 500) {
                            delete expectedBody.expires;
                            delete body.expires;

                            return JSON.stringify(body) === JSON.stringify(expectedBody);
                        }

                        return false;
                    }
                    else {
                        return false;
                    }
                })
                .reply(201, null, {'Location': '/v2/subscriptions/51c0ac9ed714fb3b37d7d5a8'});

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert', utils.readExampleFile(
                    './test/unit/ngsiv2/contextRequests/createBidirectionalDevice.json'))
                .reply(204);


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
                .post('/v2/subscriptions', function(body) {

                    var expectedBody = utils.readExampleFile(
                    './test/unit/ngsiv2/subscriptions/bidirectionalSubscriptionRequest.json');
                    // Note that expired field is not included in the json used by this mock as it is a dynamic
                    // field. The following code performs such calculation and adds the field to the subscription
                    // payload of the mock.
                    if (!body.expires)
                    {
                        return false;
                    }
                    else if (moment(body.expires, 'YYYY-MM-DDTHH:mm:ss.SSSZ').isValid())
                    {
                        expectedBody.expires = moment().add(config.deviceRegistrationDuration);
                        var expiresDiff = moment(expectedBody.expires).diff(body.expires, 'milliseconds');
                        if (expiresDiff < 500) {
                            delete expectedBody.expires;
                            delete body.expires;

                            return JSON.stringify(body) === JSON.stringify(expectedBody);
                        }

                        return false;
                    }
                    else {
                        return false;
                    }
                })
                .reply(201, null, {'Location': '/v2/subscriptions/51c0ac9ed714fb3b37d7d5a8'});

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert', utils.readExampleFile(
                    './test/unit/ngsiv2/contextRequests/createBidirectionalDevice.json'))
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .delete('/v2/subscriptions/51c0ac9ed714fb3b37d7d5a8')
                .reply(204);

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
