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

const iotagentMqtt = require('../../');
const mqtt = require('mqtt');
const config = require('../config-test.js');
const nock = require('nock');
const request = require('request');
const should = require('should');
const iotAgentLib = require('iotagent-node-lib');
const async = require('async');
const utils = require('../utils');
let contextBrokerMock;
let mqttClient;

describe('Subscription management', function() {
    const provisionOptions = {
        url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
        method: 'POST',
        json: utils.readExampleFile('./test/deviceProvisioning/provisionDevice1.json'),
        headers: {
            'fiware-service': 'smartGondor',
            'fiware-servicepath': '/gardens'
        }
    };

    function sendMeasures(humidity, temperature) {
        return function(callback) {
            const values = {
                humidity,
                temperature
            };

            mqttClient.publish('/json/1234/MQTT_2/attrs', JSON.stringify(values), null, function(error) {
                process.nextTick(callback);
            });
        };
    }

    function waitForMqttRelay(ms) {
        return function(callback) {
            setTimeout(callback, ms);
        };
    }

    beforeEach(function(done) {
        nock.cleanAll();

        mqttClient = mqtt.connect(
            'mqtt://' + config.mqtt.host,
            {
                keepalive: 0,
                connectTimeout: 60 * 60 * 1000
            }
        );

        contextBrokerMock = nock('http://192.168.1.1:1026', { allowUnmocked: false })
            .matchHeader('fiware-service', 'smartGondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

        iotagentMqtt.start(config, function() {
            iotAgentLib.clearAll(done);
        });
    });

    afterEach(function(done) {
        nock.cleanAll();
        mqttClient.end();
        iotAgentLib.clearAll(done);
    });

    describe('When the iotagent stops', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/multipleMeasures.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/alternativeUpdate.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));
        });

        //
        // FIXME: the following tests is causing errors in travis
        //

        // 4) Subscription management
        //       When the iotagent stops
        //         should cease sending measures to the CB:
        //     Error: Timeout of 3000ms exceeded. For async tests and hooks, ensure
        //     "done()" is called; if returning a Promise, ensure it resolves.
        //     (/home/travis/build/telefonicaid/iotagent-json/test/unit/subscription-management_test.js)

        // it('should cease sending measures to the CB', function(done) {
        //     async.series(
        //         [
        //             async.apply(request, provisionOptions),
        //             sendMeasures('32', '87'),
        //             waitForMqttRelay(50),
        //             iotagentMqtt.stop,
        //             sendMeasures('53', '1'),
        //             waitForMqttRelay(50)
        //         ],
        //         function(error, results) {
        //             should.not.exist(error);
        //             contextBrokerMock.isDone().should.equal(false);
        //             done();
        //         }
        //     );
        // });
    });

    describe('When the iotagent starts', function() {
        beforeEach(function() {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/multipleMeasures.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/alternativeUpdate.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));
        });

        afterEach(function(done) {
            async.series([iotAgentLib.clearAll, iotagentMqtt.stop], done);
        });

        it('should resume sending measures for the provisioned devices', function(done) {
            async.series(
                [
                    async.apply(request, provisionOptions),
                    sendMeasures('32', '87'),
                    waitForMqttRelay(50),
                    iotagentMqtt.stop,
                    async.apply(iotagentMqtt.start, config),
                    waitForMqttRelay(50),
                    sendMeasures('53', '1'),
                    waitForMqttRelay(50)
                ],
                function(error, results) {
                    should.not.exist(error);
                    contextBrokerMock.isDone().should.equal(true);
                    done();
                }
            );
        });
    });
});
