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
const config = require('./config-test.js');
const nock = require('nock');
const should = require('should');
const iotAgentLib = require('iotagent-node-lib');
const async = require('async');
const request = require('request');
const utils = require('../../utils');
let mockedClientServer;
let contextBrokerMock;

describe('HTTP binding - Update command provisioned devices from polling to push', function () {
    const provisionOptions = {
        url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
        method: 'POST',
        json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionNewDeviceCommandHttp.json'),
        headers: {
            'fiware-service': 'smartgondor',
            'fiware-servicepath': '/gardens'
        }
    };

    beforeEach(function (done) {
        config.logLevel = 'FATAL';
        nock.cleanAll();
        const nockBody = utils.readExampleFile(
            './test/unit/ngsiv2/contextAvailabilityRequests/registerProvisionedDevice.json'
        );
        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/registrations', nockBody)
            .reply(201, null, { Location: '/v2/registrations/6319a7f5254b05844116584d' });

        contextBrokerMock
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v2/entities?options=upsert')
            .reply(204);

        iotagentMqtt.start(config, function () {
            request(provisionOptions, function (error, response, body) {
                done();
            });
        });
    });

    it('should have provisioned as polling', function (done) {
        const options = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices/Light_HTTP_2',
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            method: 'GET'
        };
        request(options, function (error, response, body) {
            /* jshint camelcase:false */
            const parsedBody = JSON.parse(body);
            parsedBody.polling.should.equal(true);
            done();
        });
    });

    afterEach(function (done) {
        nock.cleanAll();
        async.series([iotAgentLib.clearAll, iotagentMqtt.stop], done);
    });

    describe('When a request to update a provision device arrives', function () {
        const optionsUpdate = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices/Light_HTTP_2',
            method: 'PUT',
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/updateProvisionDeviceCommandHttp.json')
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/updateProvisionDeviceCommandHttp.json')
                )
                .reply(204);

            // FIXME: When https://github.com/telefonicaid/fiware-orion/issues/3007 is merged into master branch,
            // this function should use the new API. This is just a temporary solution which implies deleting the
            // registration and creating a new one.

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .delete('/v2/registrations/6319a7f5254b05844116584d')
                .reply(204);
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/registrations',
                    utils.readExampleFile(
                        './test/unit/ngsiv2/contextAvailabilityRequests/registerProvisionedDevice.json'
                    )
                )
                .reply(201, null, { Location: '/v2/registrations/4419a7f5254b058441165849' });
        });

        it('should return a 200 OK and no errors', function (done) {
            request(optionsUpdate, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(204);
                done();
            });
        });

        it('should have updated device as push', function (done) {
            request(optionsUpdate, function (error, response, body) {
                const options = {
                    url: 'http://localhost:' + config.iota.server.port + '/iot/devices/Light_HTTP_2',
                    headers: {
                        'fiware-service': 'smartgondor',
                        'fiware-servicepath': '/gardens'
                    },
                    method: 'GET'
                };

                request(options, function (error, response, body) {
                    /* jshint camelcase:false */
                    const parsedBody = JSON.parse(body);
                    parsedBody.polling.should.equal(false);
                    done();
                });
            });
        });
    });
});
