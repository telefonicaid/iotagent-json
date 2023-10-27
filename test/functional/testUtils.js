/*
 * Copyright 2023 Telefonica Investigación y Desarrollo, S.A.U
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
 * Modified by: Miguel Angel Pedraza
 */

/* eslint-disable no-unused-vars*/
/* eslint-disable no-unused-expressions*/

const nock = require('nock');
const request = require('iotagent-node-lib').request;
const async = require('async');
const chai = require('chai');
const expect = chai.expect;
const MQTT = require('async-mqtt');

// Error messages
const ERR_CB_EXPECTATION_DIFFER = 'Assertion Error - Context Broker received payload differs from expectation';
const ERR_MEAS_BODY = 'Assertion Error - Measure response is not empty';
const ERR_MEAS_CODE = 'Assertion Error - Measure response status code differs from 200';
const ERR_MQTT = 'Error with MQTT: ';
const ERR_CB_NOT_EMPTY = 'Assertion Error - unexpected Context Broker request received (no request expected)';

/**
 * Send a measure to the IoT Agent
 * @brief Sends a measure to the IoT Agent and returns a promise with the response
 *
 * @param {Object} measure      Measure to be sent to the IoT Agent
 */
function sendMeasurePromise(measure) {
    return new Promise((resolve, reject) => {
        request(measure, function (error, result, body) {
            error ? reject(error) : resolve(result);
        });
    });
}

/**
 * Test Case function
 * @brief Sends a measure to the IoT Agent and validates the response
 * and validates the Context Broker expectation
 *
 * @param {Object} measure      Measure to be sent to the IoT Agent
 * @param {Object} expectation  Expectation for the Context Broker
 * @param {Object} env          Environment variables
 * @param {String} type         Type of test (multientity or multimeasure)
 */

async function testCase(measure, expectation, env, config, type, transport) {
    let receivedContext = [];
    let cbMockRoute = '';
    // Set the correct route depending if the test is multientity or not
    if (type === 'multientity') {
        cbMockRoute = '/v2/op/update';
    } else {
        cbMockRoute = '/v2/entities?options=upsert';
    }

    // Set the correct mock times depending if the test is multimeasure or not
    // based on the length of the expectation array
    let mockTimes = 1;
    if (expectation.length > 1) {
        mockTimes = expectation.length;
    }

    let contextBrokerMock = nock('http://192.168.1.1:1026')
        .matchHeader('fiware-service', env.service)
        .matchHeader('fiware-servicepath', env.servicePath)
        .post(cbMockRoute, function (body) {
            mockTimes === 1 ? (receivedContext = body) : receivedContext.push(body); // Save the received body for later comparison
            return true;
        })
        .times(mockTimes)
        .reply(204);

    // Send a measure to the IoT Agent and wait for the response
    if (transport === 'MQTT') {
        try {
            let client = await MQTT.connectAsync('mqtt://' + config.mqtt.host);
            await client.publish('/' + measure.qs.k + '/' + measure.qs.i + '/attrs', JSON.stringify(measure.json));
            await client.end();
        } catch (error) {
            expect.fail(ERR_MQTT + error);
        }
    } else {
        // HTTP
        const response = await sendMeasurePromise(measure);
        // Validate the response status code and the response body
        expect(response.statusCode, ERR_MEAS_CODE).to.equal(200);
        expect(response.body, ERR_MEAS_BODY).to.be.empty;
    }

    // Validate Context Broker Expectation
    if ((Array.isArray(expectation) && expectation.length > 0) || !Array.isArray(expectation)) {
        // Filter empty expectations
        expect(receivedContext, ERR_CB_EXPECTATION_DIFFER).to.deep.equal(expectation);
        contextBrokerMock.done(); // Ensure the request was made, no matter the body content
    } else {
        expect(contextBrokerMock.isDone(), ERR_CB_NOT_EMPTY).to.be.false;
        expect(receivedContext, ERR_CB_NOT_EMPTY).to.be.empty;
    }
}

exports.sendMeasurePromise = sendMeasurePromise;
exports.testCase = testCase;
