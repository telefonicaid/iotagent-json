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
