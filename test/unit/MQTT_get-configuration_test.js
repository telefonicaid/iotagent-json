/*
 * Copyright 2015 Telefonica Investigación y Desarrollo, S.A.U
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
'use strict';

var iotagentMqtt = require('../../'),
    mqtt = require('mqtt'),
    config = require('../config-test.js'),
    nock = require('nock'),
    should = require('should'),
    iotAgentLib = require('iotagent-node-lib'),
    async = require('async'),
    request = require('request'),
    utils = require('../utils'),
    contextBrokerMock,
    oldConfigurationFlag,
    mqttClient;

describe('MQTT: Get configuration from the devices', function() {
    beforeEach(function(done) {
        var provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionDevice1.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        mqttClient = mqtt.connect('mqtt://' + config.mqtt.host, {
            keepalive: 0,
            connectTimeout: 60 * 60 * 1000
        });

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

        oldConfigurationFlag = config.configRetrieval;
        config.configRetrieval = true;

        iotagentMqtt.start(config, function() {
            request(provisionOptions, function(error, response, body) {
                done();
            });
        });
    });

    afterEach(function(done) {
        config.configRetrieval = oldConfigurationFlag;

        nock.cleanAll();
        mqttClient.end();

        async.series([
            iotAgentLib.clearAll,
            iotagentMqtt.stop
        ], done);
    });
    describe('When a configuration request is received in the topic ' +
        '"/{{apikey}}/{{deviceid}}/configuration/commands"', function() {
        var values = {
                type: 'configuration',
                fields: [
                    'sleepTime',
                    'warningLevel'
                ]
            },
            configurationReceived;

        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/queryContext', utils.readExampleFile('./test/contextRequests/getConfiguration.json'))
                .reply(200,
                utils.readExampleFile('./test/contextResponses/getConfigurationSuccess.json'));

            mqttClient.subscribe('/1234/MQTT_2/configuration/values', null);

            configurationReceived = false;
        });

        afterEach(function(done) {
            mqttClient.unsubscribe('/1234/MQTT_2/configuration/values', null);

            done();
        });

        it('should ask the Context Broker for the request attributes', function(done) {
            mqttClient.publish('/1234/MQTT_2/configuration/commands', JSON.stringify(values), null, function(error) {
                setTimeout(function() {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });

        it('should return the requested attributes to the client in /1234/MQTT_2/configuration/values',
            function(done) {
                mqttClient.on('message', function(topic, data) {
                    var result = JSON.parse(data);

                    configurationReceived =
                        result.sleepTime && result.sleepTime === '200' &&
                        result.warningLevel && result.warningLevel === '80';
                });

                mqttClient.publish('/1234/MQTT_2/configuration/commands', JSON.stringify(values), null,
                    function(error) {
                        setTimeout(function() {
                            configurationReceived.should.equal(true);
                            done();
                        }, 100);
                });
        });

        it('should add the system timestamp in compressed format to the request',
            function(done) {
                mqttClient.on('message', function(topic, data) {
                    var result = JSON.parse(data);

                    configurationReceived = result.dt && result.dt.should.match(/^\d{8}T\d{6}Z$/);
                });

                mqttClient.publish('/1234/MQTT_2/configuration/commands', JSON.stringify(values), null,
                    function(error) {
                        setTimeout(function() {
                            should.exist(configurationReceived);
                            done();
                        }, 100);
                    });
            });
    });

    describe('When a subscription request is received in the IoT Agent', function() {
        var values = {
                type: 'subscription',
                fields: [
                    'sleepTime',
                    'warningLevel'
                ]
            },
            configurationReceived;

        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/subscribeContext', utils.readExampleFile('./test/subscriptions/subscriptionRequest.json'))
                .reply(200,
                    utils.readExampleFile('./test/subscriptions/subscriptionResponse.json'));

            mqttClient.subscribe('/1234/MQTT_2/configuration/values', null);

            configurationReceived = false;
        });

        afterEach(function(done) {
            mqttClient.unsubscribe('/1234/MQTT_2/configuration/values', null);

            done();
        });

        it('should create a subscription in the ContextBroker',
            function(done) {
                mqttClient.publish('/1234/MQTT_2/configuration/commands', JSON.stringify(values), null,
                    function(error) {
                        setTimeout(function() {
                            contextBrokerMock.done();
                            done();
                        }, 100);
                    });
            });
        it('should update the values in the MQTT topic when a notification is received',
            function(done) {
                var optionsNotify = {
                    url: 'http://localhost:' + config.iota.server.port + '/notify',
                    method: 'POST',
                    json: utils.readExampleFile('./test/subscriptions/notification.json'),
                    headers: {
                        'fiware-service': 'smartGondor',
                        'fiware-servicepath': '/gardens'
                    }
                };

                mqttClient.on('message', function(topic, data) {
                    var result = JSON.parse(data);

                    configurationReceived = result.sleepTime === '200' && result.warningLevel === 'ERROR';
                });

                mqttClient.publish('/1234/MQTT_2/configuration/commands', JSON.stringify(values), null,
                    function(error) {
                        setTimeout(function() {
                            request(optionsNotify, function(error, response, body) {
                                setTimeout(function() {
                                    configurationReceived.should.equal(true);
                                    done();
                                }, 100);
                            });
                        }, 100);
                    });
            });
    });
});
