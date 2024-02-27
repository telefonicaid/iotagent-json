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

const iotaJson = require('../../../');
const config = require('./config-test.js');
const argoConfig = {
    argo: {
        host: 'localhost',
        port: 7898
    }
};
const nock = require('nock');
const iotAgentLib = require('iotagent-node-lib');
const should = require('should');
const async = require('async');

const utils = require('../../utils');
const constants = require('../../../lib/constants.js');
const apiKeyList = require('../../../lib/bindings/ARGOBinding').apiKeyList;
const request = utils.request;
let contextBrokerMock;

const soapReq =
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"> ' +
    '<soapenv:Header xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope"/> ' +
    '<soapenv:Body ' +
    'xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope"> ' +
    '<ns21:notificationEventRequest ' +
    'xmlns:ns21="http://myurl.com"> ' +
    '<ns21:Param1>ABC12345</ns21:Param1> ' +
    '<ns21:Param2/> ' +
    '<ns21:Date>28/09/2023 11:48:15 +0000</ns21:Date> ' +
    '<ns21:NestedAttr> ' +
    '<ns21:SubAttr>This is a description</ns21:SubAttr> ' +
    '</ns21:NestedAttr> ' +
    '<ns21:Status>Assigned</ns21:Status> ' +
    '<ns21:OriginSystem/> ' +
    '</ns21:notificationEventRequest> ' +
    '</soapenv:Body> ' +
    '</soap:Envelope>';

describe('ARGO: Hashing API keys manipulation', function () {
    const tableTests = [
        {
            label: 'Should return key when not hashed',
            key: 'Key1234',
            body: { customer: 'not used' },
            expected: ['Key1234']
        },
        {
            label: 'Should fail when hash format is missing the key',
            key: 'hash.customer',
            body: { customer: 'not used' },
            expected: null
        },
        {
            label: 'Should fail when hash format key is empty',
            key: 'hash.customer.',
            body: { customer: 'not used' },
            expected: null
        },
        {
            label: 'Should fail when hash field not found',
            key: 'hash.customer.Key1234',
            body: { no: 'match' },
            expected: null
        },
        {
            label: 'Should fail when hash field is empty',
            key: 'hash.customer.Key1234',
            body: { has: { empty: [{ customer: '' }] } },
            expected: null
        },
        {
            label: 'Should fail when hash field is xml nil',
            key: 'hash.customer.Key1234',
            body: { customer: { $: { nil: true } } },
            expected: null
        },
        {
            label: 'Should work when hash field is literal text',
            key: 'hash.customer.Key1234',
            body: { customer: 'Value1234' },
            expected: ['h256r84LKTxoPeQ1B4Mfn-yX', 'Key1234']
        },
        {
            label: 'Should work when hash field is an array',
            key: 'hash.customer.Key1234',
            body: { deeply: [{ nested: [{ customer: ['Value1234'] }] }] },
            expected: ['h256r84LKTxoPeQ1B4Mfn-yX', 'Key1234']
        },
        {
            label: 'Should work when hash field is text with attributes',
            key: 'hash.customer.Key1234',
            body: { customer: { _: 'Value1234' } },
            expected: ['h256r84LKTxoPeQ1B4Mfn-yX', 'Key1234']
        },
        {
            label: 'Should work when hash field is deeply nested',
            key: 'hash.customer.Key1234',
            body: { deeply: [{ nested: [{ customer: [{ _: 'Value1234' }] }] }] },
            expected: ['h256r84LKTxoPeQ1B4Mfn-yX', 'Key1234']
        },
        {
            label: 'Should return first value available',
            key: 'hash.customer.Key1234',
            body: [{ customer: 'Value1234' }, { customer: 'Value5678' }],
            expected: ['h256r84LKTxoPeQ1B4Mfn-yX', 'Key1234']
        },
        {
            label: 'Should allow dots in the key',
            key: 'hash.customer.Key.with..several..dots.',
            body: [{ customer: 'Value1234' }],
            expected: ['h2563s6RRIHXU1qQ0kCTeiM2', 'Key.with..several..dots.']
        }
    ];

    tableTests.forEach((test) => {
        it(test.label, () => {
            apiKeyList(test.key, test.body, function (err, apikey) {
                if (test.expected !== null) {
                    should.not.exist(err);
                    apikey.should.eql(test.expected);
                } else {
                    should.exist(err);
                }
            });
        });
    });
});

describe('ARGO: Measure reception', function () {
    beforeEach(function (done) {
        const provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionDeviceHTTP.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        // This mock does not check the payload since the aim of the test is not to verify
        // device provisioning functionality. Appropriate verification is done in tests under
        // provisioning folder of iotagent-node-lib
        contextBrokerMock = nock('http://192.168.1.1:1026');

        process.env.IOTA_ARGO_DISABLED = 'false';
        iotaJson.start(config, function () {
            request(provisionOptions, function (error, response, body) {
                done();
            });
        });
    });

    afterEach(function (done) {
        nock.cleanAll();

        async.series([iotAgentLib.clearAll, iotaJson.stop], done);
        delete process.env.IOTA_DEFAULT_RESOURCE;
    });

    const knownApiKeys = ['1234', 'hash.Param1.1234'];
    knownApiKeys.forEach((apiKey) => {
        describe('When an ARGO measure arrives with key' + apiKey, function () {
            const optionsMeasure = {
                url: 'http://localhost:' + argoConfig.argo.port + config.iota.defaultResource + '/attrs/data',
                responseType: 'text',
                method: 'POST',
                json: false,
                body: soapReq,
                headers: {
                    'fiware-service': 'smartgondor',
                    'fiware-servicepath': '/gardens',
                    'content-type': 'application/soap+xml'
                },
                qs: {
                    i: 'MQTT_2',
                    k: apiKey
                }
            };

            beforeEach(function () {
                const expectedPayload = utils.readExampleFile(
                    './test/unit/ngsiv2/contextRequests/singleMeasureSoapXml.json'
                );
                // NOTE: The HTTP transport sets the data.type to None, probably
                // because the device ID matches some device provisioned with
                // payloadType ngsiLD. But SOAP transport does not pay attention
                // to payloadType, and as a result uses the default type
                expectedPayload.data.type = constants.DEFAULT_ATTRIBUTE_TYPE;
                contextBrokerMock
                    .matchHeader('fiware-service', 'smartgondor')
                    .matchHeader('fiware-servicepath', '/gardens')
                    .post('/v2/entities?options=upsert', expectedPayload)
                    .reply(204);
            });

            it('should return a 200 OK with no error', function (done) {
                request(optionsMeasure, function (error, result, body) {
                    should.not.exist(error);
                    result.statusCode.should.equal(200);
                    done();
                });
            });

            it('should send its value to the Context Broker', function (done) {
                request(optionsMeasure, function (error, result, body) {
                    contextBrokerMock.done();
                    done();
                });
            });
        });
    });

    describe('When an ARGO measure is rejected by orion', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + argoConfig.argo.port + config.iota.defaultResource + '/attrs/payload',
            responseType: 'text',
            method: 'POST',
            json: false,
            body: soapReq,
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens',
                'content-type': 'application/soap+xml'
            },
            qs: {
                i: 'MQTT_2',
                k: '1234'
            }
        };

        beforeEach(function () {
            const expectedPayload = utils.readExampleFile('./test/unit/ngsiv2/contextRequests/argoMeasure.json');
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert', expectedPayload)
                .reply(401);
        });
        it('should return a 500 error', function (done) {
            request(optionsMeasure, function (error, result, body) {
                result.statusCode.should.equal(500);
                done();
            });
        });
    });

    describe('When an ARGO measure has wrong Content-Type', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + argoConfig.argo.port + config.iota.defaultResource + '/attrs/data',
            responseType: 'text',
            method: 'POST',
            json: {
                test: 'me'
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens',
                'content-type': 'application/json'
            },
            qs: {
                i: 'MQTT_2',
                k: '1234'
            }
        };

        it('should return a 400 Error', function (done) {
            request(optionsMeasure, function (error, result, body) {
                result.statusCode.should.equal(400);
                done();
            });
        });
    });

    describe('When an ARGO measure has missing parameters', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + argoConfig.argo.port + config.iota.defaultResource + '/attrs/payload',
            responseType: 'text',
            method: 'POST',
            json: false,
            body: soapReq,
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens',
                'content-type': 'application/soap+xml'
            },
            qs: {
                k: '1234'
            }
        };

        it('should return a 400 Error', function (done) {
            request(optionsMeasure, function (error, result, body) {
                result.statusCode.should.equal(400);
                done();
            });
        });
    });

    describe('When an ARGO measure API Key is not found', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + argoConfig.argo.port + config.iota.defaultResource + '/attrs/data',
            responseType: 'text',
            method: 'POST',
            json: false,
            body: soapReq,
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens',
                'content-type': 'application/soap+xml'
            },
            qs: {
                i: 'MQTT_2',
                k: 'NOT_FOUND'
            }
        };

        it('should return a 404 Error', function (done) {
            request(optionsMeasure, function (error, result, body) {
                result.statusCode.should.equal(404);
                done();
            });
        });
    });

    describe('When an ARGO measure hashed API key is not found', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + argoConfig.argo.port + config.iota.defaultResource + '/attrs/data',
            responseType: 'text',
            method: 'POST',
            json: false,
            body: soapReq,
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens',
                'content-type': 'application/soap+xml'
            },
            qs: {
                i: 'MQTT_2',
                k: 'hash:Param1:Key1234'
            }
        };

        it('should return a 404 Error', function (done) {
            request(optionsMeasure, function (error, result, body) {
                result.statusCode.should.equal(404);
                done();
            });
        });
    });
});
