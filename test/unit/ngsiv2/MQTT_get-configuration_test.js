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

/* eslint-disable no-unused-vars */

const iotagentMqtt = require('../../../');
const mqtt = require('mqtt');
const config = require('./config-test.js');
const nock = require('nock');
const should = require('should');
const iotAgentLib = require('iotagent-node-lib');
const async = require('async');

const utils = require('../../utils');
const request = utils.request;
let contextBrokerMock;
let oldConfigurationFlag;
let mqttClient;

describe('MQTT: Get configuration from the devices', function () {
    beforeEach(function (done) {
        const provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionDevice1.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        mqttClient = mqtt.connect('mqtt://' + config.mqtt.host, {
            keepalive: 0,
            connectTimeout: 60 * 60 * 1000
        });

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/entities?options=upsert')
            .reply(204);

        oldConfigurationFlag = config.configRetrieval;
        config.configRetrieval = true;

        iotagentMqtt.start(config, function () {
            request(provisionOptions, function (error, response, body) {
                done();
            });
        });
    });

    afterEach(function (done) {
        config.configRetrieval = oldConfigurationFlag;

        nock.cleanAll();
        mqttClient.end();

        async.series([iotAgentLib.clearAll, iotagentMqtt.stop], done);
    });
    describe(
        /* eslint-disable no-useless-concat */
        'When a configuration request is received in the topic ' + '"/{{apikey}}/{{deviceid}}/configuration/commands"',
        function () {
            const values = {
                type: 'configuration',
                fields: ['sleepTime', 'warningLevel']
            };
            let configurationReceived;

            beforeEach(function () {
                contextBrokerMock
                    .matchHeader('fiware-service', 'smartgondor')
                    .matchHeader('fiware-servicepath', '/gardens')
                    .get('/v2/entities/Second%20MQTT%20Device/attrs?attrs=sleepTime,warningLevel&type=AnMQTTDevice')
                    .reply(200, {
                        id: 'Second%20MQTT%20Device',
                        type: 'AnMQTTDevice',
                        sleepTime: {
                            type: 'Boolean',
                            value: '200'
                        },
                        warningLevel: {
                            type: 'Percentage',
                            value: '80'
                        }
                    });
                mqttClient.subscribe('/1234/MQTT_2/configuration/values', null);

                configurationReceived = false;
            });

            afterEach(function (done) {
                mqttClient.unsubscribe('/1234/MQTT_2/configuration/values', null);

                done();
            });

            it('should ask the Context Broker for the request attributes', function (done) {
                mqttClient.publish('/1234/MQTT_2/configuration/commands', JSON.stringify(values), null, function (
                    error
                ) {
                    setTimeout(function () {
                        contextBrokerMock.done();
                        done();
                    }, 100);
                });
            });

            it('should return the requested attributes to the client in /1234/MQTT_2/configuration/values', function (done) {
                mqttClient.on('message', function (topic, data) {
                    const result = JSON.parse(data);

                    configurationReceived =
                        result.sleepTime &&
                        result.sleepTime === '200' &&
                        result.warningLevel &&
                        result.warningLevel === '80';
                });

                mqttClient.publish('/1234/MQTT_2/configuration/commands', JSON.stringify(values), null, function (
                    error
                ) {
                    setTimeout(function () {
                        configurationReceived.should.equal(true);
                        done();
                    }, 100);
                });
            });

            it('should add the system timestamp in compressed format to the request', function (done) {
                mqttClient.on('message', function (topic, data) {
                    const result = JSON.parse(data);

                    configurationReceived = result.dt && result.dt.should.match(/^\d{8}T\d{6}Z$/);
                });

                mqttClient.publish('/1234/MQTT_2/configuration/commands', JSON.stringify(values), null, function (
                    error
                ) {
                    setTimeout(function () {
                        should.exist(configurationReceived);
                        done();
                    }, 100);
                });
            });
        }
    );

    describe('When a subscription request is received in the IoT Agent', function () {
        const values = {
            type: 'subscription',
            fields: ['sleepTime', 'warningLevel']
        };
        let configurationReceived;

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/subscriptions')
                .reply(201, null, { Location: '/v2/subscriptions/51c0ac9ed714fb3b37d7d5a8' });

            mqttClient.subscribe('/1234/MQTT_2/configuration/values', null);

            configurationReceived = false;
        });

        afterEach(function (done) {
            mqttClient.unsubscribe('/1234/MQTT_2/configuration/values', null);

            done();
        });

        it('should create a subscription in the ContextBroker', function (done) {
            mqttClient.publish('/1234/MQTT_2/configuration/commands', JSON.stringify(values), null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
        it('should update the values in the MQTT topic when a notification is received', function (done) {
            const optionsNotify = {
                url: 'http://localhost:' + config.iota.server.port + '/notify',
                method: 'POST',
                json: utils.readExampleFile('./test/subscriptions/notification.json'),
                headers: {
                    'fiware-service': 'smartgondor',
                    'fiware-servicepath': '/gardens'
                }
            };

            mqttClient.on('message', function (topic, data) {
                const result = JSON.parse(data);
                configurationReceived = result.sleepTime === '200' && result.warningLevel === 'ERROR';
            });

            mqttClient.publish('/1234/MQTT_2/configuration/commands', JSON.stringify(values), null, function (error) {
                setTimeout(function () {
                    request(optionsNotify, function (error, response, body) {
                        setTimeout(function () {
                            configurationReceived.should.equal(true);
                            done();
                        }, 100);
                    });
                }, 100);
            });
        });
    });
});
