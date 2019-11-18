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
'use strict';

var iotagentMqtt = require('../../../'),
    mqtt = require('mqtt'),
    config = require('./config-test.js'),
    nock = require('nock'),
    should = require('should'),
    iotAgentLib = require('iotagent-node-lib'),
    async = require('async'),
    request = require('request'),
    utils = require('../../utils'),
    contextBrokerMock,
    mqttClient;

describe('MQTT: Commands', function() {
    beforeEach(function(done) {
        var provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionCommand1.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };

        config.logLevel = 'INFO';

        nock.cleanAll();

        mqttClient = mqtt.connect(
            'mqtt://' + config.mqtt.host,
            {
                keepalive: 0,
                connectTimeout: 60 * 60 * 1000
            }
        );

        mqttClient.subscribe('/1234/MQTT_2/cmd', null);

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/registrations')
            .reply(201, null, { Location: '/v2/registrations/6319a7f5254b05844116584d' });

        contextBrokerMock
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/entities?options=upsert')
            .reply(204);

        iotagentMqtt.start(config, function() {
            request(provisionOptions, function(error, response, body) {
                done();
            });
        });
    });

    afterEach(function(done) {
        nock.cleanAll();
        mqttClient.unsubscribe('/1234/MQTT_2/cmd', null);
        mqttClient.end();

        async.series([iotAgentLib.clearAll, iotagentMqtt.stop], done);
    });

    describe('When a command arrive to the Agent for a device with the MQTT_UL protocol', function() {
        var commandOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/v2/op/update',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateCommand1.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities/Second%20MQTT%20Device/attrs?type=AnMQTTDevice',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus1.json')
                )
                .reply(204);
        });

        it('should return a 204 OK without errors', function(done) {
            request(commandOptions, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(204);
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
            var commandMsg = '{"PING":{"data":"22"}}',
                payload;

            mqttClient.on('message', function(topic, data) {
                payload = data.toString();
            });

            request(commandOptions, function(error, response, body) {
                setTimeout(function() {
                    should.exist(payload);
                    payload.should.equal(commandMsg);
                    done();
                }, 100);
            });
        });
    });

    describe('When a command update arrives to the MQTT command topic', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/op/update', utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus2.json'))
                .reply(204);
        });

        it('should send an update request to the Context Broker', function(done) {
            mqttClient.publish('/1234/MQTT_2/cmdexe', '{ "PING": "1234567890" }', null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 200);
            });
        });
    });
});
