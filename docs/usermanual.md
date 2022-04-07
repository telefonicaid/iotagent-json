# User & Programmers Manual

-   [API Overview](#api-overview)
    -   [HTTP binding](#http-binding)
    -   [MQTT binding](#mqtt-binding)
    -   [AMQP binding](#amqp-binding)
    -   [Value conversion](#value-conversion)
-   [Development documentation](#development-documentation)
-   [New transport development](#new-transport-development)

## API Overview

The JSON protocol uses plain JSON objects to send information formatted as key-value maps over any of the accepted
transports (HTTP, MQTT or AMQP).

Along this document we will refer some times to "plain JSON objects" or "single-level JSON objects". With that, we mean:

-   valid JSON objects serialized as unescaped strings.
-   JSON objects with a single level, i.e.: all the first level attributes of the JSON object are Strings or Numbers
    (not arrays or other objects). Eg:

```json
{
    "h": "45%",
    "t": "23",
    "l": "1570"
}
```

-   JSON arrays which elements are objects with a single level (not arrays or other objects). This corresponds to
    _multimeasures_ or _group of measures_. Each group in the JSON array is processed independently, i.e. a different
    NGSI request will be generated for each group of measures. Eg:

```json
[
    {
        "h": "45%",
        "t": "23",
        "l": "1570"
    },
    {
        "h": "47%",
        "t": "21",
        "l": "1321"
    }
]
```

**IMPORTANT NOTE**: current version of the agent only supports active attributes, i.e. those attributes actively
reported by the device to the agent. Passive or lazy attributes, i.e. those attributes whose value is only given upon
explicit request from the agent, are not implemented. Please check the issue
[#89](https://github.com/telefonicaid/iotagent-json/issues/89) for more details and updates regarding its
implementation.

### HTTP binding

HTTP binding is based on directly interfacing the agent from a HTTP client in the device. Json payloads are, therefore,
directly put into Http messages.

#### Measure reporting

The payload consists of a simple plain JSON object, where each attribute of the object will be mapped to an attribute in
the NGSI entity. E.g.:

```json
{
    "h": "45%",
    "t": "23",
    "l": { "a": 2, "b": "up", "c": ["1", "3"] }
}
```

The attribute names in the payload can be mapped to different attribute names in the entity, by using alias in the
device provisioning (see the [Provisioning API](https://github.com/telefonicaid/iotagent-node-lib#provisioningapi) for
details).

A device can report new measures to the IoT Platform using an HTTP POST request to the `/iot/json` path with the
following query parameters:

-   **i (device ID)**: Device ID (unique for the API Key).
-   **k (API Key)**: API Key for the service the device is registered on.
-   **t (timestamp)**: Timestamp of the measure. Will override the automatic IoTAgent timestamp (optional).

#### Configuration retrieval

The protocol offers a mechanism for the devices to retrieve its configuration (or any other value it needs from those
stored in the Context Broker). This mechanism combines calls to the IoTA HTTP endpoint with direct calls to the provided
device endpoint.

##### Configuration commands

The IoT Agent listens in this path for configuration requests coming from the device:

```text
http://<iotaURL>:<HTTP-Port>/configuration/commands
```

The messages must contain a JSON document with the following attributes:

-   **type**: indicates the type of command the device is sending. See below for accepted values.
-   **fields**: array with the names of the values to be retrieved from the Context Broker entity representing the
    device.

This command will trigger a query to the CB that will, as a result, end up with a new request to the device endpoint,
with the `configuration/values` path (described bellow).

E.g.:

```json
{
    "type": "configuration",
    "fields": ["sleepTime", "warningLevel"]
}
```

There are two accepted values for the configuration command types:

-   `subscription`: this command will generate a subscription in the Context Broker that will be triggered whenever any
    of the selected values change. In case the value has changed, all the attributes will be retrieved.
-   `configuration`: this commands will generate a single request to the Context Broker from the IoTAgent, that will
    trigger a single request to the device endpoint.

##### Configuration information retrieval

Every device should listen in the following path, so it can receive configuration information:

```text
<device_endpoint>/configuration/values
```

Whenever the device requests any information from the IoTA, the information will be posted in this path. The information
is sent in the same format used in multiple measure reporting: a plain JSON with an attribute per value requested. An
additional parameter called `dt` is added with the system current time.

E.g.:

```json
{
    "sleepTime": "200",
    "warningLevel": "80",
    "dt": "20160125T092703Z"
}
```

#### Commands

All the interations between IotAgent and ContextBroker related to comamnds are described in
[Theory: Scenario 3: commands](https://github.com/telefonicaid/iotagent-node-lib/blob/master/doc/northboundinteractions.md#scenario-3-commands)
and
[Practice: Scenario 3: commands - happy path](https://github.com/telefonicaid/iotagent-node-lib/blob/master/doc/northboundinteractions.md#scenario-3-commands-happy-path)
and
[Practice: Scenario 3: commands - error](https://github.com/telefonicaid/iotagent-node-lib/blob/master/doc/northboundinteractions.md#scenario-3-commands-error).

MQTT devices commands are always push. For HTTP Devices commands to be push they **must** be provisioned with the
`endpoint` attribute, that will contain the URL where the IoT Agent will send the received commands. Otherwise the
command will be poll. When using the HTTP transport, the command handling have two flavours:

-   **Push commands**: The request payload format will be a plain JSON, as described in the "Payload" section. The
    device will reply with a 200OK response containing the result of the command in the JSON result format. Example of
    the HTTP request sent by IOTA in the case of push command:

    ```
       POST http://[DEVICE_IP]:[PORT]
       fiware-service: smart
       fiware-servicepath: /streetligths
       content-type: application/json

       {
          "turn": "left"
       }
    ```

    And an example of the response sent by device to IOTA could be:

    ```json
    {
        "turn": "turn to left was right"
    }
    ```

-   **Polling commands**: These commands are meant to be used on those cases where the device can't be online the whole
    time waiting for commands. In this case, the IoTAgents must store the received commands, offering a way for the
    device to retrieve the pending commands upon connection. Whenever the device is ready, it itself retrieves the
    commands from the IoT agent. While sending a normal measure, the device sends query parameter 'getCmd' with value
    '1' in order to retrieve the commands from IoT Agent. The IoT Agent responds with a list of commands available for
    that device which are send in a JSON format. The attributes in the response body represents the commands and the
    values represents command values. The use of a JSON return object implies that only one value can be returned for
    each command (last value will be returned for each one). Implementation imposes another limitation in the available
    values for the commands: a command value can't be an empty string, or a string composed exclusively by whitespaces.
    The command payload is described in the protocol section. Whenever the device has completed the execution of the
    command, it will send the response in the same way measurements are reported, but using the command result format as
    exposed in the [commands syntax section](#commands-syntax) (**FIXME**: this section has to be created, see how it's
    done in IOTA-UL).

Some additional remarks regarding polling commands:

-   Commands can be also retrieved without needed of sending a mesaure. In other words, the device is not forced to send
    a measure in order to get the accumulated commands. However, in this case note that `GET` method is used to carry
    the `getCmd=1` query parameter (as they are no actual payload for measures, `POST` wouldn't make too much sense).

    Example to retrieve commands from IoT Agent:

```text
curl -X GET 'http://localhost:7896/iot/json?i=motion001&k=4jggokgpepnvsb2uv4s40d59ov&getCmd=1' -i
```

-   Example of the HTTP response sent by IOTA in the case of polling commands (and two commands, `turn` and `move` are
    stored for that device):

```
200 OK
Content-type: application/json

{
  "turn": "left",
  "move": 20
}
```

### MQTT binding

MQTT binding is based on the existence of a MQTT broker and the usage of different topics to separate the different
destinations and types of the messages (the different possible interactions are described in the following sections).

All the topics subscribed by the agent (to send measures, to configuration command retrieval or to get result of a
command) are prefixed with the agent procotol, /json in this case, followed by APIKey of the device group and the Device
ID of the device involved in the interaction; i.e.: there is a different set of topics for each service (e.g:
`/json/FF957A98/MyDeviceId/attrs`). The API Key is a secret identifier shared among all the devices of a service, and
the DeviceID is an ID that uniquely identifies the device in a service. API Keys can be configured with the IoTA
Configuration API or the public default API Key of the IoT Agent can be used in its stead. The Device ID must be
provisioned in advance in the IoT Agent before information is sent. All topis published by the agent (to send a comamnd
or to send configuration information) to a device are not prefixed by the protocol, in this case '/json', just include
apikey and deviceid (e.g: `/FF957A98/MyDeviceId/cmd` and `/FF957A98/MyDeviceId/configuration/values` ).

#### Measure reporting

There are two ways of reporting measures:

-   **Multiple measures**: In order to send multiple measures, a device can publish a JSON payload to an MQTT topic with
    the following structure:

```text
/json/{{api-key}}/{{device-id}}/attrs
```

The message in this case must contain a valid JSON object of a single level; for each key-value pair, the key represents
the attribute name and the value the attribute value. Attribute type will be taken from the device provision
information.

For instance, if using [Mosquitto](https://mosquitto.org/) with a device with ID `id_sen1`, API Key `ABCDEF` and
attribute IDs `h` and `t`, then all measures (humidity and temperature) are reported this way:

```bash
$ mosquitto_pub -t /json/ABCDEF/id_sen1/attrs -m '{"h": 70, "t": 15}' -h <mosquitto_broker> -p <mosquitto_port> -u <user> -P <password>
```

-   **Single measures**: In order to send single measures, a device can publish the direct value to an MQTT topic with
    the following structure:

```text
/json/{{api-key}}/{{device-id}}/attrs/<attributeName>
```

Indicating in the topic the name of the attribute to be modified.

In both cases, the key is the one provisioned in the IoT Agent through the Configuration API, and the Device ID the ID
that was provisioned using the Provisioning API. API Key **must** be present, although can be any string in case the
Device was provisioned without a link to any particular configuration.

For instance, if using [Mosquitto](https://mosquitto.org/) with a device with ID `id_sen1`, API Key `ABCDEF` and
attribute IDs `h` and `t`, then humidity measures are reported this way:

```bash
$ mosquitto_pub -t /json/ABCDEF/id_sen1/attrs/h -m 70 -h <mosquitto_broker> -p <mosquitto_port> -u <user> -P <password>
```

#### Configuration retrieval

The protocol offers a mechanism for the devices to retrieve its configuration (or any other value it needs from those
stored in the Context Broker). Two topics are created in order to support this feature: a topic for configuration
commands and a topic to receive configuration information. This mechanism can be enabled or disabled using a
configuration flag, `configRetrieval`.

In case of MQTT to retrieve configuration parameters from the Context Broker, it is required that the device should be
provisioned using "MQTT" as transport key. By default it will be considered "HTTP" as transport.

The parameter will be given as follows:

`"transport": "MQTT"`

This mechanism and the bidirectionality plugin cannot be simultaneously activated.

##### Configuration command topic

```text
/json/{{apikey}}/{{deviceid}}/configuration/commands
```

The IoT Agent listens in this topic for requests coming from the device. The messages must contain a JSON document with
the following attributes:

-   **type**: indicates the type of command the device is sending. See below for accepted values.
-   **fields**: array with the names of the values to be retrieved from the Context Broker entity representing the
    device.

This command will trigger a query to the CB that will, as a result, end up with a new message posted to the
Configuration information topic (described bellow).

E.g.:

```json
{
    "type": "configuration",
    "fields": ["sleepTime", "warningLevel"]
}
```

There are two accepted values for the configuration command types:

-   `subscription`: this command will generate a subscription in the Context Broker that will be triggered whenever any
    of the selected values change. In case the value has changed, all the attributes will be retrieved.
-   `configuration`: this commands will generate a single request to the Context Broker from the IoTAgent, that will
    trigger a single publish message in the values topic.

##### Configuration information topic

```text
/{{apikey}}/{{deviceid}}/configuration/values
```

Every device must subscribe to this topic, so it can receive configuration information. Whenever the device requests any
information from the IoTA, the information will be posted in this topic. The information is published in the same format
used in multiple measure reporting: a plain JSON with an attribute per value requested. An aditional parameter called
`dt` is added with the system current time.

E.g.:

```json
{
    "sleepTime": "200",
    "warningLevel": "80",
    "dt": "20160125T092703Z"
}
```

#### Commands

All the interations between IotAgent and ContextBroker related to comamnds are described in
[Theory: Scenario 3: commands](https://github.com/telefonicaid/iotagent-node-lib/blob/master/doc/northboundinteractions.md#scenario-3-commands)
and
[Practice: Scenario 3: commands - happy path](https://github.com/telefonicaid/iotagent-node-lib/blob/master/doc/northboundinteractions.md#scenario-3-commands-happy-path)
and
[Practice: Scenario 3: commands - error](https://github.com/telefonicaid/iotagent-node-lib/blob/master/doc/northboundinteractions.md#scenario-3-commands-error).

Commands using the MQTT transport protocol binding always work in PUSH mode: the server publishes a message in a topic
where the device is subscribed: the _commands topic_. Once the device has finished with the command, it publishes it
result to another topic.

When a command is receivied in the IoT Agent, a message is published in the following topic:

```text
/<APIKey>/<DeviceId>/cmd
```

The message payload is a plain JSON object, with an attribute per command, and the parameters of the command as the
value of that attribute.

Once the device has executed the command, the device can report the result information publishing a new mesage in the
following topic:

```text
/json/<APIKey>/<DeviceId>/cmdexe
```

This message must contain one attribute per command to be updated; the value of that attribute is considered the result
of the command, and will be passed as it is to the corresponding `_info` attribute (of type `commandResult`) in the
entity.

For instance, if a user wants to send a command `ping` with parameters `data = 22`, he will send the following request
to the Context Broker regarding an entity called `sen1` of type `sensor`:

```json
{
    "updateAction": "UPDATE",
    "contextElements": [
        {
            "id": "sen1",
            "type": "sensor",
            "isPattern": "false",
            "attributes": [
                {
                    "name": "ping",
                    "type": "command",
                    "value": {
                        "data": "22"
                    }
                }
            ]
        }
    ]
}
```

If the API key associated to de device is `ABCDEF`, and the device ID related to `sen1` entity is `id_sen1`, this will
generate a message in the `/ABCDEF/id_sen1/cmd` topic with the following payload:

```json
{ "ping": { "data": "22" } }
```

If using [Mosquitto](https://mosquitto.org/), such a command is received by running the `mosquitto_sub` script:

```bash
$ mosquitto_sub -v -t /# -h <mosquitto_broker> -p <mosquitto_port> -u <user> -P <password> /ABCDEF/id_sen1/cmd {"ping":{"data":"22"}}
```

At this point, Context Broker will have updated the value of `ping_status` to `PENDING` for `sen1` entity. Neither
`ping_info` nor `ping` are updated.

Once the device has executed the command, it can publish its results in the `/json/ABCDEF/id_sen1/cmdexe` topic with a
payload with the following format:

```json
{ "ping": "1234567890" }
```

If using [Mosquitto](https://mosquitto.org/), such command result is sent by running the `mosquitto_pub` script:

```bash
$ mosquitto_pub -t /json/ABCDEF/id_sen1/cmdexe -m '{"ping": "1234567890"}' -h <mosquitto_broker> -p <mosquitto_port> -u <user> -P <password>
```

In the end, Context Broker will have updated the values of `ping_info` and `ping_status` to `1234567890` and `OK`,
respectively. `ping` attribute is never updated.

Some additional remarks regarding MQTT commands:

-   MQTT devices can configure (at provisioning and updating time) each command with different values of MQTT QoS and
    MQTT retain values, which will be used only by a command. Moreover, in the same MQTT device different commands can
    be configured to use different MQTT options related with QoS level and Retain message policy. I.E:

```json
{
    "commands": [
        {
            "type": "command",
            "name": "a_command_name_A",
            "mqtt": { "qos": 2, "retain": true }
        },
        {
            "type": "command",
            "name": "a_command_name_B",
            "mqtt": { "qos": 1, "retain": false }
        }
    ]
}
```

#### Bidirectionality Syntax

The latest versions of the Provisioning API allow for the definition of reverse expressions to keep data shared between
the Context Broker and the device in sync (regardless of whether the data originated in plain data from the device or in
a transformation expression in the IoTAgent). In this cases, when a reverse expression is defined, whenever the
bidirectional attribute is modified, the IoTAgent sends a command to the original device, with the name defined in the
reverse expression attribute and the ID of the device (see Commands Syntax, just above).

#### Commands transformations

It is possible to use expressions to transform commands, in the same way that other attributes could do it, that is
adding `expression` to command definition. This way a command could be defined like:

```json
{
    "name": "reset",
    "type": "command",
    "expression": "{ set: 0}"
}
```

and when command will be executed the command value will be the result of apply value to defined expression. Following
the example case the command will be:

```json
{
    "set": 0
}
```

Additionally a command could define a `payloadType` in their definition with the aim to transform payload command with
the following meanings:

-   **binaryfromstring**: Payload will transformed into a be Buffer after read it from a string.
-   **binaryfromhex**: Payload will transformed into a be Buffer after read it from a string hex.
-   **binaryfromjson**: Payload will transformed into a be Buffer after read it from a JSON string.
-   **json**: This is the default case. Payload will be stringify from a JSON.

Moreover a command could define a `contentType` in their definnition with the aim to set `content-type` header for http
transport in command. Default value will be `application/json` but other valids content-type could be: `text/plain`,
`text/html`, etc

#### AMQP binding

[AMQP](https://www.amqp.org/) stands for Advance Message Queuing Protocol, and is one of the most popular protocols for
message-queue systems. Although the protocol itself is software independent and allows for a great architectural
flexibility, this transport binding has been designed to work with the [RabbitMQ](https://www.rabbitmq.com/) broker, in
a way that closely resembles the MQTT binding (in the previous section). In fact, for IoT Platform deployments in need
of an scalable MQTT Broker, RabbitMQ with the MQTT plugin will be used, connecting the IoT Agent to RabbitMQ through
AMQP and the clients to RabbitMQ through MQTT.

The binding connects the IoT Agent to an exchange (usually `amq.topic`) and creates two queues (to share between all the
instances of the IoTAgents in a cluster environment): one for the incoming measures, and another for command result
update messages (named as the measure one, adding the `_commands` sufix).

For both measure reporting and command update status the mechanism is much the same as in the case of the MQTT binding:
all the messages must be published to the selected exchange, using the following routing keys:

| Key pattern                           | Meaning                    |
| ------------------------------------- | -------------------------- |
| .<apiKey>.<deviceId>.attrs            | Multiple measure reporting |
| .<apiKey>.<deviceId>.attrs.<attrName> | Single measure reporting   |
| .<apiKey>.<deviceId>.cmd              | Command reception          |
| .<apiKey>.<deviceId>.cmdexe           | Command update message     |

The payload is the same as for the other bindings.

### Value conversion

The IoTA may perform some ad-hoc conversion for specific types of values, in order to minimize the parsing logic in the
device. This section lists those conversions.

#### Timestamp compression

Any attribute coming to the IoTA with the "timeInstant" name will be expected to be a timestamp in ISO8601 complete
basic calendar representation (e.g.: 20071103T131805). The IoT Agent will automatically transform this values to the
extended representation (e.g.: +002007-11-03T13:18:05) for any interaction with the Context Broker (updates and
queries).

This feature can be enabled and disabled by using the `compressTimestamp` configuration flag.

## Development documentation

### Contributions

All contributions to this project are welcome. Developers planning to contribute should follow the
[Contribution Guidelines](contribution.md)

### Project build

The project is managed using npm.

For a list of available task, type

```bash
npm run
```

The following sections show the available options in detail.

### Start

Runs a local version of the IoT Agent

```bash
# Use git-bash on Windows
npm start
```

### Testing

[Mocha](https://mochajs.org/) Test Runner + [Should.js](https://shouldjs.github.io/) Assertion Library.

The test environment is preconfigured to run BDD testing style.

Module mocking during testing can be done with [proxyquire](https://github.com/thlorenz/proxyquire)

To run tests, type

```bash
docker run -d -p 27017:27017 mongo:4.2
docker run -d -p 5672:5672 rabbitmq:3.8.9
docker run -d -p 1883:1883 eclipse-mosquitto:1.6.7

npm test
```

### Coding guidelines

ESLint

Uses the provided `.eslintrc.json` flag file. To check source code style, type

```bash
npm run lint
```

### Continuous testing

Support for continuous testing by modifying a src file or a test. For continuous testing, type

```bash
npm run test:watch
```

If you want to continuously check also source code style, use instead:

```bash
npm run watch
```

### Code Coverage

Istanbul

Analizes the code coverage of your tests.

To generate an HTML coverage report under `site/coverage/` and to print out a summary, type

```bash
# Use git-bash on Windows
npm run test:coverage
```

### Documentation guidelines

remark

To check consistency of the Markdown markup, type

```bash
npm run lint:md
```

textlint

Uses the provided `.textlintrc` flag file. To check for spelling and grammar errors, dead links and keyword consistency,
type

```bash
npm run lint:text
```

### Clean

Removes `node_modules` and `coverage` folders, and `package-lock.json` file so that a fresh copy of the project is
restored.

```bash
# Use git-bash on Windows
npm run clean
```

### Prettify Code

Runs the [prettier](https://prettier.io) code formatter to ensure consistent code style (whitespacing, parameter
placement and breakup of long lines etc.) within the codebase. Uses the `prettierrc.json` flag file. The codebase also
offers an `.editorconfig` to maintain consistent coding styles across multiple IDEs.

```bash
# Use git-bash on Windows
npm run prettier
```

To ensure consistent Markdown formatting run the following:

```bash
# Use git-bash on Windows
npm run prettier:text
```

## New transport development

### Overview

This IoT Agent is prepared to serve its protocol (Plain JSON) over multiple transport protocols (MQTT, HTTP...), sharing
most of the code betweend the different protocols. To do so, all the transport-specific code is encapsulated in a series
of plugins, added to the `./bindings/` folder. Each plugin must consist of a single Node.js module with the API defined
in the section below. The IoTA scans this full directory upon start, so there is no need to register new modules (a
simple restart should be enough).

In order to distinguish which device uses which attribute, a new field, `transport`, will be added to the device
provisioning. When a command or a notification arrives to the IoTAgent, this field is read to guess what plugin to
invoke in order to execute the requested task. If the field is not found, the value of the configuration parameter
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

-   **apiKey**: API Key of the device that is requesting the information.
-   **deviceId**: Device ID of the device that is requesting the information.
-   **results**: Array containing the results of the query to the Context Broker.

#### function executeCommand(apiKey, device, serializedPayload, callback)

##### Description

Execute a command in a remote device with the specified payload.

##### Parameters

-   **apiKey**: API Key of the device that is requesting the information.
-   **device**: Object containing all the data of the device that is requesting the information.
-   **serializedPayload**: String serialization of the command identification and parameters that is going to be send
    using the transport protocol.

#### protocol

The `protocol` attribute is a single constant string attribute that will be used to identify the transport for a certain
device. This parameter is mainly used when a command or notification comes to the IoT Agent, as the device itself is in
charge of selecting its endpoint for incoming active measures or actions. The value of the `protocol` attribute for a
binding must match the `transport` field in the provisioning of each device that will be using the IoTA.
