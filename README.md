# FIWARE IoT Agent for a JSON-based Protocol

[![FIWARE IoT Agents](https://nexus.lab.fiware.org/static/badges/chapters/iot-agents.svg)](https://www.fiware.org/developers/catalogue/)
[![License: APGL](https://img.shields.io/github/license/telefonicaid/iotagent-json.svg)](https://opensource.org/licenses/AGPL-3.0)
[![Docker badge](https://img.shields.io/docker/pulls/fiware/iotagent-json.svg)](https://hub.docker.com/r/fiware/iotagent-json/)
[![Support badge](https://nexus.lab.fiware.org/repository/raw/public/badges/stackoverflow/iot-agents.svg)](https://stackoverflow.com/questions/tagged/fiware+iot)
<br/>
[![Documentation badge](https://img.shields.io/readthedocs/fiware-iotagent-json.svg)](https://fiware-iotagent-json.readthedocs.io/en/latest/?badge=latest)
[![CI](https://github.com/telefonicaid/iotagent-json/workflows/CI/badge.svg)](https://github.com/telefonicaid/iotagent-json/actions?query=workflow%3ACI)
[![Coverage Status](https://coveralls.io/repos/github/telefonicaid/iotagent-json/badge.svg?branch=master)](https://coveralls.io/github/telefonicaid/iotagent-json?branch=master)
![Status](https://nexus.lab.fiware.org/static/badges/statuses/iot-json.svg)
[![CII Best Practices](https://bestpractices.coreinfrastructure.org/projects/4695/badge)](https://bestpractices.coreinfrastructure.org/projects/4695)

An Internet of Things Agent for a JSON based protocol (with [AMQP](https://www.amqp.org/),
[HTTP](https://www.w3.org/Protocols/) and [MQTT](https://mqtt.org/) transports). This IoT Agent is designed to be a
bridge between [JSON](https://json.org/) and the
[NGSI](https://swagger.lab.fiware.org/?url=https://raw.githubusercontent.com/Fiware/specifications/master/OpenAPI/ngsiv2/ngsiv2-openapi.json)
interface of a context broker.

It is based on the [IoT Agent Node.js Library](https://github.com/telefonicaid/iotagent-node-lib). Further general
information about the FIWARE IoT Agents framework, its architecture and the common interaction model can be found in the
library's GitHub repository.

This project is part of [FIWARE](https://www.fiware.org/). For more information check the FIWARE Catalogue entry for the
[IoT Agents](https://github.com/Fiware/catalogue/tree/master/iot-agents).

| :books: [Documentation](https://fiware-iotagent-json.readthedocs.io) | :mortar_board: [Academy](https://fiware-academy.readthedocs.io/en/latest/iot-agents/idas) | :whale: [Docker Hub](https://hub.docker.com/r/fiware/iotagent-json/) | :dart: [Roadmap](https://github.com/telefonicaid/iotagent-json/blob/master/docs/roadmap.md) |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |


## Contents

-   [Background](#background)
-   [Install](#build--install)
-   [Usage](#usage)
-   [API](#api)
-   [Command-line Client](#command-line-client)
-   [Contributing](#contributing)
-   [Testing](#testing)
-   [License](#license)

## Background

This IoT Agent is designed to be a bridge between an MQTT/HTTP+JSON based protocol and the FIWARE NGSI standard used in
FIWARE. This project is based in the Node.js IoT Agent library. More information about the IoT Agents can be found
within the library's [GitHub repository](https://github.com/telefonicaid/iotagent-node-lib).

A quick way to get started is to read the [Step by step Manual](./docs/stepbystep.md).

As is the case in any IoT Agent, this one follows the interaction model defined in the
[Node.js IoT Agent Library](https://github.com/telefonicaid/iotagent-node-lib), that is used for the implementation of
the Northbound APIs. Information about the IoTAgent's architecture can be found on that global repository. This
documentation will only address those features and characteristics that are particular to the JSON IoTAgent.

If you want to contribute to the project, check out the [Development section](#development) and the
[Contribution guidelines](./docs/contribution.md).

Additional information about operating the component can be found in the
[Operations: logs and alarms](docs/operations.md) document.

## Install

Information about how to install the JSON IoTAgent can be found at the corresponding section of the
[Installation & Administration Guide](docs/installationguide.md).

A `Dockerfile` is also available for your use - further information can be found [here](docker/README.md)

## Usage

Information about how to use the IoT Agent can be found in the [User & Programmers Manual](docs/usermanual.md).

The following features are listed as [deprecated](docs/deprecated.md).

## API

Apiary reference for the Configuration API can be found
[here](https://telefonicaiotiotagents.docs.apiary.io/#reference/configuration-api) More information about IoT Agents and
their APIs can be found in the IoT Agent Library [documentation](https://iotagent-node-lib.readthedocs.io/).

The latest IoT Agent for JSON documentation is also available on
[ReadtheDocs](https://fiware-iotagent-json.readthedocs.io/en/latest/)

## Command-line Client

The JSON IoT Agent comes with a client that can be used to test its features, simulating a device. The client can be
executed with the following command:

```console
bin/iotaJsonTester.js
```

This will show a prompt where commands can be issued to the MQTT broker. For a list of the currently available commands
type `help`.

The client loads a global configuration used for all the commands, containing the host and port of the MQTT broker and
the API Key and Device ID of the device to simulate. This information can be changed with the `config` command.

In order to use any of the MQTT commands, you have to connect to the MQTT broker first. If no connection is available,
MQTT commands will show an error message reminding you to connect.

The command-line Client gets its default values from a config file in the root of the project: `client-config.js`. This
config file can be used to permanently tune the MQTT broker parameters, or the default device ID and APIKey.

## Contributing

If you'd like to contribute, start by searching through the issues and pull requests to see whether someone else has 
raised a similar idea or question.

Before contributing, please check out [contribution guidelines](docs/contribution.md)

## Testing

[Mocha](https://mochajs.org/) Test Runner + [Should.js](https://shouldjs.github.io/) Assertion Library.

The test environment is preconfigured to run BDD testing style.

Module mocking during testing can be done with [proxyquire](https://github.com/thlorenz/proxyquire)

To run tests, type

```console
npm test
```

#### Requirements

All the tests are designed to test end-to-end scenarios, and there are some requirements for its current execution:

-   MQTT v5 broker (like mosquitto v1.6.7 server running)
-   MongoDB v4.x server running
-   RabbitMQ

To run requirements you can type:
```
   docker run -d -p 27017:27017 --hostname mongo --name mongo mongo:4.2
   docker run -d -p 1883:1883 -l mosquitto eclipse-mosquitto:1.6.7
   docker run -d -p 5672:5672 --hostname my-rabbit --name some-rabbit rabbitmq:3.8.9
```
---

## License

The IoT Agent for JSON is licensed under [Affero General Public License (GPL) version 3](./LICENSE).

© 2022 Telefonica Investigación y Desarrollo, S.A.U

### Are there any legal issues with AGPL 3.0? Is it safe for me to use?

There is absolutely no problem in using a product licensed under AGPL 3.0. Issues with GPL (or AGPL) licenses are mostly
related with the fact that different people assign different interpretations on the meaning of the term “derivate work”
used in these licenses. Due to this, some people believe that there is a risk in just _using_ software under GPL or AGPL
licenses (even without _modifying_ it).

For the avoidance of doubt, the owners of this software licensed under an AGPL-3.0 license wish to make a clarifying
public statement as follows:

> Please note that software derived as a result of modifying the source code of this software in order to fix a bug or
> incorporate enhancements is considered a derivative work of the product. Software that merely uses or aggregates (i.e.
> links to) an otherwise unmodified version of existing software is not considered a derivative work, and therefore it
> does not need to be released as under the same license, or even released as open source.
