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

const iotagentMqtt = require('../../../');
const config = require('./config-test.js');
const nock = require('nock');
const should = require('should');
const iotAgentLib = require('iotagent-node-lib');
const async = require('async');

const utils = require('../../utils');
const request = utils.request;
let mockedClientServer;
let contextBrokerMock;
let oldConfigurationFlag;

describe('HTTP: Get configuration from the devices', function () {
    beforeEach(function (done) {
        const provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionCommandHTTP.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/registrations')
            .reply(201, null, { Location: '/v2/registrations/6319a7f5254b05844116584d' });

        contextBrokerMock
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
        nock.cleanAll();
        config.configRetrieval = oldConfigurationFlag;

        async.series([iotAgentLib.clearAll, iotagentMqtt.stop], done);
    });

    describe('When a configuration request is received in the path /configuration/commands', function () {
        const configurationRequest = {
            url: 'http://localhost:' + config.http.port + '/iot/json/configuration',
            method: 'POST',
            json: {
                type: 'configuration',
                fields: ['sleepTime', 'warningLevel']
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'MQTT_2',
                k: '1234'
            }
        };

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
            mockedClientServer = nock('http://localhost:9876')
                .post('/command/configuration', function (result) {
                    return (
                        result.sleepTime &&
                        result.sleepTime === '200' &&
                        result.warningLevel &&
                        result.warningLevel === '80' &&
                        result.dt
                    );
                })
                .reply(200, '');
        });

        it('should reply with a 200 OK', function (done) {
            request(configurationRequest, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });

        it('should ask the Context Broker for the request attributes', function (done) {
            request(configurationRequest, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
        it('should return the requested attributes to the client in the client endpoint', function (done) {
            request(configurationRequest, function (error, response, body) {
                mockedClientServer.done();
                done();
            });
        });
    });
    describe('When a subscription request is received in the IoT Agent', function () {
        const configurationRequest = {
            url: 'http://localhost:' + config.http.port + '/iot/json/configuration',
            method: 'POST',
            json: {
                type: 'subscription',
                fields: ['sleepTime', 'warningLevel']
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'MQTT_2',
                k: '1234'
            }
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/subscriptions')
                .reply(201, null, { Location: '/v2/subscriptions/51c0ac9ed714fb3b37d7d5a8' });

            mockedClientServer = nock('http://localhost:9876')
                .post('/command/configuration', function (result) {
                    return (
                        result.sleepTime &&
                        result.sleepTime === '200' &&
                        result.warningLevel &&
                        result.warningLevel === 'ERROR' &&
                        result.dt
                    );
                })
                .reply(200, '');
        });

        it('should create a subscription in the ContextBroker', function (done) {
            request(configurationRequest, function (error, response, body) {
                contextBrokerMock.done();
                done();
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

            request(configurationRequest, function (error, response, body) {
                setTimeout(function () {
                    request(optionsNotify, function () {
                        setTimeout(function () {
                            mockedClientServer.done();
                            done();
                        }, 100);
                    });
                }, 100);
            });
        });
    });
});
