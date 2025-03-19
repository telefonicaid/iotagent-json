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

const iotaJson = require('../../../');
const config = require('./config-test2.js');
const nock = require('nock');
const iotAgentLib = require('iotagent-node-lib');
const should = require('should');
const async = require('async');
const MQTT = require('async-mqtt');

const utils = require('../../utils');
const request = utils.request;

const context = {
    op: 'IoTAgentNGSI.Request'
};

async function parallelPub(topic, valuesMeasure1, valuesMeasure2, callback) {
    let client = await MQTT.connectAsync('mqtt://' + config.mqtt.host);
    await client.publish(topic, JSON.stringify(valuesMeasure1));
    await client.publish(topic, JSON.stringify(valuesMeasure2));
    await client.end();
    callback(null);
}

const groupCreation = {
    url: 'http://localhost:' + config.iota.server.port + '/iot/services',
    method: 'POST',
    json: {
        services: [
            {
                resource: '/iot/json',
                apikey: 'KL223HHV8732SFL2',
                entity_type: 'TheLightType',
                cbHost: 'http://192.168.1.1:1026',
                commands: [],
                lazy: [],
                attributes: [
                    {
                        name: 'status',
                        type: 'Boolean'
                    }
                ],
                static_attributes: []
            }
        ]
    },
    headers: {
        'fiware-service': 'smartgondor',
        'fiware-servicepath': '/gardens'
    }
};

let contextBrokerMock;
let contextBrokerUnprovMock;

describe('MQTT: Measure reception ', function () {
    beforeEach(function (done) {
        nock.cleanAll();

        // This mock does not check the payload since the aim of the test is not to verify
        // device provisioning functionality. Appropriate verification is done in tests under
        // provisioning folder of iotagent-node-lib
        contextBrokerMock = nock('http://192.168.1.1:1026');

        iotaJson.start(config, function () {
            done();
        });
    });

    afterEach(function (done) {
        nock.cleanAll();
        async.series([iotAgentLib.clearAll, iotaJson.stop], done);
    });

    describe('When a burst of measures arrives for an unprovisioned device', function () {
        const valuesMeasure = {
            humidity: '32',
            temperature: '87'
        };
        const valuesMeasure2 = {
            humidity: '12',
            temperature: '17'
        };
        // This mock does not check the payload since the aim of the test is not to verify
        // device provisioning functionality. Appropriate verification is done in tests under
        // provisioning folder of iotagent-node-lib
        beforeEach(function (done) {
            contextBrokerUnprovMock = nock('http://192.168.1.1:1026');

            contextBrokerUnprovMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/unprovisionedMeasureBurst.json')
                )
                .reply(204);

            contextBrokerUnprovMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/unprovisionedMeasureBurstDup.json')
                )
                .reply(204);

            request(groupCreation, function (error, response, body) {
                done();
            });
        });

        it('should not duplicate registered devices', function (done) {
            const getDeviceOptions = {
                url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
                method: 'GET',
                headers: {
                    'fiware-service': 'smartgondor',
                    'fiware-servicepath': '/gardens'
                },
                qs: {
                    i: 'JSON_UNPROVISIONED2',
                    k: 'KL223HHV8732SFL2'
                }
            };

            parallelPub('json/KL223HHV8732SFL2/JSON_UNPROVISIONED2/attrs', valuesMeasure, valuesMeasure2, function (
                error
            ) {
                setTimeout(function () {
                    request(getDeviceOptions, function (error, response, body) {
                        should.not.exist(error);
                        response.statusCode.should.equal(200);
                        body.devices.length.should.equal(1);
                        contextBrokerUnprovMock.done();
                        done();
                    });
                }, 100);
            });
        });
    });
});
