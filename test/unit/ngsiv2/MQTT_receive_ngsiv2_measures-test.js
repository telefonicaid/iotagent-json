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
 */
/* eslint-disable no-unused-vars */

const iotaJson = require('../../../');
const mqtt = require('mqtt');
const config = require('./config-test.js');
const nock = require('nock');
const iotAgentLib = require('iotagent-node-lib');
const should = require('should');
const async = require('async');

const utils = require('../../utils');
const request = utils.request;
let contextBrokerMock;
let contextBrokerUnprovMock;
let mqttClient;

describe('MQTT: NGSIv2 Measure reception ', function () {
    beforeEach(function (done) {
        const provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsiv2/deviceProvisioning/provisionDeviceHTTP2.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        mqttClient = mqtt.connect('mqtt://' + config.mqtt.host, {
            keepalive: 0,
            connectTimeout: 60 * 60 * 1000
        });

        // This mock does not check the payload since the aim of the test is not to verify
        // device provisioning functionality. Appropriate verification is done in tests under
        // provisioning folder of iotagent-node-lib
        contextBrokerMock = nock('http://192.168.1.1:1026');

        iotaJson.start(config, function () {
            request(provisionOptions, function (error, response, body) {
                done();
            });
        });
    });

    afterEach(function (done) {
        nock.cleanAll();
        mqttClient.end();

        async.series([iotAgentLib.clearAll, iotaJson.stop], done);
    });

    describe('When a Publish single NGSIv2 append measure format arrives for the MQTT binding and NGSIV2 is the expected payload type', function () {
        const measure = {
            actionType: 'append',
            entities: [
                {
                    id: 'urn:ngsiv2:Streetlight:Streetlight-Mylightpoint-2',
                    type: 'Streetlight',
                    name: {
                        type: 'Text',
                        value: 'MyLightPoint-test1'
                    },
                    description: {
                        type: 'Text',
                        value: 'testdescription'
                    },
                    status: {
                        type: 'Text',
                        value: 'connected',
                        metadata: {
                            TimeInstant: {
                                type: 'DateTime',
                                value: '2023-11-17T11:59:22.661Z'
                            }
                        }
                    },
                    dateServiceStarted: {
                        type: 'DateTime',
                        value: '2020-06-04T09: 55: 02'
                    },
                    locationComment: {
                        type: 'Text',
                        value: 'Test1'
                    },
                    location: {
                        type: 'geo:json',
                        value: {
                            coordinates: [-87.88429, 41.99499],
                            type: 'Point'
                        }
                    },
                    address: {
                        type: 'Text',
                        value: {
                            streetAddress: 'MyStreet'
                        }
                    },
                    isRemotelyManaged: {
                        type: 'Integer',
                        value: 1
                    },
                    installationDate: {
                        type: 'DateTime',
                        value: '2022-04-17T02: 30: 04'
                    }
                }
            ]
        };

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/ngsiv2PayloadMeasure.json')
                )
                .reply(204);
        });
        it('should send its value to the Context Broker', function (done) {
            mqttClient.publish('json/1234/MQTT_2/attrs', JSON.stringify(measure), null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a publish multiple NGSIv2 append measure format arrives for the MQTT binding and NGSIV2 is the expected payload type', function () {
        const measure = {
            actionType: 'append',
            entities: [
                {
                    id: 'urn:ngsiv2:Streetlight:Streetlight-Mylightpoint-2',
                    type: 'Streetlight',
                    name: {
                        type: 'Text',
                        value: 'MyLightPoint-test1'
                    },
                    description: {
                        type: 'Text',
                        value: 'testdescription'
                    },
                    status: {
                        type: 'Text',
                        value: 'connected',
                        metadata: {
                            TimeInstant: {
                                type: 'DateTime',
                                value: '2023-11-17T11:59:22.661Z'
                            }
                        }
                    },
                    dateServiceStarted: {
                        type: 'DateTime',
                        value: '2020-06-04T09: 55: 02'
                    },
                    locationComment: {
                        type: 'Text',
                        value: 'Test1'
                    },
                    location: {
                        type: 'geo:json',
                        value: {
                            coordinates: [-87.88429, 41.99499],
                            type: 'Point'
                        }
                    },
                    address: {
                        type: 'Text',
                        value: {
                            streetAddress: 'MyStreet'
                        }
                    },
                    isRemotelyManaged: {
                        type: 'Integer',
                        value: 1
                    },
                    installationDate: {
                        type: 'DateTime',
                        value: '2022-04-17T02: 30: 04'
                    }
                },
                {
                    id: 'urn:ngsiv2:Streetlight:Streetlight-Mylightpoint-3',
                    type: 'Streetlight',
                    name: {
                        type: 'Text',
                        value: 'MyLightPoint-test2'
                    },
                    description: {
                        type: 'Text',
                        value: 'testdescription'
                    },
                    status: {
                        type: 'Text',
                        value: 'connected',
                        metadata: {
                            TimeInstant: {
                                type: 'DateTime',
                                value: '2023-11-17T11:59:22.661Z'
                            }
                        }
                    },
                    dateServiceStarted: {
                        type: 'DateTime',
                        value: '2022-06-04T09: 55: 02'
                    },
                    locationComment: {
                        type: 'Text',
                        value: 'Test3'
                    },
                    location: {
                        type: 'geo:json',
                        value: {
                            coordinates: [-84.88429, 42.99499],
                            type: 'Point'
                        }
                    },
                    address: {
                        type: 'Text',
                        value: {
                            streetAddress: 'MyFarStreet'
                        }
                    },
                    isRemotelyManaged: {
                        type: 'Integer',
                        value: 3
                    },
                    installationDate: {
                        type: 'DateTime',
                        value: '2023-04-17T02: 30: 04'
                    }
                }
            ]
        };
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/ngsiv2PayloadMeasure.json')
                )
                .reply(204);
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/ngsiv2PayloadMeasure2.json')
                )
                .reply(204);
        });
        it('should send its value to the Context Broker', function (done) {
            mqttClient.publish('json/1234/MQTT_2/attrs', JSON.stringify(measure), null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a publish single NGSIv2 entity measure format arrives for the MQTT binding and NGSIV2 is the expected payload type', function () {
        const measure = {
            id: 'urn:ngsiv2:Streetlight:Streetlight-Mylightpoint-2',
            type: 'Streetlight',
            name: {
                type: 'Text',
                value: 'MyLightPoint-test1'
            },
            description: {
                type: 'Text',
                value: 'testdescription'
            },
            status: {
                type: 'Text',
                value: 'connected',
                metadata: {
                    TimeInstant: {
                        type: 'DateTime',
                        value: '2023-11-17T11:59:22.661Z'
                    }
                }
            },
            dateServiceStarted: {
                type: 'DateTime',
                value: '2020-06-04T09: 55: 02'
            },
            locationComment: {
                type: 'Text',
                value: 'Test1'
            },
            location: {
                type: 'geo:json',
                value: {
                    coordinates: [-87.88429, 41.99499],
                    type: 'Point'
                }
            },
            address: {
                type: 'Text',
                value: {
                    streetAddress: 'MyStreet'
                }
            },
            isRemotelyManaged: {
                type: 'Integer',
                value: 1
            },
            installationDate: {
                type: 'DateTime',
                value: '2022-04-17T02: 30: 04'
            }
        };
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/ngsiv2PayloadMeasure.json')
                )
                .reply(204);
        });
        it('should send its value to the Context Broker', function (done) {
            mqttClient.publish('json/1234/MQTT_2/attrs', JSON.stringify(measure), null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a publish multiple NGSIv2 entity measure format arrives for the MQTT binding and NGSIV2 is the expected payload type', function () {
        const measure = [
            {
                id: 'urn:ngsiv2:Streetlight:Streetlight-Mylightpoint-2',
                type: 'Streetlight',
                name: {
                    type: 'Text',
                    value: 'MyLightPoint-test1'
                },
                description: {
                    type: 'Text',
                    value: 'testdescription'
                },
                status: {
                    type: 'Text',
                    value: 'connected',
                    metadata: {
                        TimeInstant: {
                            type: 'DateTime',
                            value: '2023-11-17T11:59:22.661Z'
                        }
                    }
                },
                dateServiceStarted: {
                    type: 'DateTime',
                    value: '2020-06-04T09: 55: 02'
                },
                locationComment: {
                    type: 'Text',
                    value: 'Test1'
                },
                location: {
                    type: 'geo:json',
                    value: {
                        coordinates: [-87.88429, 41.99499],
                        type: 'Point'
                    }
                },
                address: {
                    type: 'Text',
                    value: {
                        streetAddress: 'MyStreet'
                    }
                },
                isRemotelyManaged: {
                    type: 'Integer',
                    value: 1
                },
                installationDate: {
                    type: 'DateTime',
                    value: '2022-04-17T02: 30: 04'
                }
            },
            {
                id: 'urn:ngsiv2:Streetlight:Streetlight-Mylightpoint-3',
                type: 'Streetlight',
                name: {
                    type: 'Text',
                    value: 'MyLightPoint-test2'
                },
                description: {
                    type: 'Text',
                    value: 'testdescription'
                },
                status: {
                    type: 'Text',
                    value: 'connected',
                    metadata: {
                        TimeInstant: {
                            type: 'DateTime',
                            value: '2023-11-17T11:59:22.661Z'
                        }
                    }
                },
                dateServiceStarted: {
                    type: 'DateTime',
                    value: '2022-06-04T09: 55: 02'
                },
                locationComment: {
                    type: 'Text',
                    value: 'Test3'
                },
                location: {
                    type: 'geo:json',
                    value: {
                        coordinates: [-84.88429, 42.99499],
                        type: 'Point'
                    }
                },
                address: {
                    type: 'Text',
                    value: {
                        streetAddress: 'MyFarStreet'
                    }
                },
                isRemotelyManaged: {
                    type: 'Integer',
                    value: 3
                },
                installationDate: {
                    type: 'DateTime',
                    value: '2023-04-17T02: 30: 04'
                }
            }
        ];

        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/ngsiv2PayloadMeasure.json')
                )
                .reply(204);
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post(
                    '/v2/entities?options=upsert',
                    utils.readExampleFile('./test/unit/ngsiv2/contextRequests/ngsiv2PayloadMeasure2.json')
                )
                .reply(204);
        });
        it('should send its value to the Context Broker', function (done) {
            mqttClient.publish('json/1234/MQTT_2/attrs', JSON.stringify(measure), null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });
});
