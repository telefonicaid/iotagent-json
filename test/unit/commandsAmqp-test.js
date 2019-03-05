/*
 * Copyright 2017 Telefonica Investigación y Desarrollo, S.A.U
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

var iotagentMqtt = require('../../'),
    config = require('../config-test.js'),
    nock = require('nock'),
    async = require('async'),
    request = require('request'),
    utils = require('../utils'),
    should = require('should'),
    iotAgentLib = require('iotagent-node-lib'),
    amqp = require('amqplib/callback_api'),
    apply = async.apply,
    contextBrokerMock,
    oldTransport,
    amqpConn,
    channel;

function startConnection(exchange, callback) {
    amqp.connect(
        'amqp://localhost',
        function(err, conn) {
            amqpConn = conn;

            conn.createChannel(function(err, ch) {
                ch.assertExchange(exchange, 'topic', {});

                channel = ch;
                callback(err);
            });
        }
    );
}

describe('AMQP Transport binding: commands', function() {
    beforeEach(function(done) {
        var provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionCommand5.json'),
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

        oldTransport = config.defaultTransport;
        config.defaultTransport = 'AMQP';

        async.series(
            [
                apply(iotagentMqtt.start, config),
                apply(request, provisionOptions),
                apply(startConnection, config.amqp.exchange)
            ],
            done
        );
    });

    afterEach(function(done) {
        nock.cleanAll();

        amqpConn.close();

        config.defaultTransport = oldTransport;

        async.series([iotAgentLib.clearAll, iotagentMqtt.stop], done);
    });

    describe('When a command arrive to the Agent for a device with the AMQP protocol', function() {
        var commandOptions = {
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
                done();
            });
        });
        it('should update the status in the Context Broker', function(done) {
            request(commandOptions, function(error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
        it('should publish the command information in the AMQP topic', function(done) {
            var commandMsg = '{"PING":{"data":"22"}}',
                payload;

            channel.assertExchange(config.amqp.exchange, 'topic', config.amqp.options);

            channel.assertQueue('client-queue', { exclusive: false }, function(err, q) {
                channel.bindQueue(q.queue, config.amqp.exchange, '.' + config.defaultKey + '.MQTT_2.cmd');

                channel.consume(
                    q.queue,
                    function(msg) {
                        payload = msg.content.toString();
                    },
                    { noAck: true }
                );

                request(commandOptions, function(error, response, body) {
                    setTimeout(function() {
                        should.exist(payload);
                        payload.should.equal(commandMsg);
                        done();
                    }, 1000);
                });
            });
        });
    });

    describe('When a command update arrives to the AMQP command topic', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/updateStatus2.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus2Success.json'));
        });

        it('should send an update request to the Context Broker', function(done) {
            channel.assertExchange(config.amqp.exchange, 'topic', config.amqp.options);
            channel.publish(config.amqp.exchange, '.1234.MQTT_2.cmdexe', new Buffer('{"PING":"1234567890"}'));

            setTimeout(function() {
                contextBrokerMock.done();
                done();
            }, 1000);
        });
    });

    describe('When a command update arrives with a single text value', function() {
        var provisionOptionsAlt = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
                method: 'POST',
                json: utils.readExampleFile('./test/deviceProvisioning/provisionCommand6.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            },
            configurationOptions = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/services',
                method: 'POST',
                json: utils.readExampleFile('./test/deviceProvisioning/provisionGroup1.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            },
            commandOptions = {
                url: 'http://localhost:' + config.iota.server.port + '/v1/updateContext',
                method: 'POST',
                json: utils.readExampleFile('./test/contextRequests/updateCommand3.json'),
                headers: {
                    'fiware-service': 'smartGondor',
                    'fiware-servicepath': '/gardens'
                }
            };

        beforeEach(function(done) {
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

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/updateStatus3.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus1Success.json'));

            request(configurationOptions, function(error, response, body) {
                request(provisionOptionsAlt, function(error, response, body) {
                    done();
                });
            });
        });

        it('should publish the command information in the AMQP topic', function(done) {
            var commandMsg = '{"PING":"22"}',
                payload;

            channel.assertExchange(config.amqp.exchange, 'topic', config.amqp.options);

            channel.assertQueue('client-queue', { exclusive: false }, function(err, q) {
                channel.bindQueue(q.queue, config.amqp.exchange, '.ALTERNATIVE.MQTT_4.cmd');

                channel.consume(
                    q.queue,
                    function(msg) {
                        payload = msg.content.toString();
                    },
                    { noAck: true }
                );

                request(commandOptions, function(error, response, body) {
                    setTimeout(function() {
                        should.exist(payload);
                        payload.should.equal(commandMsg);
                        done();
                    }, 1000);
                });
            });
        });
    });
});
