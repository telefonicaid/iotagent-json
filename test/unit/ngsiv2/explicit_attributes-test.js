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
 * Modified by: Miguel Angel Pedraza
 */

/* eslint-disable no-unused-vars */

const iotaJson = require('../../../lib/iotagent-json');
const config = require('./config-test.js');
const nock = require('nock');
const iotAgentLib = require('iotagent-node-lib');
const should = require('should');
const async = require('async');

const utils = require('../../utils');
const request = utils.request;
const groupCreation = {
    url: 'http://localhost:' + config.iota.server.port + '/iot/services',
    method: 'POST',
    json: {
        services: [
            {
                resource: '/iot/json',
                apikey: 'KL223HHV8732SFL1',
                entity_type: 'Sensor:Temperature',
                trust: '8970A9078A803H3BL98PINEQRW8342HBAMS',
                cbHost: 'http://unexistentHost:1026',
                commands: [],
                lazy: [],
                explicitAttrs: true,
                attributes: [{ object_id: 't', name: 'temperature', type: 'Number' }]
            }
        ]
    },
    headers: {
        'fiware-service': 'smartgondor',
        'fiware-servicepath': '/gardens'
    }
};

const groupExplicitAttrsTrue = {
    url: 'http://localhost:' + config.iota.server.port + '/iot/services',
    method: 'POST',
    json: {
        services: [
            {
                resource: '/iot/json',
                apikey: 'KL223HHV8732SFL1',
                entity_type: 'Sensor:Temperature',
                trust: '8970A9078A803H3BL98PINEQRW8342HBAMS',
                cbHost: 'http://unexistentHost:1026',
                commands: [],
                lazy: [],
                explicitAttrs: true,
                attributes: [{ object_id: 't', name: 'temperature', type: 'Number' }]
            }
        ]
    },
    headers: {
        'fiware-service': 'smartgondor',
        'fiware-servicepath': '/gardens'
    }
};

const groupExplicitAttrsFalse = {
    url: 'http://localhost:' + config.iota.server.port + '/iot/services',
    method: 'POST',
    json: {
        services: [
            {
                resource: '/iot/json',
                apikey: 'KL223HHV8732SFL1',
                entity_type: 'Sensor:Temperature',
                trust: '8970A9078A803H3BL98PINEQRW8342HBAMS',
                cbHost: 'http://unexistentHost:1026',
                commands: [],
                lazy: [],
                explicitAttrs: false,
                attributes: [{ object_id: 't', name: 'temperature', type: 'Number' }]
            }
        ]
    },
    headers: {
        'fiware-service': 'smartgondor',
        'fiware-servicepath': '/gardens'
    }
};

const groupWithoutExplicitAttrs = {
    url: 'http://localhost:' + config.iota.server.port + '/iot/services',
    method: 'POST',
    json: {
        services: [
            {
                resource: '/iot/json',
                apikey: 'KL223HHV8732SFL1',
                entity_type: 'Sensor:Temperature',
                trust: '8970A9078A803H3BL98PINEQRW8342HBAMS',
                cbHost: 'http://unexistentHost:1026',
                commands: [],
                lazy: [],
                attributes: [{ object_id: 't', name: 'temperature', type: 'Number' }]
            }
        ]
    },
    headers: {
        'fiware-service': 'smartgondor',
        'fiware-servicepath': '/gardens'
    }
};

let contextBrokerMock;

describe('explicitAttrs tests', function () {
    beforeEach(function (done) {
        nock.cleanAll();
        iotaJson.start(config, function () {
            done();
        });
    });

    afterEach(function (done) {
        nock.cleanAll();
        async.series([iotAgentLib.clearAll, iotaJson.stop], done);
    });

    describe('When a measure from an unprovisioned device arrives in a group with explicitAttrs=true', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                h: '33',
                t: '89'
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'JSON_UNPROVISIONED',
                k: 'KL223HHV8732SFL1'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch('/v2/entities/Sensor:Temperature:JSON_UNPROVISIONED/attrs', {
                    temperature: { type: 'Number', value: '89' }
                })
                .query({ type: 'Sensor:Temperature' })
                .reply(204);

            request(groupExplicitAttrsTrue, function (error, response, body) {
                done();
            });
        });

        it('should store only explicit attributes', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a measure from a provisioned device with explicitAttrs=false arrives in a group with explicitAttrs=true', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                h: '33',
                t: '89'
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'JSON_UNPROVISIONED',
                k: 'KL223HHV8732SFL1'
            }
        };

        const provisionDevice = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: {
                devices: [
                    {
                        device_id: 'JSON_UNPROVISIONED',
                        entity_name: 'Sensor:Temperature:JSON_UNPROVISIONED',
                        entity_type: 'Sensor:Temperature',
                        attributes: [
                            {
                                object_id: 't',
                                name: 'temperature',
                                type: 'Number'
                            }
                        ],
                        transport: 'HTTP',
                        explicitAttrs: false
                    }
                ]
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch('/v2/entities/Sensor:Temperature:JSON_UNPROVISIONED/attrs', {
                    h: { type: 'string', value: '33' },
                    temperature: { type: 'Number', value: '89' }
                })
                .query({ type: 'Sensor:Temperature' })
                .reply(204);

            request(groupExplicitAttrsTrue, function (error, response, body) {
                request(provisionDevice, function (error, response, body) {
                    done();
                });
            });
        });

        it('should store all attributes', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a measure from a provisioned device with explicitAttrs=true arrives in a group with explicitAttrs=true', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                h: '33',
                t: '89'
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'JSON_UNPROVISIONED',
                k: 'KL223HHV8732SFL1'
            }
        };

        const provisionDevice = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: {
                devices: [
                    {
                        device_id: 'JSON_UNPROVISIONED',
                        entity_name: 'Sensor:Temperature:JSON_UNPROVISIONED',
                        entity_type: 'Sensor:Temperature',
                        attributes: [
                            {
                                object_id: 't',
                                name: 'temperature',
                                type: 'Number'
                            }
                        ],
                        transport: 'HTTP',
                        explicitAttrs: true
                    }
                ]
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch('/v2/entities/Sensor:Temperature:JSON_UNPROVISIONED/attrs', {
                    temperature: { type: 'Number', value: '89' }
                })
                .query({ type: 'Sensor:Temperature' })
                .reply(204);

            request(groupExplicitAttrsTrue, function (error, response, body) {
                request(provisionDevice, function (error, response, body) {
                    done();
                });
            });
        });

        it('should store only explicit attributes', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a measure from a provisioned device without explicitAttrs arrives in a group with explicitAttrs=true', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                h: '33',
                t: '89'
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'JSON_UNPROVISIONED',
                k: 'KL223HHV8732SFL1'
            }
        };

        const provisionDevice = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: {
                devices: [
                    {
                        device_id: 'JSON_UNPROVISIONED',
                        entity_name: 'Sensor:Temperature:JSON_UNPROVISIONED',
                        entity_type: 'Sensor:Temperature',
                        attributes: [
                            {
                                object_id: 't',
                                name: 'temperature',
                                type: 'Number'
                            }
                        ],
                        transport: 'HTTP'
                    }
                ]
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch('/v2/entities/Sensor:Temperature:JSON_UNPROVISIONED/attrs', {
                    temperature: { type: 'Number', value: '89' }
                })
                .query({ type: 'Sensor:Temperature' })
                .reply(204);

            request(groupExplicitAttrsTrue, function (error, response, body) {
                request(provisionDevice, function (error, response, body) {
                    done();
                });
            });
        });

        it('should store only explicit attributes', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a measure from an unprovisioned device arrives in a group with explicitAttrs=false', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                h: '33',
                t: '89'
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'JSON_UNPROVISIONED',
                k: 'KL223HHV8732SFL1'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch('/v2/entities/Sensor:Temperature:JSON_UNPROVISIONED/attrs', {
                    h: { type: 'string', value: '33' },
                    temperature: { type: 'Number', value: '89' }
                })
                .query({ type: 'Sensor:Temperature' })
                .reply(204);

            request(groupExplicitAttrsFalse, function (error, response, body) {
                done();
            });
        });

        it('should store only explicit attributes', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a measure from a provisioned device with explicitAttrs=false arrives in a group with explicitAttrs=false', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                h: '33',
                t: '89'
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'JSON_UNPROVISIONED',
                k: 'KL223HHV8732SFL1'
            }
        };

        const provisionDevice = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: {
                devices: [
                    {
                        device_id: 'JSON_UNPROVISIONED',
                        entity_name: 'Sensor:Temperature:JSON_UNPROVISIONED',
                        entity_type: 'Sensor:Temperature',
                        attributes: [
                            {
                                object_id: 't',
                                name: 'temperature',
                                type: 'Number'
                            }
                        ],
                        transport: 'HTTP',
                        explicitAttrs: false
                    }
                ]
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch('/v2/entities/Sensor:Temperature:JSON_UNPROVISIONED/attrs', {
                    h: { type: 'string', value: '33' },
                    temperature: { type: 'Number', value: '89' }
                })
                .query({ type: 'Sensor:Temperature' })
                .reply(204);

            request(groupExplicitAttrsFalse, function (error, response, body) {
                request(provisionDevice, function (error, response, body) {
                    done();
                });
            });
        });

        it('should store all attributes', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a measure from a provisioned device with explicitAttrs=true arrives in a group with explicitAttrs=false', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                h: '33',
                t: '89'
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'JSON_UNPROVISIONED',
                k: 'KL223HHV8732SFL1'
            }
        };

        const provisionDevice = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: {
                devices: [
                    {
                        device_id: 'JSON_UNPROVISIONED',
                        entity_name: 'Sensor:Temperature:JSON_UNPROVISIONED',
                        entity_type: 'Sensor:Temperature',
                        attributes: [
                            {
                                object_id: 't',
                                name: 'temperature',
                                type: 'Number'
                            }
                        ],
                        transport: 'HTTP',
                        explicitAttrs: true
                    }
                ]
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch('/v2/entities/Sensor:Temperature:JSON_UNPROVISIONED/attrs', {
                    temperature: { type: 'Number', value: '89' }
                })
                .query({ type: 'Sensor:Temperature' })
                .reply(204);

            request(groupExplicitAttrsFalse, function (error, response, body) {
                request(provisionDevice, function (error, response, body) {
                    done();
                });
            });
        });

        it('should store only explicit attributes', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a measure from a provisioned device without explicitAttrs arrives in a group with explicitAttrs=false', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                h: '33',
                t: '89'
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'JSON_UNPROVISIONED',
                k: 'KL223HHV8732SFL1'
            }
        };

        const provisionDevice = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: {
                devices: [
                    {
                        device_id: 'JSON_UNPROVISIONED',
                        entity_name: 'Sensor:Temperature:JSON_UNPROVISIONED',
                        entity_type: 'Sensor:Temperature',
                        attributes: [
                            {
                                object_id: 't',
                                name: 'temperature',
                                type: 'Number'
                            }
                        ],
                        transport: 'HTTP'
                    }
                ]
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch('/v2/entities/Sensor:Temperature:JSON_UNPROVISIONED/attrs', {
                    h: { type: 'string', value: '33' },
                    temperature: { type: 'Number', value: '89' }
                })
                .query({ type: 'Sensor:Temperature' })
                .reply(204);

            request(groupExplicitAttrsFalse, function (error, response, body) {
                request(provisionDevice, function (error, response, body) {
                    done();
                });
            });
        });

        it('should store only explicit attributes', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a measure from an unprovisioned device arrives in a group without defining explicitAttrs', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                h: '33',
                t: '89'
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'JSON_UNPROVISIONED',
                k: 'KL223HHV8732SFL1'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch('/v2/entities/Sensor:Temperature:JSON_UNPROVISIONED/attrs', {
                    h: { type: 'string', value: '33' },
                    temperature: { type: 'Number', value: '89' }
                })
                .query({ type: 'Sensor:Temperature' })
                .reply(204);

            request(groupWithoutExplicitAttrs, function (error, response, body) {
                done();
            });
        });

        it('should store only explicit attributes', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a measure from a provisioned device with explicitAttrs=false arrives in a group without defining explicitAttrs', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                h: '33',
                t: '89'
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'JSON_UNPROVISIONED',
                k: 'KL223HHV8732SFL1'
            }
        };

        const provisionDevice = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: {
                devices: [
                    {
                        device_id: 'JSON_UNPROVISIONED',
                        entity_name: 'Sensor:Temperature:JSON_UNPROVISIONED',
                        entity_type: 'Sensor:Temperature',
                        attributes: [
                            {
                                object_id: 't',
                                name: 'temperature',
                                type: 'Number'
                            }
                        ],
                        transport: 'HTTP',
                        explicitAttrs: false
                    }
                ]
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch('/v2/entities/Sensor:Temperature:JSON_UNPROVISIONED/attrs', {
                    h: { type: 'string', value: '33' },
                    temperature: { type: 'Number', value: '89' }
                })
                .query({ type: 'Sensor:Temperature' })
                .reply(204);

            request(groupWithoutExplicitAttrs, function (error, response, body) {
                request(provisionDevice, function (error, response, body) {
                    done();
                });
            });
        });

        it('should store all attributes', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a measure from a provisioned device with explicitAttrs=true arrives in a group without defining explicitAttrs', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                h: '33',
                t: '89'
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'JSON_UNPROVISIONED',
                k: 'KL223HHV8732SFL1'
            }
        };

        const provisionDevice = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: {
                devices: [
                    {
                        device_id: 'JSON_UNPROVISIONED',
                        entity_name: 'Sensor:Temperature:JSON_UNPROVISIONED',
                        entity_type: 'Sensor:Temperature',
                        attributes: [
                            {
                                object_id: 't',
                                name: 'temperature',
                                type: 'Number'
                            }
                        ],
                        transport: 'HTTP',
                        explicitAttrs: true
                    }
                ]
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch('/v2/entities/Sensor:Temperature:JSON_UNPROVISIONED/attrs', {
                    temperature: { type: 'Number', value: '89' }
                })
                .query({ type: 'Sensor:Temperature' })
                .reply(204);

            request(groupWithoutExplicitAttrs, function (error, response, body) {
                request(provisionDevice, function (error, response, body) {
                    done();
                });
            });
        });

        it('should store only explicit attributes', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });

    describe('When a measure from a provisioned device without explicitAttrs arrives in a group with without defining explicitAttrs', function () {
        const optionsMeasure = {
            url: 'http://localhost:' + config.http.port + '/iot/json',
            method: 'POST',
            json: {
                h: '33',
                t: '89'
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            },
            qs: {
                i: 'JSON_UNPROVISIONED',
                k: 'KL223HHV8732SFL1'
            }
        };

        const provisionDevice = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: {
                devices: [
                    {
                        device_id: 'JSON_UNPROVISIONED',
                        entity_name: 'Sensor:Temperature:JSON_UNPROVISIONED',
                        entity_type: 'Sensor:Temperature',
                        attributes: [
                            {
                                object_id: 't',
                                name: 'temperature',
                                type: 'Number'
                            }
                        ],
                        transport: 'HTTP'
                    }
                ]
            },
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities?options=upsert')
                .reply(204);

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .patch('/v2/entities/Sensor:Temperature:JSON_UNPROVISIONED/attrs', {
                    h: { type: 'string', value: '33' },
                    temperature: { type: 'Number', value: '89' }
                })
                .query({ type: 'Sensor:Temperature' })
                .reply(204);

            request(groupWithoutExplicitAttrs, function (error, response, body) {
                request(provisionDevice, function (error, response, body) {
                    done();
                });
            });
        });

        it('should store only explicit attributes', function (done) {
            request(optionsMeasure, function (error, result, body) {
                contextBrokerMock.done();
                done();
            });
        });
    });
});
