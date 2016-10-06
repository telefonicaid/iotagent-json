# iotagent-json

[![License badge](https://img.shields.io/badge/license-AGPL-blue.svg)](https://opensource.org/licenses/AGPL-3.0)
[![Documentation badge](https://readthedocs.org/projects/fiware-iotagent-json/badge/?version=latest)](http://fiware-iotagent-json.readthedocs.org/en/latest/?badge=latest)
[![Docker badge](https://img.shields.io/docker/pulls/fiware/iotagent-json.svg)](https://hub.docker.com/r/fiware/iotagent-json/)
[![Support badge]( https://img.shields.io/badge/support-sof-yellowgreen.svg)](http://ask.fiware.org)


## Index

* [Description](#description)
* [Build & Install](#buildinstall)
* [API Overview] (#apioverview)
* [API Reference Documentation] (#apireference)
* [Command Line Client](#client)
* [Testing] (#testing)
* [Development] (#development)

## <a name="description"/> Description
This IoT Agent is designed to be a bridge between an MQTT+JSON based protocol and the OMA NGSI standard used in FIWARE.
This project is based in the Node.js IoT Agent library. More information about the IoT Agents can be found in its 
[Github page](https://github.com/telefonicaid/iotagent-node-lib).

A quick way to get started is to read the [Step by step guide](./docs/stepbystep.md).

As is the case in any IoT Agent, this one follows the interaction model defined in the [Node.js IoT Agent Library](https://github.com/telefonicaid/iotagent-node-lib),
that is used for the implementation of the Northbound APIs. Information about the IoTAgent's architecture can be found
on that global repository. This documentation will only address those features and characteristics that are particular
to the JSON IoTAgent.

If you want to contribute to the project, check out the [Development section](#development) and the [Contribution guidelines](./docs/contribution.md).

Additional information about operating the component can be found in the [Operations: logs and alarms](docs/operations.md) document.

## <a name="buildinstall"/> Build & Install

Information about how to install the JSON IoTAgent can be found at the corresponding section of the [Installation & Administration Guide](docs/installationguide.md).

## <a name="apioverview"/> API Overview

An Overview of the API can be found in the [User & Programmers Manual](docs/usermanual.md).

## <a name="apireference"/> API Reference Documentation

Apiary reference for the Configuration API can be found [here](http://docs.telefonicaiotiotagents.apiary.io/#).
More information about IoTAgents and their APIs can be found in the IoTAgent Library [here](https://github.com/telefonicaid/iotagent-node-lib).

## <a name="client"/> Command Line Client 
The JSON IoT Agent comes with a client that can be used to test its features, simulating a device. The client can be 
executed with the following command:
```
bin/iotaJsonTester.js
```
This will show a prompt where commands can be issued to the MQTT broker. For a list of the currently available commands
type `help`.

The client loads a global configuration used for all the commands, containing the host and port of the MQTT broker and
the API Key and Device ID of the device to simulate. This information can be changed with the `config` command.

In order to use any of the MQTT commands, you have to connect to the MQTT broker first. If no connection is available,
MQTT commands will show an error message reminding you to connect.

The Command Line Client gets its default values from a config file in the root of the project: `client-config.js`. This
config file can be used to permanently tune the MQTT broker parameters, or the default device ID and APIKey.

## New transport development

### Overview
This IoT Agent is prepared to serve its protocol (Plain JSON) over multiple transport protocols (MQTT, HTTP...), sharing
most of the code betweend the different protocols. To do so, all the transport-specific code is encapsulated in a series
of plugins, added to the `./bindings/` folder. Each plugin must consist of a single Node.js module with the API defined
in the section below. The IoTA scans this full directory upon start, so there is no need to register new modules (a
simple restart should be enough).

In order to distinguish which device uses which attribute, a new field, `transport`, will be added to the device
provisioning. When a command or a notification arrives to the IoTAgent, this field is read to guess what plugin to invoke
in order to execute the requested task. If the field is not found, the value of the configuration parameter
`defaultTransport` will be used instead. In order to associate a module with a device, the value of the `transport`
attribute of the device provisioning must match the value of the `protocol` field of the binding.

### API
Every plugin in the `plugins/` folder must adhere to the following API (exporting the following functions and
attributes).

#### function start(callback)
##### Description
Start the binding, doing all the appropriate initializations. The configuration is not passed as a parameter, so it
should be retrieved from the configuration service.

All the functions are passed a callback, that **must** be called once the action has been finished, but the callback
itself is not described (in that case, the standard Node.js for callbacks applies).

#### function stop(callback)
##### Description
Stops all the resources created in the `start()` function, releasing the resources when needed.

#### function sendConfigurationToDevice(apiKey, deviceId, results, callback)
##### Description
Send to the device the configuration information requested from the Context Broker.

##### Parameters
* **apiKey**: API Key of the device that is requesting the information.
* **deviceId**: Device ID of the device that is requesting the information.
* **results**: Array containing the results of the query to the Context Broker.

#### function executeCommand(apiKey, device, serializedPayload, callback)
##### Description
Execute a command in a remote device with the specified payload.

##### Parameters
* **apiKey**: API Key of the device that is requesting the information.
* **device**: Object containing all the data of the device that is requesting the information.
* **serializedPayload**: String serialization of the command identification and parameters that is going to be send
using the transport protocol.

#### protocol
The `protocol` attribute is a single constant string attribute that will be used to identify the transport for a certain
device. This parameter is mainly used when a command or notification comes to the IoT Agent, as the device itself is
in charge of selecting its endpoint for incoming active measures or actions. The value of the `protocol` attribute for
a binding must match the `transport` field in the provisioning of each device that will be using the IoTA.

##  <a name="testing"/> Testing

[Mocha](http://visionmedia.github.io/mocha/) Test Runner + [Chai](http://chaijs.com/) Assertion Library + [Sinon](http://sinonjs.org/) Spies, stubs.

The test environment is preconfigured to run [BDD](http://chaijs.com/api/bdd/) testing style with
`chai.expect` and `chai.should()` available globally while executing tests, as well as the [Sinon-Chai](http://chaijs.com/plugins/sinon-chai) plugin.

Module mocking during testing can be done with [proxyquire](https://github.com/thlorenz/proxyquire)

#### Requirements

All the tests are designed to test end to end scenarios, and there are some requirements for its current execution:
- Mosquitto v1.3.5 server running
- MongoDB v3.x server running

#### Execution

To run tests, type
```bash
grunt test
```

Tests reports can be used together with Jenkins to monitor project quality metrics by means of TAP or XUnit plugins.
To generate TAP report in `report/test/unit_tests.tap`, type
```bash
grunt test-report
```

##  <a name="development"/> Development documentation

Information about developing for the JSON IoTAgent can be found at the corresponding section of the [User & Programmers Guide](docs/usermanual.md).