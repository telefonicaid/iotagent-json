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

const config = require('../../lib/configService');
const iotAgentConfig = require('../config-startup.js');
const fs = require('fs');
// mqtt = require('mqtt'),
const sinon = require('sinon');

describe('Startup tests', function () {
    describe('When the MQTT transport is started with environment variables', function () {
        beforeEach(function () {
            sinon.stub(fs, 'statSync');
            process.env.IOTA_MQTT_HOST = '127.0.0.1';
            process.env.IOTA_MQTT_PORT = '1883';
            process.env.IOTA_MQTT_USERNAME = 'usermqtt';
            process.env.IOTA_MQTT_PASSWORD = 'passmqtt';
            process.env.IOTA_MQTT_PROTOCOL = 'xxx';
            process.env.IOTA_MQTT_CA = '/mqtt/xxx/ca';
            process.env.IOTA_MQTT_CERT = '/mqtt/xxx/cert.pem';
            process.env.IOTA_MQTT_KEY = '/mqtt/xxx/key.pem';
            process.env.IOTA_MQTT_REJECT_UNAUTHORIZED = 'true';
            process.env.IOTA_MQTT_QOS = '0';
            process.env.IOTA_MQTT_RETAIN = 'false';
            process.env.IOTA_MQTT_RETRIES = '2';
            process.env.IOTA_MQTT_RETRY_TIME = '5';
            process.env.IOTA_MQTT_KEEPALIVE = '0';
        });

        afterEach(function () {
            fs.statSync.restore();
            delete process.env.IOTA_MQTT_PROTOCOL;
            delete process.env.IOTA_MQTT_HOST;
            delete process.env.IOTA_MQTT_PORT;
            delete process.env.IOTA_MQTT_CA;
            delete process.env.IOTA_MQTT_CERT;
            delete process.env.IOTA_MQTT_KEY;
            delete process.env.IOTA_MQTT_REJECT_UNAUTHORIZED;
            delete process.env.IOTA_MQTT_USERNAME;
            delete process.env.IOTA_MQTT_PASSWORD;
            delete process.env.IOTA_MQTT_QOS;
            delete process.env.IOTA_MQTT_RETAIN;
            delete process.env.IOTA_MQTT_RETRIES;
            delete process.env.IOTA_MQTT_RETRY_TIME;
            delete process.env.IOTA_MQTT_KEEPALIVE;
        });

        it('should load the MQTT environment variables in the internal configuration', function (done) {
            config.setConfig(iotAgentConfig);
            config.getConfig().mqtt.host.should.equal('127.0.0.1');
            config.getConfig().mqtt.port.should.equal('1883');
            config.getConfig().mqtt.username.should.equal('usermqtt');
            config.getConfig().mqtt.password.should.equal('passmqtt');
            config.getConfig().mqtt.ca.should.equal('/mqtt/xxx/ca');
            config.getConfig().mqtt.cert.should.equal('/mqtt/xxx/cert.pem');
            config.getConfig().mqtt.key.should.equal('/mqtt/xxx/key.pem');
            config.getConfig().mqtt.rejectUnauthorized.should.equal(true);
            config.getConfig().mqtt.qos.should.equal('0');
            config.getConfig().mqtt.retain.should.equal(false);
            config.getConfig().mqtt.retries.should.equal('2');
            config.getConfig().mqtt.retryTime.should.equal('5');
            config.getConfig().mqtt.keepalive.should.equal('0');
            done();
        });
    });

    describe('When the AMQP transport is started with environment variables', function () {
        beforeEach(function () {
            process.env.IOTA_AMQP_HOST = 'localhost';
            process.env.IOTA_AMQP_PORT = '9090';
            process.env.IOTA_AMQP_USERNAME = 'useramqp';
            process.env.IOTA_AMQP_PASSWORD = 'passamqp';
            process.env.IOTA_AMQP_EXCHANGE = 'xxx';
            process.env.IOTA_AMQP_QUEUE = '0';
            process.env.IOTA_AMQP_DURABLE = 'true';
            process.env.IOTA_AMQP_RETRIES = '0';
            process.env.IOTA_AMQP_RETRY_TIME = '5';
        });

        afterEach(function () {
            delete process.env.IOTA_AMQP_HOST;
            delete process.env.IOTA_AMQP_PORT;
            delete process.env.IOTA_AMQP_USERNAME;
            delete process.env.IOTA_AMQP_PASSWORD;
            delete process.env.IOTA_AMQP_EXCHANGE;
            delete process.env.IOTA_AMQP_QUEUE;
            delete process.env.IOTA_AMQP_DURABLE;
            delete process.env.IOTA_AMQP_RETRIES;
            delete process.env.IOTA_AMQP_RETRY_TIME;
        });

        it('should load the AMQP environment variables in the internal configuration', function (done) {
            config.setConfig(iotAgentConfig);
            config.getConfig().amqp.host.should.equal('localhost');
            config.getConfig().amqp.port.should.equal('9090');
            config.getConfig().amqp.username.should.equal('useramqp');
            config.getConfig().amqp.password.should.equal('passamqp');
            config.getConfig().amqp.exchange.should.equal('xxx');
            config.getConfig().amqp.queue.should.equal('0');
            config.getConfig().amqp.options.durable.should.equal(true);
            config.getConfig().amqp.retries.should.equal('0');
            config.getConfig().amqp.retryTime.should.equal('5');
            done();
        });
    });

    describe('When the HTTP transport is started with environment variables', function () {
        beforeEach(function () {
            sinon.stub(fs, 'statSync');
            process.env.IOTA_HTTP_HOST = 'localhost';
            process.env.IOTA_HTTP_PORT = '2222';
            process.env.IOTA_HTTP_TIMEOUT = '5';
            process.env.IOTA_HTTP_KEY = '/http/bbb/key.pem';
            process.env.IOTA_HTTP_CERT = '/http/bbb/cert.pem';
        });

        afterEach(function () {
            fs.statSync.restore();
            delete process.env.IOTA_HTTP_HOST;
            delete process.env.IOTA_HTTP_PORT;
            delete process.env.IOTA_HTTP_TIMEOUT;
            delete process.env.IOTA_HTTP_KEY;
            delete process.env.IOTA_HTTP_CERT;
        });

        it('should load the HTTP environment variables in the internal configuration', function (done) {
            config.setConfig(iotAgentConfig);
            config.getConfig().http.host.should.equal('localhost');
            config.getConfig().http.port.should.equal('2222');
            config.getConfig().http.timeout.should.equal('5');
            config.getConfig().http.key.should.equal('/http/bbb/key.pem');
            config.getConfig().http.cert.should.equal('/http/bbb/cert.pem');
            done();
        });
    });

    //
    // FIXME: the following tests are causing errors always in travis:
    //
    //    1) Startup tests
    //      When the IoT Agent is started with environment variables
    //        should load the environment variables in the internal configuration:
    //    Error: Timeout of 3000ms exceeded. For async tests and hooks, ensure "done()" is
    //    called; if returning a Promise, ensure it resolves.
    //    (/home/travis/build/telefonicaid/iotagent-json/test/unit/startup-test.js)

    // 2) Startup tests
    //      When the IoT Agent is started with environment variables
    //        should support configuring mqtts through the use of environment variables:
    //    Error: Timeout of 3000ms exceeded. For async tests and hooks, ensure "done()" is
    //    called; if returning a Promise, ensure it resolves.
    // (/home/travis/build/telefonicaid/iotagent-json/test/unit/startup-test.js)

    // 3) Startup tests
    //      When the IoT Agent is started with environment variables
    //        should support configuring tls certificates through the use of environment variables:
    //    Error: Timeout of 3000ms exceeded. For async tests and hooks, ensure "done()" is
    // called; if returning a Promise, ensure it resolves.
    // (/home/travis/build/telefonicaid/iotagent-json/test/unit/startup-test.js)

    // describe('When the IoT Agent is started with environment variables', function() {
    //     beforeEach(function() {
    //         sinon.stub(fs, 'readFileSync');
    //         sinon.stub(mqtt, 'connect').returns({
    //             end: sinon.stub().callsFake(function(force, callback) {
    //                 callback();
    //             }),
    //             on: sinon.stub().callsFake(function(type, listener) {
    //                 if (type === 'connect') {
    //                     listener();
    //                 }
    //             }),
    //             subscribe: sinon.stub().callsFake(function(topics, _, callback) {
    //                 callback(false);
    //             }),
    //             unsubscribe: sinon.spy()
    //         });
    //     });

    //     afterEach(function(done) {
    //         fs.readFileSync.restore();
    //         mqtt.connect.restore();

    //         delete process.env.IOTA_MQTT_PROTOCOL;
    //         delete process.env.IOTA_MQTT_HOST;
    //         delete process.env.IOTA_MQTT_PORT;
    //         delete process.env.IOTA_MQTT_CA;
    //         delete process.env.IOTA_MQTT_CERT;
    //         delete process.env.IOTA_MQTT_KEY;
    //         delete process.env.IOTA_MQTT_REJECT_UNAUTHORIZED;
    //         delete process.env.IOTA_MQTT_USERNAME;
    //         delete process.env.IOTA_MQTT_PASSWORD;
    //         delete process.env.IOTA_HTTP_HOST;
    //         delete process.env.IOTA_HTTP_PORT;
    //         delete process.env.IOTA_HTTP_QOS;
    //         delete process.env.IOTA_HTTP_RETAIN;

    //         iotagentJSON.stop(done);
    //     });

    //     it('should load the environment variables in the internal configuration', function(done) {
    //         process.env.IOTA_MQTT_HOST = '127.0.0.1';
    //         process.env.IOTA_MQTT_PORT = '1883';
    //         process.env.IOTA_MQTT_USERNAME = 'usermqtt';
    //         process.env.IOTA_MQTT_PASSWORD = 'passmqtt';
    //         process.env.IOTA_HTTP_HOST = 'localhost';
    //         process.env.IOTA_HTTP_PORT = '2222';

    //         iotagentJSON.start(iotAgentConfig, function(error) {
    //             should.not.exist(error);

    //             //prettier-ignore
    //             mqtt.connect.calledOnceWithExactly({
    //                 ca: null,
    //                 cert: null,
    //                 connectTimeout: 3600000,
    //                 host: '127.0.0.1',
    //                 keepalive: 0,
    //                 key: null,
    //                 password: 'passmqtt',
    //                 port: '1883',
    //                 protocol: 'mqtt',
    //                 rejectUnauthorized: true,
    //                 username: 'usermqtt'
    //             })
    //             .should.equal(true);

    //             var mqttConfig = config.getConfig().mqtt;
    //             mqttConfig.host.should.equal('127.0.0.1');
    //             mqttConfig.port.should.equal('1883');
    //             mqttConfig.username.should.equal('usermqtt');
    //             mqttConfig.password.should.equal('passmqtt');

    //             var httpConfig = config.getConfig().http;
    //             httpConfig.host.should.equal('localhost');
    //             httpConfig.port.should.equal('2222');

    //             done();
    //         });
    //     });

    //     it('should support configuring mqtts through the use of environment variables', function(done) {
    //         process.env.IOTA_MQTT_PROTOCOL = 'mqtts';
    //         process.env.IOTA_MQTT_HOST = '127.0.0.1';
    //         process.env.IOTA_MQTT_PORT = '8883';
    //         process.env.IOTA_MQTT_REJECT_UNAUTHORIZED = 'False';

    //         iotagentJSON.start(iotAgentConfig, function(error) {
    //             should.not.exist(error);

    //             //prettier-ignore
    //             mqtt.connect.calledOnceWithExactly({
    //                 ca: null,
    //                 cert: null,
    //                 connectTimeout: 3600000,
    //                 host: '127.0.0.1',
    //                 keepalive: 0,
    //                 key: null,
    //                 password: null,
    //                 port: '8883',
    //                 protocol: 'mqtts',
    //                 rejectUnauthorized: false,
    //                 username: null
    //             })
    //             .should.equal(true);

    //             var mqttConfig = config.getConfig().mqtt;
    //             mqttConfig.protocol.should.equal('mqtts');
    //             mqttConfig.host.should.equal('127.0.0.1');
    //             mqttConfig.port.should.equal('8883');
    //             mqttConfig.rejectUnauthorized.should.equal(false);

    //             done();
    //         });
    //     });

    //     it('should support configuring tls certificates through the use of environment variables', function(done) {
    //         process.env.IOTA_MQTT_PROTOCOL = 'mqtts';
    //         process.env.IOTA_MQTT_HOST = '127.0.0.1';
    //         process.env.IOTA_MQTT_PORT = '8883';
    //         process.env.IOTA_MQTT_CERT = '/run/secrets/cert.pem';
    //         process.env.IOTA_MQTT_KEY = '/run/secrets/key.pem';
    //         process.env.IOTA_MQTT_CA = '/run/secrets/ca.pem';
    //         process.env.IOTA_MQTT_REJECT_UNAUTHORIZED = 'true';

    //         fs.readFileSync.callsFake(function(filename) {
    //             switch (filename) {
    //                 case process.env.IOTA_MQTT_CERT:
    //                     return 'certcontent';
    //                 case process.env.IOTA_MQTT_KEY:
    //                     return 'keycontent';
    //                 case process.env.IOTA_MQTT_CA:
    //                     return 'cacontent';
    //             }
    //         });

    //         iotagentJSON.start(iotAgentConfig, function(error) {
    //             should.not.exist(error);

    //             //prettier-ignore
    //             mqtt.connect.calledOnceWithExactly({
    //                 ca: 'cacontent',
    //                 cert: 'certcontent',
    //                 connectTimeout: 3600000,
    //                 host: '127.0.0.1',
    //                 keepalive: 0,
    //                 key: 'keycontent',
    //                 password: null,
    //                 port: '8883',
    //                 protocol: 'mqtts',
    //                 rejectUnauthorized: true,
    //                 username: null
    //             })
    //             .should.equal(true);

    //             var mqttConfig = config.getConfig().mqtt;
    //             mqttConfig.protocol.should.equal('mqtts');
    //             mqttConfig.host.should.equal('127.0.0.1');
    //             mqttConfig.port.should.equal('8883');
    //             mqttConfig.cert.should.equal('certcontent');
    //             mqttConfig.key.should.equal('keycontent');
    //             mqttConfig.ca.should.equal('cacontent');
    //             mqttConfig.rejectUnauthorized.should.equal(true);

    //             done();
    //         });
    //     });
    // });
});
