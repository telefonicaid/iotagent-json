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
 *
 * Modified by: Daniel Calvo - ATOS Research & Innovation
 */

'use strict';

var iotaJson = require('../../../'),
    config = require('./config-test.js'),
    nock = require('nock'),
    async = require('async'),
    request = require('request'),
    utils = require('../../utils'),
    iotAgentLib = require('iotagent-node-lib'),
    amqp = require('amqplib/callback_api'),
    apply = async.apply,
    contextBrokerMock,
    amqpConn,
    oldResource,
    channel;

function startConnection(exchange, callback) {
    amqp.connect('amqp://localhost', function(err, conn) {
        amqpConn = conn;

        conn.createChannel(function(err, ch) {
            ch.assertExchange(exchange, 'topic', {});

            channel = ch;
            callback(err);
        });
    });
}

describe('AMQP Transport binding: measures', function() {
    beforeEach(function(done) {
        var provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionDeviceAMQP1.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        oldResource = config.iota.defaultResource;
        config.iota.defaultResource = '/iot/json';

        // This mock does not check the payload since the aim of the test is not to verify
        // device provisioning functionality. Appropriate verification is done in tests under
        // provisioning folder of iotagent-node-lib
        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/entities?options=upsert')
            .reply(204);

        async.series([
            apply(iotaJson.start, config),
            apply(request, provisionOptions),
            apply(startConnection, config.amqp.exchange)
        ], done);
    });

    afterEach(function(done) {
        nock.cleanAll();

        amqpConn.close();
        config.iota.defaultResource = oldResource;

        async.series([
            iotAgentLib.clearAll,
            iotaJson.stop
        ], done);
    });

    describe('When a new single measure arrives to a Device routing key', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasureAMQP.json'))
                .reply(204);
        });

        it('should send a new update context request to the Context Broker with just that attribute', function(done) {
            channel.publish(config.amqp.exchange, '.1234.MQTT_2.attrs.a', new Buffer('23'));

            setTimeout(function() {
                contextBrokerMock.done();
                done();
            }, 100);
        });
    });

    describe('When a new measure arrives for an unprovisioned Device', function() {
        var groupCreation = {
            url: 'http://localhost:4041/iot/services',
            method: 'POST',
            json: utils.readExampleFile('./test/groupProvisioning/provisionFullGroupAMQP.json'),
            headers: {
                'fiware-service': 'TestService',
                'fiware-servicepath': '/testingPath'
            }
        };

        beforeEach(function(done) {
            
            // This mock does not check the payload since the aim of the test is not to verify
            // device provisioning functionality. Appropriate verification is done in tests under
            // provisioning folder of iotagent-node-lib
            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'TestService')
                .matchHeader('fiware-servicepath', '/testingPath')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'TestService')
                .matchHeader('fiware-servicepath', '/testingPath')
                .post('/v2/entities/SensorMachine:JSON_UNPROVISIONED/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/unprovisionedMeasure.json'))
                .reply(204);

            request(groupCreation, function(error, response, body) {
                done();
            });
        });

        it('should send a new update context request to the Context Broker with just that attribute', function(done) {
            channel.publish(config.amqp.exchange, '.80K09H324HV8732.JSON_UNPROVISIONED.attrs.a', new Buffer('23'));

            setTimeout(function() {
                contextBrokerMock.done();
                done();
            }, 100);
        });
    });

    describe('When a new multiple measure arrives to a Device routing key with one measure', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasureAMQP.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));
        });

        it('should send a single update context request with all the attributes', function(done) {
            channel.publish(config.amqp.exchange, '.1234.MQTT_2.attrs', new Buffer(
                JSON.stringify({a: '23'})
            ));

            setTimeout(function() {
                contextBrokerMock.done();
                done();
            }, 100);
        });
    });

    describe('When a new multiple measure arrives to a Device routing key with a faulty payload', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/singleMeasureAMQP.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));
        });

        it('should silently ignore the error (without crashing)', function(done) {
            channel.publish(config.amqp.exchange, '.1234.MQTT_2.attrs', new Buffer('notAULPayload '));

            setTimeout(function() {
                done();
            }, 100);
        });
    });

    describe('When single message with multiple measures arrive to a Device routing key', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasure.json'))
                .reply(204);
        });

        it('should send one update context per measure group to the Contet Broker', function(done) {
            channel.publish(config.amqp.exchange, '.1234.MQTT_2.attrs', new Buffer(
                JSON.stringify({
                    a: '23',
                    b: '98'
                })
            ));

            setTimeout(function() {
                contextBrokerMock.done();
                done();
            }, 100);
        });
    });
});
