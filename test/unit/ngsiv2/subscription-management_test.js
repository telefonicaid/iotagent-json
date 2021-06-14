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
const config = require('./config-test.js');
const nock = require('nock');
const request = require('request');
const should = require('should');
const iotAgentLib = require('iotagent-node-lib');
const async = require('async');
const utils = require('../../utils');
let contextBrokerMock;
let mqttClient;

describe('Subscription management', function () {
    const provisionOptions = {
        url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
        method: 'POST',
        json: utils.readExampleFile('./test/deviceProvisioning/provisionDevice1.json'),
        headers: {
            'fiware-service': 'smartgondor',
            'fiware-servicepath': '/gardens'
        }
    };

    function sendMeasures(humidity, temperature) {
        return function (callback) {
            const values = {
                humidity,
                temperature
            };

            mqttClient.publish('/json/1234/MQTT_2/attrs', JSON.stringify(values), null, function (error) {
                process.nextTick(callback);
            });
        };
    }

    function waitForMqttRelay(ms) {
        return function (callback) {
            setTimeout(callback, ms);
        };
    }

    beforeEach(function (done) {
        nock.cleanAll();

        mqttClient = mqtt.connect('mqtt://' + config.mqtt.host, {
            keepalive: 0,
            connectTimeout: 60 * 60 * 1000
        });

        // This mock does not check the payload since the aim of the test is not to verify
        // device provisioning functionality. Appropriate verification is done in tests under
        // provisioning folder of iotagent-node-lib
        contextBrokerMock = nock('http://192.168.1.1:1026', { allowUnmocked: false })
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/entities?options=upsert')
            .reply(204);

        iotaJson.start(config, function () {
            iotAgentLib.clearAll(done);
        });
    });

    afterEach(function (done) {
        nock.cleanAll();
        mqttClient.end();
        iotAgentLib.clearAll(done);
    });

    describe('When the iotagent stops', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasures.json')
                )
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/alternativeUpdate.json')
                )
                .reply(204);
        });

        it('should cease sending measures to the CB', function (done) {
            async.series(
                [
                    async.apply(request, provisionOptions),
                    sendMeasures('32', '87'),
                    waitForMqttRelay(50),
                    iotaJson.stop,
                    sendMeasures('53', '1'),
                    waitForMqttRelay(50)
                ],
                function (error, results) {
                    should.not.exist(error);
                    contextBrokerMock.isDone().should.equal(false);
                    done();
                }
            );
        });
    });

    describe('When the iotagent starts', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/multipleMeasures.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch(
                    '/v2/entities/Second%20MQTT%20Device/attrs',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/alternativeUpdate.json')
                )
                .query({ type: 'AnMQTTDevice' })
                .reply(204);
        });

        afterEach(function (done) {
            async.series([iotAgentLib.clearAll, iotaJson.stop], done);
        });

        it('should resume sending measures for the provisioned devices', function (done) {
            async.series(
                [
                    async.apply(request, provisionOptions),
                    sendMeasures('32', '87'),
                    waitForMqttRelay(50),
                    iotaJson.stop,
                    async.apply(iotaJson.start, config),
                    waitForMqttRelay(50),
                    sendMeasures('53', '1'),
                    waitForMqttRelay(50)
                ],
                function (error, results) {
                    should.not.exist(error);
                    contextBrokerMock.isDone().should.equal(true);
                    done();
                }
            );
        });
    });
});
