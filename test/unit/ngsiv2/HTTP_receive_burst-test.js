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

const utils = require('../../utils');
const request = utils.request;

const got = require('got');
const logger = require('logops');
const context = {
    op: 'IoTAgentNGSI.Request'
};
const util = require('util');

function getOptions(options) {
    const httpOptions = {
        method: options.method,
        searchParams: options.searchParams || options.qs,
        headers: options.headers,
        throwHttpErrors: options.throwHttpErrors || false,
        retry: options.retry || 0,
        responseType: options.responseType || 'json'
    };

    // got library is not properly documented, so it is not clear which takes precedence
    // among body, json and form (see https://stackoverflow.com/q/70754880/1485926).
    // Thus, we are enforcing our own precedence with the "else if" chain below.
    // Behaviour is consistent with the one described at development.md#iotagentlibrequest

    if (options.method === 'GET' || options.method === 'HEAD' || options.method === 'OPTIONS') {
        // Do nothing - Never add a body
    } else if (options.body) {
        // body takes precedence over json or form
        httpOptions.body = options.body;
    } else if (options.json) {
        // json takes precedence over form
        httpOptions.json = options.json;
    } else if (options.form) {
        // Note that we don't consider 'form' part of the function API (check development.md#iotagentlibrequest)
        // but we are preparing the code anyway as a safe measure
        httpOptions.form = options.form;
    }

    return httpOptions;
}

function paralelRequest(options, options2, callback) {
    const httpOptions = getOptions(options);
    const httpOptions2 = getOptions(options2);

    got(options2.url || options2.uri, httpOptions2)
        .then((response) => {
            logger.debug(context, 'Response %s', JSON.stringify(response.body, null, 4));
            // nothing to do
        })
        .catch((error) => {
            logger.debug(context, 'Error: %s', JSON.stringify(util.inspect(error), null, 4));
            // nothing to do
        });

    got(options.url || options.uri, httpOptions)
        .then((response) => {
            logger.debug(context, 'Response %s', JSON.stringify(response.body, null, 4));
            return callback(null, response, response.body);
        })
        .catch((error) => {
            logger.debug(context, 'Error: %s', JSON.stringify(util.inspect(error), null, 4));
            return callback(error);
        });
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
                trust: '8970A9078A803H3BL98PINEQRW8342HBAMS',
                cbHost: 'http://192.168.1.1:1026',
                storeLastMeasure: true,
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

describe('HTTP: Measure reception ', function () {
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
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                humidity: '32',
                temperature: '87'
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'JSON_UNPROVISIONED2',
                k: 'KL223HHV8732SFL2'
            }
        };
        const optionsMeasure2 = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                humidity: '12',
                temperature: '17'
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'JSON_UNPROVISIONED2',
                k: 'KL223HHV8732SFL2'
            }
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

        it('should duplicate registered devices', function (done) {
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

            paralelRequest(optionsMeasure2, optionsMeasure, function (error, response, body) {
                request(getDeviceOptions, function (error, response, body) {
                    should.not.exist(error);
                    response.statusCode.should.equal(200);
                    body.devices.length.should.equal(1);
                    contextBrokerUnprovMock.done();
                    done();
                });
            });
        });
    });
});
