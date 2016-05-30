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
var iotagentJSON = require('../../'),
    should = require('should'),
    config = require('../../lib/configService'),
    iotAgentConfig = require('../config-startup.js');

describe('Startup tests', function() {
    describe('When the IoT Agent is started with environment variables', function() {
        beforeEach(function() {
            process.env.IOTA_MQTT_HOST = '127.0.0.1';
            process.env.IOTA_MQTT_PORT = '1883';
            process.env.IOTA_MQTT_USERNAME = 'usermqtt';
            process.env.IOTA_MQTT_PASSWORD = 'passmqtt';
            process.env.IOTA_HTTP_HOST = 'localhost';
            process.env.IOTA_HTTP_PORT = '2222';
        });

        afterEach(function() {
            delete process.env.IOTA_MQTT_HOST;
            delete process.env.IOTA_MQTT_PORT;
            delete process.env.IOTA_MQTT_USERNAME;
            delete process.env.IOTA_MQTT_PASSWORD;
            delete process.env.IOTA_HTTP_HOST;
            delete process.env.IOTA_HTTP_PORT;
        });

        afterEach(function(done) {
            iotagentJSON.stop(done);
        });

        it('should load the environment variables in the internal configuration', function(done) {
            iotagentJSON.start(iotAgentConfig, function(error) {
                should.not.exist(error);
                config.getConfig().mqtt.host.should.equal('127.0.0.1');
                config.getConfig().mqtt.port.should.equal('1883');
                config.getConfig().mqtt.username.should.equal('usermqtt');
                config.getConfig().mqtt.password.should.equal('passmqtt');
                config.getConfig().http.host.should.equal('localhost');
                config.getConfig().http.port.should.equal('2222');
                done();
            });
        });
    });
});
