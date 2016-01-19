/*
 * Copyright 2015 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of iotagent-mqtt
 *
 * iotagent-mqtt is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * iotagent-mqtt is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with iotagent-mqtt.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 */
'use strict';

var iotagentMqtt = require('../../'),
    iotAgentLib = require('iotagent-node-lib'),
    mqtt = require('mqtt'),
    config = require('../config-test.js'),
    nock = require('nock'),
    should = require('should'),
    request = require('request'),
    utils = require('../utils'),
    contextBrokerMock,
    mqttClient;

describe('Configuration API support', function() {
    var provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionDevice1.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        },
        configurationOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/services',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionConfiguration1.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        },
        configurationOptionsWithResource = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/services',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionConfiguration2.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };


    beforeEach(function(done) {
        nock.cleanAll();

        mqttClient = mqtt.connect('mqtt://' + config.mqtt.host, {
            keepalive: 0,
            connectTimeout: 60 * 60 * 1000
        });

        contextBrokerMock = nock('http://10.11.128.16:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

        iotagentMqtt.start(config, done);
    });

    afterEach(function(done) {
        iotAgentLib.clearAll();
        nock.cleanAll();
        mqttClient.end();
        iotagentMqtt.stop(done);
    });

    describe('When a configuration is provisioned for a service', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200,
                utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));
        });

        it('should use the API Key of that configuration in device topics', function(done) {
            request(configurationOptions, function(error, response, body) {
                request(provisionOptions, function(error, response, body) {
                    mqttClient.publish('/728289/MQTT_2/attributes/temperature', '87', null, function(error) {
                        setTimeout(function() {
                            contextBrokerMock.done();
                            done();
                        }, 100);
                    });
                });
            });
        });
    });

    describe('When a configuration is provisioned with a Resource set', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200,
                    utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));
        });

        it('should reject the configuration provisioning with a BAD FORMAT error', function(done) {
            request(configurationOptionsWithResource, function(error, response, body) {
                should.not.exist(error);

                response.statusCode.should.equal(400);
                done();
            });
        });
    });
});
