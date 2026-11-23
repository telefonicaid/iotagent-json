/*
 * Copyright 2016 Telefonica Investigación y Desarrollo, S.A.U
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
 *
 *
 *
 */

const nock = require('nock');
const should = require('should');
const request = require('../../../lib/request-shim');

describe('HTTP request adapter responses', function () {
    const options = {
        url: 'https://command.example.test/nada',
        method: 'POST',
        body: '{"ping":"RRRR"}',
        headers: { 'content-type': 'application/json' }
    };

    afterEach(function () {
        nock.cleanAll();
    });

    [200, 201].forEach(function (status) {
        it('should preserve the HTTP ' + status + ' response when JSON parsing fails', function (done) {
            const endpoint = nock('https://command.example.test')
                .post('/nada', { ping: 'RRRR' })
                .reply(status, 'Hey ya! Greetings!', { 'Content-Type': 'text/plain' });

            request(options, function (error, response, body) {
                should.exist(error);
                error.code.should.equal('ERR_BODY_PARSE_FAILURE');
                should.exist(response);
                response.should.equal(error.response);
                response.statusCode.should.equal(status);
                response.headers['content-type'].should.equal('text/plain');
                body.should.equal('Hey ya! Greetings!');
                body.should.equal(response.body);
                endpoint.isDone().should.equal(true);
                done();
            });
        });
    });

    it('should not invent a response when the connection fails', function (done) {
        const endpoint = nock('https://command.example.test')
            .post('/nada', { ping: 'RRRR' })
            .replyWithError({ code: 'ECONNREFUSED', message: 'Connection refused' });

        request(options, function (error, response, body) {
            should.exist(error);
            error.code.should.equal('ECONNREFUSED');
            should(response).equal(undefined);
            should(body).equal(undefined);
            endpoint.isDone().should.equal(true);
            done();
        });
    });

    it('should continue returning parsed JSON for a valid response', function (done) {
        const endpoint = nock('https://command.example.test')
            .post('/nada', { ping: 'RRRR' })
            .reply(200, { ping: 'OK' });

        request(options, function (error, response, body) {
            should.not.exist(error);
            response.statusCode.should.equal(200);
            body.should.deepEqual({ ping: 'OK' });
            body.should.equal(response.body);
            endpoint.isDone().should.equal(true);
            done();
        });
    });
});
