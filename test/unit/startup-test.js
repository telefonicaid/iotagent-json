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
'use strict';
var fs = require('fs'),
    iotagentJSON = require('../../'),
    should = require('should'),
    config = require('../../lib/configService'),
    iotAgentConfig = require('../config-startup.js'),
    mqtt = require('mqtt'),
    sinon = require('sinon');

describe('Startup tests', function() {
    describe('When the IoT Agent is started with environment variables', function() {
        beforeEach(function() {
            sinon.stub(fs, 'readFileSync');
            sinon.stub(mqtt, 'connect').returns({
                end: sinon.stub().callsFake(function(force, callback) {
                    callback();
                }),
                on: sinon.stub().callsFake(function(type, listener) {
                    if (type === 'connect') {
                        listener();
                    }
                }),
                subscribe: sinon.stub().callsFake(function(topics, _, callback) {
                    callback(false);
                }),
                unsubscribe: sinon.spy()
            });
        });

        afterEach(function(done) {
            fs.readFileSync.restore();
            mqtt.connect.restore();

            delete process.env.IOTA_MQTT_PROTOCOL;
            delete process.env.IOTA_MQTT_HOST;
            delete process.env.IOTA_MQTT_PORT;
            delete process.env.IOTA_MQTT_CA;
            delete process.env.IOTA_MQTT_CERT;
            delete process.env.IOTA_MQTT_KEY;
            delete process.env.IOTA_MQTT_REJECT_UNAUTHORIZED;
            delete process.env.IOTA_MQTT_USERNAME;
            delete process.env.IOTA_MQTT_PASSWORD;
            delete process.env.IOTA_HTTP_HOST;
            delete process.env.IOTA_HTTP_PORT;
            delete process.env.IOTA_HTTP_QOS;
            delete process.env.IOTA_HTTP_RETAIN;

            iotagentJSON.stop(done);
        });

        it('should load the environment variables in the internal configuration', function(done) {
            process.env.IOTA_MQTT_HOST = '127.0.0.1';
            process.env.IOTA_MQTT_PORT = '1883';
            process.env.IOTA_MQTT_USERNAME = 'usermqtt';
            process.env.IOTA_MQTT_PASSWORD = 'passmqtt';
            process.env.IOTA_HTTP_HOST = 'localhost';
            process.env.IOTA_HTTP_PORT = '2222';

            iotagentJSON.start(iotAgentConfig, function(error) {
                should.not.exist(error);

                //prettier-ignore
                mqtt.connect.calledOnceWithExactly({
                    ca: null,
                    cert: null,
                    connectTimeout: 3600000,
                    host: '127.0.0.1',
                    keepalive: 0,
                    key: null,
                    password: 'passmqtt',
                    port: '1883',
                    protocol: 'mqtt',
                    rejectUnauthorized: true,
                    username: 'usermqtt'
                })
                .should.equal(true);

                var mqttConfig = config.getConfig().mqtt;
                mqttConfig.host.should.equal('127.0.0.1');
                mqttConfig.port.should.equal('1883');
                mqttConfig.username.should.equal('usermqtt');
                mqttConfig.password.should.equal('passmqtt');

                var httpConfig = config.getConfig().http;
                httpConfig.host.should.equal('localhost');
                httpConfig.port.should.equal('2222');

                done();
            });
        });

        it('should support configuring mqtts through the use of environment variables', function(done) {
            process.env.IOTA_MQTT_PROTOCOL = 'mqtts';
            process.env.IOTA_MQTT_HOST = '127.0.0.1';
            process.env.IOTA_MQTT_PORT = '8883';
            process.env.IOTA_MQTT_REJECT_UNAUTHORIZED = 'False';

            iotagentJSON.start(iotAgentConfig, function(error) {
                should.not.exist(error);

                //prettier-ignore
                mqtt.connect.calledOnceWithExactly({
                    ca: null,
                    cert: null,
                    connectTimeout: 3600000,
                    host: '127.0.0.1',
                    keepalive: 0,
                    key: null,
                    password: null,
                    port: '8883',
                    protocol: 'mqtts',
                    rejectUnauthorized: false,
                    username: null
                })
                .should.equal(true);

                var mqttConfig = config.getConfig().mqtt;
                mqttConfig.protocol.should.equal('mqtts');
                mqttConfig.host.should.equal('127.0.0.1');
                mqttConfig.port.should.equal('8883');
                mqttConfig.rejectUnauthorized.should.equal(false);

                done();
            });
        });

        it('should support configuring tls certificates through the use of environment variables', function(done) {
            process.env.IOTA_MQTT_PROTOCOL = 'mqtts';
            process.env.IOTA_MQTT_HOST = '127.0.0.1';
            process.env.IOTA_MQTT_PORT = '8883';
            process.env.IOTA_MQTT_CERT = '/run/secrets/cert.pem';
            process.env.IOTA_MQTT_KEY = '/run/secrets/key.pem';
            process.env.IOTA_MQTT_CA = '/run/secrets/ca.pem';
            process.env.IOTA_MQTT_REJECT_UNAUTHORIZED = 'true';

            fs.readFileSync.callsFake(function(filename) {
                switch (filename) {
                    case process.env.IOTA_MQTT_CERT:
                        return 'certcontent';
                    case process.env.IOTA_MQTT_KEY:
                        return 'keycontent';
                    case process.env.IOTA_MQTT_CA:
                        return 'cacontent';
                }
            });

            iotagentJSON.start(iotAgentConfig, function(error) {
                should.not.exist(error);

                //prettier-ignore
                mqtt.connect.calledOnceWithExactly({
                    ca: 'cacontent',
                    cert: 'certcontent',
                    connectTimeout: 3600000,
                    host: '127.0.0.1',
                    keepalive: 0,
                    key: 'keycontent',
                    password: null,
                    port: '8883',
                    protocol: 'mqtts',
                    rejectUnauthorized: true,
                    username: null
                })
                .should.equal(true);

                var mqttConfig = config.getConfig().mqtt;
                mqttConfig.protocol.should.equal('mqtts');
                mqttConfig.host.should.equal('127.0.0.1');
                mqttConfig.port.should.equal('8883');
                mqttConfig.cert.should.equal('certcontent');
                mqttConfig.key.should.equal('keycontent');
                mqttConfig.ca.should.equal('cacontent');
                mqttConfig.rejectUnauthorized.should.equal(true);

                done();
            });
        });
    });
});
