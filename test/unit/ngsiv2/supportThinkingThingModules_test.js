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
 *
 * Modified by: Daniel Calvo - ATOS Research & Innovation
 */

/* eslint-disable no-unused-vars */

const iotaJson = require('../../../');
const mqtt = require('mqtt');
const async = require('async');
const iotAgentLib = require('iotagent-node-lib');
const config = require('./config-test.js');
const nock = require('nock');
const request = require('request');
const utils = require('../../utils');
let contextBrokerMock;
let mqttClient;

describe('Support for Thinking Things Modules', function () {
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

        // This mock does not check the payload since the aim of the test is not to verify
        // device provisioning functionality. Appropriate verification is done in tests under
        // provisioning folder of iotagent-node-lib
        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/entities?options=upsert')
            .reply(204);

        iotaJson.start(config, function () {
            request(provisionOptions, function (error, response, body) {
                done();
            });
        });
    });

    afterEach(function (done) {
        nock.cleanAll();
        mqttClient.end();
        async.series([iotAgentLib.clearAll, iotaJson.stop], done);
    });

    describe('When a new measure with Thinking Thing module P1 arrives to a multiattribute topic', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/TTModuleP1.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);
        });
        it('should send its value to the Context Broker', function (done) {
            const values = {
                humidity: '32',
                P1: '214,7,d22,b00,-64,'
            };

            mqttClient.publish('/json/1234/MQTT_2/attrs', JSON.stringify(values), null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new measure with Thinking Thing module P1 arrives to a single attribute topic', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/TTModuleP1Single.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);
        });
        it('should send its value to the Context Broker', function (done) {
            const values = '214,7,d22,b00,-64,';

            mqttClient.publish('/json/1234/MQTT_2/attrs/P1', values, null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new measure with Thinking Thing module C1 arrives in multiattribute topic', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/TTModuleC1.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);
        });
        it('should send its value to the Context Broker', function (done) {
            const values = {
                humidity: '32',
                C1: '00D600070d220b00'
            };

            mqttClient.publish('/json/1234/MQTT_2/attrs', JSON.stringify(values), null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new measure with Thinking Thing module C1 arrives in the single attribute topic', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/TTModuleC1Single.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);
        });
        it('should send its value to the Context Broker', function (done) {
            const values = '00D600070d220b00';

            mqttClient.publish('/json/1234/MQTT_2/attrs/C1', values, null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new measure with Thinking Thing module B short version arrives', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/TTModuleB.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);
        });
        it('should send its value to the Context Broker', function (done) {
            const values = {
                humidity: '32',
                B: '4.70,1,1,1,1,0'
            };

            mqttClient.publish('/json/1234/MQTT_2/attrs', JSON.stringify(values), null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new measure with Thinking Thing module B long version arrives', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/TTModuleBLong.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);
        });
        it('should send its value to the Context Broker', function (done) {
            const values = {
                humidity: '32',
                B: '4.70,1,1,1,1,0,9,18'
            };

            mqttClient.publish('/json/1234/MQTT_2/attrs', JSON.stringify(values), null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });
});
