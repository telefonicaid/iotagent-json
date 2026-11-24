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
 *
 */

const nock = require('nock');
const should = require('should');
const proxyquire = require('proxyquire');
const binding = proxyquire('../../../lib/bindings/HTTPBinding', {
    '../configService': {
        getConfig: () => ({ http: {}, iota: {} })
    }
});

describe('HTTP command execution responses', function () {
    const device = {
        id: 'device1',
        type: 'Thing',
        service: 'smartcity',
        subservice: '/',
        endpoint: 'http://localhost:9876/command'
    };

    afterEach(function () {
        nock.cleanAll();
    });

    it('should report HTTP 200 with a plain-text response as a command error', function (done) {
        const commandDevice = {
            ...device,
            id: 'test125',
            endpoint: 'https://command.example.test/nada'
        };
        const endpoint = nock('https://command.example.test', {
            reqheaders: {
                'fiware-service': 'smartcity',
                'fiware-servicepath': '/',
                'content-type': 'application/json'
            }
        })
            .post('/nada', { ping: 'RRRR' })
            .reply(200, 'Hey ya! Greetings!', { 'Content-Type': 'text/plain' });

        binding.executeCommand(
            null,
            null,
            commandDevice,
            'ping',
            '{"ping":"RRRR"}',
            null,
            'application/json',
            function (error) {
                should.exist(error);
                error.code.should.equal(400);
                error.name.should.equal('HTTP_COMMAND_RESPONSE_ERROR');
                error.message.should.equal(
                    'Command [ping] failed for device [test125]: endpoint returned HTTP 200; invalid JSON response'
                );
                endpoint.isDone().should.equal(true);
                done();
            }
        );
    });

    [
        { status: 200, body: 'Hey ya!', reason: 'invalid JSON' },
        { status: 500, body: { error: 'Command failed' }, reason: 'HTTP 500' },
        { status: 503, body: 'Unavailable', reason: 'HTTP 503' },
        { status: 204, reason: 'HTTP 204' },
        { error: { code: 'ECONNREFUSED', message: 'Connection refused' }, reason: 'Connection refused' }
    ].forEach(function (testCase) {
        it('should describe command failure for ' + testCase.reason, function (done) {
            const endpoint = nock('http://localhost:9876').post('/command', { ping: 'MMMM' });
            if (testCase.error) {
                endpoint.replyWithError(testCase.error);
            } else {
                endpoint.reply(testCase.status, testCase.body);
            }

            binding.executeCommand(null, null, device, 'ping', '{"ping":"MMMM"}', null, 'application/json', function (
                error
            ) {
                should.exist(error);
                error.code.should.equal(400);
                error.name.should.equal('HTTP_COMMAND_RESPONSE_ERROR');
                error.message.should.containEql('ping');
                error.message.should.containEql('device1');
                error.message.should.containEql(testCase.reason);
                if (testCase.status) {
                    error.message.should.containEql('HTTP ' + testCase.status);
                } else {
                    error.message.should.not.containEql('HTTP 400');
                }
                should(nock.isDone()).equal(true);
                done();
            });
        });
    });

    [200, 201].forEach(function (status) {
        it('should continue accepting HTTP ' + status + ' with JSON', function (done) {
            nock('http://localhost:9876').post('/command').reply(status, { ping: 'OK' });
            binding.executeCommand(null, null, device, 'ping', '{"ping":"MMMM"}', null, 'application/json', function (
                error
            ) {
                should.not.exist(error);
                should(nock.isDone()).equal(true);
                done();
            });
        });
    });
});
