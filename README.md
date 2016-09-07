# iotagent-json

## Index

* [Overview](#overview)
* [Installation](#installation)
* [Usage](#usage)
* [Configuration] (#configuration)
* [Protocol](#protocol)
* [Command Line Client](#client)
* [Development documentation](#development)

## <a name="overview"/> Overview
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

## <a name="installation"/> Installation
There are two ways of installing the JSON IoT Agent: using Git or RPMs.
 
### Using GIT
In order to install the TT Agent, just clone the project and install the dependencies:
```
git clone https://github.com/telefonicaid/iotagent-json.git
npm install
```
In order to start the IoT Agent, from the root folder of the project, type:
```
bin/iotagent-json
``` 
 
### Using RPM
The project contains a script for generating an RPM that can be installed in Red Hat 6.5 compatible Linux distributions. 
The RPM depends on Node.js 0.10 version, so EPEL repositories are advisable. 

In order to create the RPM, execute the following scritp, inside the `/rpm` folder:
```
create-rpm.sh -v <versionNumber> -r <releaseNumber>
```

Once the RPM is generated, it can be installed using the followogin command:
```
yum localinstall --nogpg <nameOfTheRPM>.rpm
```

The IoTA will then be installed as a linux service, and can ve started with the `service` command as usual:
```
service iotaJSON start
```
## <a name="usage"/> Usage
In order to execute the JSON IoT Agent just execute the following command from the root folder:
```
bin/iotagentMqtt.js
```
This will start the JSON IoT Agent in the foreground. Use standard linux commands to start it in background.

When started with no arguments, the IoT Agent will expect to find a `config.js` file with the configuration in the root
folder. An argument can be passed with the path to a new configuration file (relative to the application folder) to be
used instead of the default one.

## <a name="configuration"/> Configuration
### Overview
All the configuration for the IoT Agent is stored in a single configuration file (typically installed in the root folder).

This configuration file is a JavaScript file and contains two configuration chapters:
* **iota**: this object stores the configuration of the Northbound of the IoT Agent, and is completely managed by the
IoT Agent library. More information about this options can be found [here](https://github.com/telefonicaid/iotagent-node-lib#configuration).
* **mqtt**: this object stores MQTT's specific configuration. A detailed description can be found in the next section.

### MQTT configuration
These are the currently available MQTT configuration options:
* **host**: host of the MQTT broker.
* **port**: port where the MQTT broker is listening.
* **defaultKey**: default API Key to use when a device is provisioned without a configuration.
* **username**: user name that identifies the IOTA against the MQTT broker (optional).
* **password**: password to be used if the username is provided (optional).

### Configuration with environment variables
Some of the more common variables can be configured using environment variables. The ones overriding general parameters
in the `config.iota` set are described in the [IoTA Library Configuration manual](https://github.com/telefonicaid/iotagent-node-lib#configuration).

The ones relating specific Ultralight 2.0 bindings are described in the following table.

| Environment variable      | Configuration attribute             |
|:------------------------- |:----------------------------------- |
| IOTA_MQTT_HOST            | mqtt.host                           |
| IOTA_MQTT_PORT            | mqtt.port                           |
| IOTA_MQTT_USERNAME        | mqtt.username                       |
| IOTA_MQTT_PASSWORD        | mqtt.password                       |
| IOTA_HTTP_HOST            | http.host (still not in use)        |
| IOTA_HTTP_PORT            | http.port (still not in use)        |

(HTTP-related environment variables will be used in the upcoming HTTP binding)

## <a name="protocol"/> Protocol
### Overview
The MQTT-JSON protocol uses plain JSON objects to send information formatted as key-value maps over an MQTT transport. 
It uses different topics to separate the different destinations and types of the messages (the different possible interactions
are described in the following sections).

All the topics used in the protocol are prefixed with the APIKey of the device group and the Device ID of the device
involved in the interaction; i.e.: there is a different set of topics for each service (e.g: `/FF957A98/MyDeviceId/attributes`).
The API Key is a secret identifier shared among all the devices of a service, and the DeviceID is an ID that uniquely
identifies the device in a service. API Keys can be configured with the IoTA Configuration API or the public default
API Key of the IoT Agent can be used in its stead. The Device ID must be provisioned in advance in the IoT Agent before
information is sent.

Along this document we will refer some times to "plain JSON objects" or "single-level JSON objects". With that, we mean:
* valid JSON objects serialized as unescaped strings.
* JSON objects with a single level, i.e.: all the first level attributes of the JSON object are Strings or Numbers (not
 arrays or other objects).

### HTTP Binding

#### Measure reporting
##### Payload
The payload consists of a simple plain JSON object, where each attribute of the object will be mapped to an attribute
in the NGSI entity. The value of all the attributes will be copied as a String (as all simple attribute values in
NGSIv1 are strings). E.g.:
```
{
  "h": "45%",
  "t": "23",
  "l": "1570"
}
```
The attribute names in the payload can be mapped to different attribute names in the entity, by using alias in the
device provisioning (see the [Provisioning API](https://github.com/telefonicaid/iotagent-node-lib#provisioningapi) for
details).

A device can report new measures to the IoT Platform using an HTTP POST request to the `/iot/d` path with the following
query parameters:
* **i (device ID)**: Device ID (unique for the API Key).
* **k (API Key)**: API Key for the service the device is registered on.
* **t (timestamp)**: Timestamp of the measure. Will override the automatic IoTAgent timestamp (optional).

#### Commands
When using the HTTP transport, the command handling have two flavours:

* **Push commands**: in this case, the Device **must** be provisioned with the `endpoint` attribute, that will contain
the URL where the IoT Agent will send the received commands. The request payload format will be a plain JSON, as described
in the "Payload" section. The device will reply with a 200OK response containing the result of the command in the JSON
result format.

* **Polling commands**: in this case, the Agent does not send any messages to the device, being the later responsible
of retrieving them from the IoTAgent whenever the device is ready to get commands (still not implemented).

#### Configuration retrieval
The protocol offers a mechanism for the devices to retrieve its configuration (or any other value it needs from those
stored in the Context Broker). This mechanism combines calls to the IoTA HTTP endpoint with direct calls to the provided
device endpoint.

##### Configuration commands
The IoT Agent listens in this path for configuration requests coming from the device:
```
http://<iotaURL>:<HTTP-Port>/configuration/commands
```
The messages must contain a JSON document with the following attributes:

* **type**: indicates the type of command the device is sending. See below for accepted values.
* **fields**: array with the names of the values to be retrieved from the Context Broker entity representing the device.

This command will trigger a query to the CB that will, as a result, end up with a new request to the device endpoint,
with the `configuration/values` path (described bellow).

E.g.:
```
{
  "type": "configuration",
  "fields": [
    "sleepTime",
    "warningLevel"
  ]
}
```

There are two accepted values for the configuration command types:
* `subscription`: this command will generate a subscription in the Context Broker that will be triggered whenever any of
the selected values change. In case the value has changed, all the attributes will be retrieved.
* `configuration`: this commands will generate a single request to the Context Broker from the IoTAgent, that will trigger
a single request to the device endpoint.

##### Configuration information retrieval
Every device should listen in the following path, so it can receive configuration information:
```
<device_endpoint>/configuration/values
```
Whenever the device requests any information from the IoTA, the information will be posted in this path. The information
is sent in the same format used in multiple measure reporting: a plain JSON with an attribute per value requested. An
additional parameter called `dt` is added with the system current time.

E.g.:
```
{
  "sleepTime": "200",
  "warningLevel": "80",
  "dt": "20160125T092703Z"
}
```

### MQTT Binding
#### Measure reporting

There are two ways of reporting measures:

* **Multiple measures**: In order to send multiple measures, a device can publish a JSON payload to an MQTT topic with the 
following structure:
```
/{{api-key}}/{{device-id}}/attributes
```
The message in this case must contain a valid JSON object of a single level; for each key/value pair, the key represents
the attribute name and the value the attribute value. Attribute type will be taken from the device provision information.

* **Single measures**: In order to send single measures, a device can publish the direct value to an MQTT topic with
the following structure:
```
/{{api-key}}/{{device-id}}/attributes/<attributeName>
```
Indicating in the topic the name of the attribute to be modified.

In both cases, the key is the one provisioned in the IOTA through the Configuration API, and the Device ID the ID that
was provisioned using the Provisioning API. API Key MUST be present, although can be any string in case the Device was
provisioned without a link to any particular configuration.

#### Configuration retrieval
The protocol offers a mechanism for the devices to retrieve its configuration (or any other value it needs from those
stored in the Context Broker). Two topics are created in order to support this feature: a topic for configuration
commands and a topic to receive configuration information.

##### Configuration command topic
```
/{{apikey}}/{{deviceid}}/configuration/commands
```
The IoT Agent listens in this topic for requests coming from the device. The messages must contain a JSON document
with the following attributes:

* **type**: indicates the type of command the device is sending. See below for accepted values.
* **fields**: array with the names of the values to be retrieved from the Context Broker entity representing the device.

This command will trigger a query to the CB that will, as a result, end up with a new message posted to the Configuration
information topic (described bellow).

E.g.:
```
{
  "type": "configuration",
  "fields": [
    "sleepTime",
    "warningLevel"
  ]
}
```

There are two accepted values for the configuration command types:
* `subscription`: this command will generate a subscription in the Context Broker that will be triggered whenever any of
the selected values change. In case the value has changed, all the attributes will be retrieved.
* `configuration`: this commands will generate a single request to the Context Broker from the IoTAgent, that will trigger
a single publish message in the values topic.

##### Configuration information topic
```
/{{apikey}}/{{deviceid}}/configuration/values
```
Every device must subscribe to this topic, so it can receive configuration information. Whenever the device requests any
information from the IoTA, the information will be posted in this topic. The information is published in the same format
used in multiple measure reporting: a plain JSON with an attribute per value requested. An aditional parameter called
`dt` is added with the system current time.

E.g.:
```
{
  "sleepTime": "200",
  "warningLevel": "80",
  "dt": "20160125T092703Z"
}
```

#### Commands
The IoT Agent implements IoTAgent commands, as specified in the [IoTAgent library](https://github.com/telefonicaid/iotagent-node-lib).
When a command is receivied in the IoT Agent, a message is published in the following topic:
```
/<APIKey>/<DeviceId>/cmd
```
The message payload is a plain JSON object, with an attribute per command, and the parameters of the command as the value
of that attribute.

Once the device has executed the command, the device can report the result information publishing a new mesage in the
following topic:
```
/<APIKey>/<DeviceId>/cmdexe
```

This message must contain one attribute per command to be updated; the value of that attribute is considered the result
of the command, and will be passed as it is to the corresponding `_result` attribute in the entity.

E.g.: if a user wants to send a command `PING` with parameters `data = 22` he will send the following request to the
Context Broker:
```
{
  "updateAction": "UPDATE",
  "contextElements": [
    {
      "id": "Second MQTT Device",
      "type": "AnMQTTDevice",
      "isPattern": "false",
      "attributes": [
        {
          "name": "PING",
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
If the APIKey associated to de device is `1234`, this will generate a message in the `/1234/MQTT_2/cmd` topic with the following
payload:
```
{"PING":{"data":"22"}}
```

Once the device has executed the command, it can publish its results in the `/1234/MQTT_2/cmdexe` topic with a payload with the following
format:
```
{ "PING": "1234567890" }
```

### Value conversion
The IoTA performs some ad-hoc conversion for specific types of values, in order to minimize the parsing logic in the
device. This section lists those conversions.

#### Timestamp compression
Any attribute coming to the IoTA with the "timeInstant" name will be expected to be a timestamp in ISO8601 complete basic
calendar representation (e.g.: 20071103T131805). The IoT Agent will automatically transform this values to the extended
representation (e.g.: +002007-11-03T13:18:05) for any interaction with the Context Broker (updates and queries).

### Thinking Things plugin
This IoT Agent retains some features from the Thinking Things Protocol IoT Agent to ease the transition from one protocol
to the other. This features are built in a plugin, that can be activated using the `mqtt.thinkingThingsPlugin` flag.
When the plugin is activated, the following rules apply to all the incoming MQTT-JSON requests:
* If an attribute named P1 is found, its content will be parsed as a Phone Cell position, as described [here](https://github.com/telefonicaid/iotagent-thinking-things#p1).
* If an attribute named C1 is found, its content will be parsed as if they would be a P1 attribute, but with all its
fields codified in hexadecimal with a fixed 4 character length, without comma separation.
* If an attribute named B is found, its content will be parsed as if they would be Battery information as described
[here](https://github.com/telefonicaid/iotagent-thinking-things#b). This implementation admits also an extended version
of this attribute, adding the "batteryType" and "percentage" fields to the entity.

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

##  <a name="development"/> Development documentation
### Contributions
All contributions to this project are welcome. Developers planning to contribute should follow the [Contribution Guidelines](./docs/contribution.md) 

### Project build
The project is managed using Grunt Task Runner.

For a list of available task, type
```bash
grunt --help
```

The following sections show the available options in detail.

### Testing

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

### Coding guidelines
jshint, gjslint

Uses provided .jshintrc and .gjslintrc flag files. The latter requires Python and its use can be disabled
while creating the project skeleton with grunt-init.
To check source code style, type
```bash
grunt lint
```

Checkstyle reports can be used together with Jenkins to monitor project quality metrics by means of Checkstyle
and Violations plugins.
To generate Checkstyle and JSLint reports under `report/lint/`, type
```bash
grunt lint-report
```


### Continuous testing

Support for continuous testing by modifying a src file or a test.
For continuous testing, type
```bash
grunt watch
```


### Source Code documentation
dox-foundation

Generates HTML documentation under `site/doc/`. It can be used together with jenkins by means of DocLinks plugin.
For compiling source code documentation, type
```bash
grunt doc
```


### Code Coverage
Istanbul

Analizes the code coverage of your tests.

To generate an HTML coverage report under `site/coverage/` and to print out a summary, type
```bash
# Use git-bash on Windows
grunt coverage
```

To generate a Cobertura report in `report/coverage/cobertura-coverage.xml` that can be used together with Jenkins to
monitor project quality metrics by means of Cobertura plugin, type
```bash
# Use git-bash on Windows
grunt coverage-report
```


### Code complexity
Plato

Analizes code complexity using Plato and stores the report under `site/report/`. It can be used together with jenkins
by means of DocLinks plugin.
For complexity report, type
```bash
grunt complexity
```

### PLC

Update the contributors for the project
```bash
grunt contributors
```


### Development environment

Initialize your environment with git hooks.
```bash
grunt init-dev-env 
```

We strongly suggest you to make an automatic execution of this task for every developer simply by adding the following
lines to your `package.json`
```
{
  "scripts": {
     "postinstall": "grunt init-dev-env"
  }
}
``` 


### Site generation

There is a grunt task to generate the GitHub pages of the project, publishing also coverage, complexity and JSDocs pages.
In order to initialize the GitHub pages, use:

```bash
grunt init-pages
```

This will also create a site folder under the root of your repository. This site folder is detached from your repository's
history, and associated to the gh-pages branch, created for publishing. This initialization action should be done only
once in the project history. Once the site has been initialized, publish with the following command:

```bash
grunt site
```

This command will only work after the developer has executed init-dev-env (that's the goal that will create the detached site).

This command will also launch the coverage, doc and complexity task (see in the above sections).

