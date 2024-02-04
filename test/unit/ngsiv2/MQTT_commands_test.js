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
let mqttClient;

const groupCreation = {
    url: 'http://localhost:' + config.iota.server.port + '/iot/services',
    method: 'POST',
    json: {
        services: [
            {
                resource: '/iot/json',
                apikey: 'KL223HHV8732SFL1',
                entity_type: 'TheLightType',
                transport: 'MQTT',
                commands: [
                    {
                        name: 'cmd1',
                        type: 'command'
                    }
                ],
                lazy: [],
                attributes: [],
                static_attributes: []
            }
        ]
    },
    headers: {
        'fiware-service': 'smartgondor',
        'fiware-servicepath': '/gardens'
    }
};

describe('MQTT: Commands', function () {
    beforeEach(function (done) {
        const provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionCommand1.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        config.logLevel = 'INFO';

        nock.cleanAll();

        mqttClient = mqtt.connect('mqtt://' + config.mqtt.host, {
            keepalive: 0,
            connectTimeout: 60 * 60 * 1000
        });

        mqttClient.subscribe('/1234/MQTT_2/cmd', null);

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/registrations')
            .reply(201, null, { Location: '/v2/registrations/6319a7f5254b05844116584d' });

        iotagentMqtt.start(config, function () {
            request(provisionOptions, function (error, response, body) {
                done();
            });
        });
    });

    afterEach(function (done) {
        nock.cleanAll();
        mqttClient.unsubscribe('/1234/MQTT_2/cmd', null);
        mqttClient.end();

        async.series([iotAgentLib.clearAll, iotagentMqtt.stop], done);
    });

    describe('When a command arrive to the Agent for a device with the MQTT_JSON protocol', function () {
        const commandOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/v2/op/update',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateCommand1.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus1.json')
                )
                .reply(204);
        });

        it('should return a 204 OK without errors', function (done) {
            request(commandOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(204);
                done();
            });
        });
        it('should update the status in the Context Broker', function (done) {
            request(commandOptions, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
        it('should publish the command information in the MQTT topic', function (done) {
            const commandMsg = '{"PING":{"data":"22"}}';
            let payload;

            mqttClient.on('message', function (topic, data) {
                payload = data.toString();
            });

            request(commandOptions, function (error, response, body) {
                setTimeout(function () {
                    should.exist(payload);
                    payload.should.equal(commandMsg);
                    done();
                }, 100);
            });
        });
    });

    describe('When a command update arrives to the MQTT command topic', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus2.json')
                )
                .reply(204);
        });

        it('should send an update request to the Context Broker', function (done) {
            mqttClient.publish('/1234/MQTT_2/cmdexe', '{ "PING": "1234567890" }', null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 200);
            });
        });
    });

    describe('When a command with expression arrives to the Agent for a device with the MQTT_JSON protocol', function () {
        const commandOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/v2/op/update',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateCommand4.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus7.json')
                )
                .reply(204);
        });

        it('should return a 204 OK without errors', function (done) {
            request(commandOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(204);
                done();
            });
        });
        it('should update the status in the Context Broker', function (done) {
            request(commandOptions, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });
        it('should publish the transformed command information in the MQTT topic', function (done) {
            const commandMsg = '"command Expression"';
            let payload;

            mqttClient.on('message', function (topic, data) {
                payload = data.toString();
            });

            request(commandOptions, function (error, response, body) {
                setTimeout(function () {
                    should.exist(payload);
                    payload.should.equal(commandMsg);
                    done();
                }, 100);
            });
        });
    });

    describe('When a command with payloadtype arrives to the Agent for a device with the MQTT_JSON protocol', function () {
        const commandOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/v2/op/update',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateCommand5.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus8.json')
                )
                .reply(204);
        });

        it('should return a 204 OK without errors', function (done) {
            request(commandOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(204);
                done();
            });
        });

        it('should update the status in the Context Broker', function (done) {
            request(commandOptions, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });

        it('binaryfromhex - should publish the transformed command information in the MQTT topic', function (done) {
            const commandMsg = 'HOLA';
            let payload;

            mqttClient.on('message', function (topic, data) {
                payload = data.toString();
            });

            commandOptions.json = utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateCommand5.json');

            request(commandOptions, function (error, response, body) {
                setTimeout(function () {
                    should.exist(payload);
                    payload.should.equal(commandMsg);
                    done();
                }, 100);
            });
        });

        it('text - should publish the transformed command information in the MQTT topic', function (done) {
            const commandMsg = 'myText';
            let payload;

            mqttClient.on('message', function (topic, data) {
                payload = data.toString();
            });

            commandOptions.json = utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateCommand6.json');

            request(commandOptions, function (error, response, body) {
                setTimeout(function () {
                    should.exist(payload);
                    payload.should.equal(commandMsg);
                    done();
                }, 100);
            });
        });
    });
});

describe('MQTT: Commands from groups', function () {
    beforeEach(function (done) {
        config.logLevel = 'INFO';

        nock.cleanAll();

        mqttClient = mqtt.connect('mqtt://' + config.mqtt.host, {
            keepalive: 0,
            connectTimeout: 60 * 60 * 1000
        });

        mqttClient.subscribe('/KL223HHV8732SFL1/JSON_UNPROVISIONED/cmd', null);

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/registrations')
            .reply(201, null, { Location: '/v2/registrations/6319a7f5254b05844116584d' });

        iotagentMqtt.start(config, function () {
            done();
        });
    });

    afterEach(function (done) {
        nock.cleanAll();
        async.series([iotAgentLib.clearAll, iotagentMqtt.stop], done);
    });
    describe('When a POST measure arrives for an unprovisioned device in a command group', function () {
        const values = {
            h: '33'
        };

        // provisioning folder of iotagent-node-lib
        beforeEach(function (done) {
            //contextBrokerUnprovMock = nock('http://192.168.1.1:1026');

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/unprovisionedDevice3.json')
                )
                .reply(204);

            request(groupCreation, function (error, response, body) {
                done();
            });
        });

        it('should send its value to the Context Broker', function (done) {
            mqttClient.publish('/KL223HHV8732SFL1/JSON_UNPROVISIONED/attrs', JSON.stringify(values), null, function (
                error
            ) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });

        it('should not add a transport to the registered devices', function (done) {
            const getDeviceOptions = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
                method: 'GET',
                headers: {
                    'fiware-service': 'smartgondor',
                    'fiware-servicepath': '/gardens'
                },
                qs: {
                    i: 'JSON_UNPROVISIONED',
                    k: 'KL223HHV8732SFL1'
                }
            };
            mqttClient.publish('/KL223HHV8732SFL1/JSON_UNPROVISIONED/attrs', JSON.stringify(values), null, function (
                error
            ) {
                setTimeout(function () {
                    request(getDeviceOptions, function (error, response, body) {
                        should.not.exist(error);
                        response.statusCode.should.equal(200);
                        should.not.exist(body.devices[0].transport);
                        done();
                    });
                }, 100);
            });
        });

        describe('When a command arrive to the Agent for a device with the MQTT protocol', function () {
            const commandOptions = {
                url: 'http://localhost:' + config.iota.server.port + '/v2/op/update',
                method: 'POST',
                json: utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateCommand2.json'),
                headers: {
                    'fiware-service': 'smartgondor',
                    'fiware-servicepath': '/gardens'
                }
            };
            beforeEach(function () {
                contextBrokerMock
                    .matchHeader('fiware-service', 'smartgondor')
                    .matchHeader('fiware-servicepath', '/gardens')
                    .post(
                        '/v2/entities?options=upsert',
                        utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus9.json')
                    )
                    .reply(204);
                contextBrokerMock
                    .matchHeader('fiware-service', 'smartgondor')
                    .matchHeader('fiware-servicepath', '/gardens')
                    .post(
                        '/v2/entities?options=upsert',
                        utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateStatus10.json')
                    )
                    .reply(204);
            });
            it('should return a 204 OK without errors', function (done) {
                mqttClient.publish(
                    '/KL223HHV8732SFL1/JSON_UNPROVISIONED/attrs',
                    JSON.stringify(values),
                    null,
                    function (error) {
                        setTimeout(function () {
                            request(commandOptions, function (error, response, body) {
                                should.not.exist(error);
                                response.statusCode.should.equal(204);
                                done();
                            });
                        }, 100);
                    }
                );
            });
            it('should publish the command information in the MQTT topic', function (done) {
                let payload;
                mqttClient.on('message', function (topic, data) {
                    payload = data.toString();
                });
                mqttClient.publish(
                    '/KL223HHV8732SFL1/JSON_UNPROVISIONED/attrs',
                    JSON.stringify(values),
                    null,
                    function (error) {
                        setTimeout(function () {
                            request(commandOptions, function (error, response, body) {
                                mqttClient.publish(
                                    '/KL223HHV8732SFL1/JSON_UNPROVISIONED/cmdexe',
                                    '{ "cmd1": {"data":"22"}}',
                                    null,
                                    function (error) {
                                        setTimeout(function () {
                                            contextBrokerMock.done();
                                            done();
                                        }, 200);
                                    }
                                );
                            });
                        }, 100);
                    }
                );
            });
        });
    });
});
