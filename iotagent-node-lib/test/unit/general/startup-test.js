/*
 * Copyright 2014 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of fiware-iotagent-lib
 *
 * fiware-iotagent-lib is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * fiware-iotagent-lib is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with fiware-iotagent-lib.
 * If not, see http://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 */

/* eslint-disable no-unused-vars */
/* eslint-disable no-unused-expressions */

const iotAgentLib = require('../../../lib/fiware-iotagent-lib');
const should = require('should');
const nock = require('nock');
const utils = require('../../tools/utils');
const request = utils.request;
const config = require('../../../lib/commonConfig');
const _ = require('underscore');
const iotAgentConfig = {
    logLevel: 'ERROR',
    contextBroker: {
        host: '192.168.1.1',
        port: '1026'
    },
    server: {
        port: 4041,
        host: 'localhost'
    },
    types: {
        Light: {
            commands: [],
            type: 'Light',
            lazy: [
                {
                    name: 'temperature',
                    type: 'centigrades'
                }
            ],
            attributes: [
                {
                    name: 'pressure',
                    type: 'Hgmm'
                }
            ]
        }
    },
    providerUrl: 'http://smartgondor.com',
    deviceRegistrationDuration: 'P1M'
};
const iotAgentConfigNoUrl = _.clone(iotAgentConfig);
const iotAgentConfigNoTypes = _.clone(iotAgentConfig);

describe('Startup tests', function () {
    describe('When the IoT Agent is started without a "providerUrl" config parameter', function () {
        beforeEach(function () {
            delete iotAgentConfigNoUrl.providerUrl;
        });

        it('should not start and raise a MISSING_CONFIG_PARAMS error', function (done) {
            iotAgentLib.activate(iotAgentConfigNoUrl, function (error) {
                should.exist(error);
                should.exist(error.name);
                error.name.should.equal('MISSING_CONFIG_PARAMS');
                done();
            });
        });
    });
    describe('When the IoT Agent is started without a "types" attribute', function () {
        beforeEach(function () {
            delete iotAgentConfigNoTypes.types;
        });

        it('should not start and raise a MISSING_CONFIG_PARAMS error', function (done) {
            iotAgentLib.activate(iotAgentConfigNoTypes, function (error) {
                should.exist(error);
                should.exist(error.name);
                error.name.should.equal('MISSING_CONFIG_PARAMS');
                done();
            });
        });
    });
    describe('When the IoT Agent is started with environment variables', function () {
        beforeEach(function () {
            process.env.IOTA_CB_HOST = 'cbhost';
            process.env.IOTA_CB_PORT = '1111';
            process.env.IOTA_NORTH_HOST = 'localhost';
            process.env.IOTA_NORTH_PORT = '2222';
            process.env.IOTA_PROVIDER_URL = 'prvider:3333';
            process.env.IOTA_REGISTRY_TYPE = 'mongo';
            process.env.IOTA_LOG_LEVEL = 'FATAL';
            process.env.IOTA_TIMESTAMP = true;
            process.env.IOTA_MONGO_URI = 'mongodb://mongohost:5555/themongodb?replicaSet=customReplica';
            process.env.IOTA_DEFAULT_RESOURCE = '/iot/custom';
            process.env.IOTA_HEALTH_CHECK = true;

            nock.cleanAll();
        });

        afterEach(function () {
            delete process.env.IOTA_CB_HOST;
            delete process.env.IOTA_CB_PORT;
            delete process.env.IOTA_NORTH_HOST;
            delete process.env.IOTA_NORTH_PORT;
            delete process.env.IOTA_PROVIDER_URL;
            delete process.env.IOTA_REGISTRY_TYPE;
            delete process.env.IOTA_LOG_LEVEL;
            delete process.env.IOTA_TIMESTAMP;
            delete process.env.IOTA_MONGO_URI;
            delete process.env.IOTA_DEFAULT_RESOURCE;
            delete process.env.IOTA_HEALTH_CHECK;
        });

        afterEach(function (done) {
            iotAgentLib.deactivate(done);
        });

        it('should not start and raise a MISSING_CONFIG_PARAMS error', function (done) {
            iotAgentLib.activate(iotAgentConfig, function (error) {
                config.getConfig().contextBroker.url.should.equal('http://cbhost:1111');
                config.getConfig().server.host.should.equal('localhost');
                config.getConfig().server.port.should.equal('2222');
                config.getConfig().providerUrl.should.equal('prvider:3333');
                config.getConfig().deviceRegistry.type.should.equal('mongo');
                config.getConfig().logLevel.should.equal('FATAL');
                config.getConfig().timestamp.should.equal(true);
                config.getConfig().defaultResource.should.equal('/iot/custom');
                config
                    .getConfig()
                    .mongodb.uri.should.equal('mongodb://mongohost:5555/themongodb?replicaSet=customReplica');
                done();
            });
        });
    });

    describe('When the IoT Agent is started with mongodb params', function () {
        beforeEach(function () {
            process.env.IOTA_MONGO_URI =
                'mongodb://customUser:customPassword@mongohost:5555/themongodb?replicaSet=customReplica&authSource=customAuthSource';
            process.env.IOTA_HEALTH_CHECK = true;

            nock.cleanAll();
        });

        afterEach(function () {
            delete process.env.IOTA_MONGO_URI;
            delete process.env.IOTA_HEALTH_CHECK;
        });

        afterEach(function (done) {
            iotAgentLib.deactivate(done);
        });

        ['true', 'True', 'TRUE'].forEach(function (t) {
            it('should load ssl=ture with ssl=' + t, function (done) {
                process.env.IOTA_MONGO_URI =
                    'mongodb://customUser:customPassword@mongohost:5555/themongodb?replicaSet=customReplica&authSource=customAuthSource&ssl=true';

                iotAgentLib.activate(iotAgentConfig, function (error) {
                    config
                        .getConfig()
                        .mongodb.uri.should.equal(
                            'mongodb://customUser:customPassword@mongohost:5555/themongodb?replicaSet=customReplica&authSource=customAuthSource&ssl=true'
                        );
                    done();
                });
            });
        });

        ['false', 'False', 'FALSE', 'invalid'].forEach(function (t) {
            it('should load ssl=false with ssl=' + t, function (done) {
                process.env.IOTA_MONGO_URI =
                    'mongodb://customUser:customPassword@mongohost:5555/themongodb?replicaSet=customReplica&authSource=customAuthSource&ssl=false';

                iotAgentLib.activate(iotAgentConfig, function (error) {
                    config
                        .getConfig()
                        .mongodb.uri.should.equal(
                            'mongodb://customUser:customPassword@mongohost:5555/themongodb?replicaSet=customReplica&authSource=customAuthSource&ssl=false'
                        );
                    done();
                });
            });
        });

        ['', 'undefined'].forEach(function (t) {
            it('should load no ssl parameter with ssl=' + t, function (done) {
                if (t !== 'undefined') {
                    process.env.IOTA_MONGO_URI =
                        'mongodb://customUser:customPassword@mongohost:5555/themongodb?replicaSet=customReplica&authSource=customAuthSource';
                }

                iotAgentLib.activate(iotAgentConfig, function (error) {
                    config
                        .getConfig()
                        .mongodb.uri.should.equal(
                            'mongodb://customUser:customPassword@mongohost:5555/themongodb?replicaSet=customReplica&authSource=customAuthSource'
                        );
                    done();
                });
            });
        });
    });
});
