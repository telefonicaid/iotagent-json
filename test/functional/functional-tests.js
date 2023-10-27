/*
 * Copyright 2023 Telefonica Investigación y Desarrollo, S.A.U
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
 * Modified by: Miguel Angel Pedraza
 */

/* eslint-disable no-unused-vars*/
/* eslint-disable no-unused-expressions*/

const iotaJson = require('../..');
const config = require('./config-test.js');
const nock = require('nock');
const chai = require('chai');
const expect = chai.expect;
const iotAgentLib = require('iotagent-node-lib');
const async = require('async');
const utils = require('../utils');
const testUtils = require('./testUtils');
const request = utils.request;
const logger = require('logops');

let contextBrokerMock;

const env = {
    service: 'smartgondor',
    servicePath: '/gardens'
};

const ERR_CB_EXPECTATION_DIFFER = 'Assertion Error - Context Broker received payload differs from expectation';
const ERR_MEAS_BODY = 'Assertion Error - Measure response is not empty';
const ERR_MEAS_CODE = 'Assertion Error - Measure response status code differs from 200';

describe('FUNCTIONAL TESTS', function () {
    beforeEach(function (done) {
        iotaJson.start(config, function (error) {
            done(error);
        });
    });

    afterEach(function (done) {
        async.series([iotAgentLib.clearAll, iotaJson.stop], done);
    });

    describe('Basic group provision with attributes', function () {
        const provision = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/services',
            method: 'POST',
            json: {
                services: [
                    {
                        resource: '/iot/json',
                        apikey: '123456',
                        entity_type: 'TheLightType2',
                        cbHost: 'http://192.168.1.1:1026',
                        commands: [],
                        lazy: [],
                        attributes: [
                            {
                                object_id: 's',
                                name: 'status',
                                type: 'Boolean'
                            },
                            {
                                object_id: 't',
                                name: 'temperature',
                                type: 'Number'
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

        const measure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            qs: {
                i: 'MQTT_2',
                k: '123456'
            },
            json: {
                s: false,
                t: 10
            }
        };

        const expectation = {
            id: 'TheLightType2:MQTT_2',
            type: 'TheLightType2',
            temperature: {
                value: 10,
                type: 'Number'
            },
            status: {
                value: false,
                type: 'Boolean'
            }
        };

        beforeEach(function (done) {
            request(provision, function (error, response, body) {
                let err = null;
                if (response.statusCode !== 201) {
                    err = new Error('Error creating the device group');
                }
                done(err);
            });
        });

        afterEach(function () {
            nock.cleanAll();
        });

        it('should send its value to the Context Broker', async function () {
            await testUtils.testCase(measure, expectation, env, config, 'single', 'HTTP');
        });
    });

    describe('Basic group provision with attributes and multientity', function () {
        const provision = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/services',
            method: 'POST',
            json: {
                services: [
                    {
                        resource: '/iot/json',
                        apikey: '123456',
                        entity_type: 'TheLightType2',
                        cbHost: 'http://192.168.1.1:1026',
                        commands: [],
                        lazy: [],
                        attributes: [
                            {
                                object_id: 's',
                                name: 'status',
                                type: 'Boolean'
                            },
                            {
                                object_id: 't',
                                name: 'temperature',
                                type: 'Number',
                                entity_name: 'TheLightType2:MQTT_3',
                                entity_type: 'TheLightType2'
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

        const measure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            qs: {
                i: 'MQTT_2',
                k: '123456'
            },
            json: {
                s: false,
                t: 10
            }
        };

        const expectation = {
            entities: [
                {
                    id: 'TheLightType2:MQTT_2',
                    type: 'TheLightType2',
                    status: {
                        value: false,
                        type: 'Boolean'
                    }
                },
                {
                    id: 'TheLightType2:MQTT_3',
                    type: 'TheLightType2',
                    temperature: {
                        value: 10,
                        type: 'Number'
                    }
                }
            ],
            actionType: 'append'
        };

        beforeEach(function (done) {
            request(provision, function (error, response, body) {
                let err = null;
                if (response.statusCode !== 201) {
                    err = new Error('Error creating the device group');
                }
                done(err);
            });
        });

        afterEach(function () {
            nock.cleanAll();
        });

        it('should send its value to the Context Broker', async function () {
            // logger.setLevel('DEBUG');
            await testUtils.testCase(measure, expectation, env, config, 'multientity', 'HTTP');
        });
    });
});
