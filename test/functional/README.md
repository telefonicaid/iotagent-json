## Functional test suite

This directory contains the functional test suite for the IoTA JSON. This test suite is based on mocha and chai. For
mocks, we use the nock library. Additionally, it uses some specific functions to ease to implement the test. Helper
functions are located in the `testUtils.js` file.

There are 2 tests files in this directory:

-   `fuctional-tests.js`: This file contains the test defined in the "classic way". This means, coded in the JS file as
    any other mocha test. It uses the functions defined in the `testUtils.js` file to simplify the tests.
-   `functional-tests-auto.js`: This file contains the test defined in the "automatic way". This means, the test cases
    are defined as JSON in a separate file (`testCases.js`). This file is loaded by the test suite and the test cases
    are automatically generated. This is the recommended way to define the test cases.

### Automatic test cases

Each test case is defined as a JSON object in the `testCases.js` file. This file is loaded by the test suite and the
test cases are automatically generated. Each test case is defined as an object with the following elements:

-   `describeName`: The name of the `DESCRIBE` test case. This will be used to generate the test case name in the mocha
    test suite.
-   `provision`: The JSON object that will be sent to the IoTA JSON provisioning API. This will be used to create the
    group. It contains the following elements:
    -   `url`: The URL of the provisioning API (group)
    -   `method`: The HTTP method to use (POST)
    -   `json`: The JSON object that defines the group
    -   `headers`: The headers to send to the provisioning API. This should contain the `fiware-service` and
        `fiware-servicepath` headers.
-   `should`: The array of test cases to execute. Each test case is defined as an object with the following elements:
    -   `transport`: The transport to use to send the measure. This can be `HTTP` or `MQTT`. It uses `HTTP` by default
        or if the `transport` element is not defined. See the "Advanced features" section for more information.
    -   `shouldName`: The name of the `IT` test case. This will be used to generate the test case name in the mocha test
        suite.
    -   `type`: The type of the test case. This can be `single` or `multientity`. See the "Advanced features" section
        for more information.
    -   `measure`: The JSON object that will be sent to the IoTA JSON measure API. This will be used to send the
        measure. It contains the following elements:
        -   `url`: The URL of the measure API (group)
        -   `method`: The HTTP method to use (POST)
        -   `qs`: The query string to send to the measure API. This should contain the `i` and `k` parameters.
        -   `json`: The JSON object that defines the measure
    -   `expectation`: The JSON object that defines the expectation. This will be used to check that the measure has
        been correctly sent to the Context Broker.

#### Example

```javascript
{
    describeName: 'Basic group provision with attributes',
    provision: {
        url: 'http://localhost:' + config.iota.server.port + '/iot/services',
        method: 'POST',
        json: {
            services: [
                {
                    resource: '/iot/json',
                    apikey: '123456',
                    entity_type: 'TheLightType2',
                    cbHost: 'http://192.168.1.1:1026',
                    commands: [],
                    lazy: [],
                    attributes: [
                        {
                            object_id: 's',
                            name: 'status',
                            type: 'Boolean'
                        },
                        {
                            object_id: 't',
                            name: 'temperature',
                            type: 'Number'
                        }
                    ],
                    static_attributes: []
                }
            ]
        },
        headers: {
            'fiware-service': 'smartgondor',
            'fiware-servicepath': '/gardens'
        }
    },
    should:[
        {
            shouldName: 'should send its value to the Context Broker',
            type: 'single',
            measure: {
                url: 'http://localhost:' + config.http.port + '/iot/json',
                method: 'POST',
                qs: {
                    i: 'MQTT_2',
                    k: '123456'
                },
                json: {
                    s: false,
                    t: 10
                }
            },
            expectation: {
                id: 'TheLightType2:MQTT_2',
                type: 'TheLightType2',
                temperature: {
                    value: 10,
                    type: 'Number'
                },
                status: {
                    value: false,
                    type: 'Boolean'
                }
            }
        },
        {
            transport: 'MQTT',
            shouldName: 'should send its value to the Context Broker when using MQTT',
            type: 'single',
            measure: {
                url: 'http://localhost:' + config.http.port + '/iot/json',
                method: 'POST',
                qs: {
                    i: 'MQTT_2',
                    k: '123456'
                },
                json: {
                    s: false,
                    t: 10
                }
            },
            expectation: {
                id: 'TheLightType2:MQTT_2',
                type: 'TheLightType2',
                temperature: {
                    value: 10,
                    type: 'Number'
                },
                status: {
                    value: false,
                    type: 'Boolean'
                }
            }
        }
    ]
}
```

### Advanced features

#### Multientity

This test suite support the multientity feature. To test this feature, you need to set add to the test case the
parameter `type: 'multientity'`. This will automatically take care of the multientity feature. This means that the suite
will configure the mock to listen to `/v2/op/update` instead of `/v2/entities?options=upsert`.

In particular, it will configure the mock to listen the correct URL. You should define the expectation for the test case
as a batch operation (see the following example).

```javascript
{
    "entities": [
        {
            "id": "TheLightType2:MQTT_2",
            "type": "TheLightType2",
            "status": {
                "value": false,
                "type": "Boolean"
            }
        },
        {
            "id": "TheLightType2:MQTT_3",
            "type": "TheLightType2",
            "temperature": {
                "value": 10,
                "type": "Number"
            }
        }
    ],
    "actionType": "append"
}
```

#### Multimeasures

It is also supported to test cases in which is sent more than one measure. To do so, you need to define the test case
expectation as an array, with one object for each measurement. Then, the suite will recognize the array length and will
expect the same number of NGSI requests. I.E:

```js
[
    {
        id: "TheLightType2:MQTT_2",
        type: "TheLightType2",
        temperature: {
            value: 10,
            type: "Number",
        },
        status: {
            value: false,
            type: "Boolean",
        },
    },
    {
        id: "TheLightType2:MQTT_2",
        type: "TheLightType2",
        temperature: {
            value: 20,
            type: "Number",
        },
        status: {
            value: true,
            type: "Boolean",
        },
    },
];
```

You also should define the measure as multimeasure. This is done by defining the measure JSON element as an array of
objects. Each object will be a measure that will be sent to the Context Broker in a different request. I.E:

```javascript
measure: {
    url: 'http://localhost:' + config.http.port + '/iot/json',
    method: 'POST',
    qs: {
        i: 'MQTT_2',
        k: '123456'
    },
    json: [
        {
            s: false,
            t: 10
        },
        {
            s: true,
            t: 20
        }
    ]
}
```

#### MQTT Support

The test suite also supports MQTT for measure sending. To do so, you need to define the measure as MQTT. This is done by
adding the `transport` element to each should case having the value set to `MQTT`. By doing so, the suite will
automatically configure the mock to connect to the MQTT broker and send the measure to the correct topic based on the
`i` and `k` parameters. It will ignore the `url` and `method` parameters present in the measure JSON element. I.E:

```javascript
should: [
    {
        transport: "MQTT",
        shouldName: "should send its value to the Context Broker when using MQTT",
        type: "single",
        measure: {
            url: "http://localhost:" + config.http.port + "/iot/json",
            method: "POST",
            qs: {
                i: "MQTT_2",
                k: "123456",
            },
            json: {
                s: false,
                t: 10,
            },
        },
        expectation: {
            id: "TheLightType2:MQTT_2",
            type: "TheLightType2",
            temperature: {
                value: 10,
                type: "Number",
            },
            status: {
                value: false,
                type: "Boolean",
            },
        },
    },
];
```

#### No payload reception

The test suite also supports the case in which the Context Broker does not receive any payload. This is done by defining
the expectation as an empty object. I.E:

```javascript
    ...
    expectation: []
    ...
```

### Debugging automated tests

It is possible to debug the automated tests by using the loglevel parameter set to `debug` for each should case. This
parameter configures the IoTA log level. By setting it to `debug`, the agent will log all the debug messages to the
console. This is useful to check the messages sent to the Context Broker.

It is also useful to debug the test by adding a breakpoint in the `testUtils.js` (read the comments in the file to know
where to add the breakpoint). This will allow you to debug just that particular test case stopping the execution in the
breakpoint.

Example of a test case with the loglevel set to `debug`:

```javascript
should:[
    {
        shouldName: 'should send its value to the Context Broker when using MQTT',
        loglevel: 'debug',
        transport: 'MQTT',
        type: 'single',
        measure: {...},
        expectation: {...}
    }
]
```
