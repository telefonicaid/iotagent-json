# Installation & Administration Guide

## Index

* [Installation](#installation)
* [Usage](#usage)
* [Configuration](#configuration)

### Installation
There are two ways of installing the JSON IoT Agent: using Git or RPMs.

#### Using GIT
In order to install the TT Agent, just clone the project and install the dependencies:
```
git clone https://github.com/telefonicaid/iotagent-json.git
npm install
```
In order to start the IoT Agent, from the root folder of the project, type:
```
bin/iotagent-json
```

#### Using RPM
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
### Usage
In order to execute the JSON IoT Agent just execute the following command from the root folder:
```
bin/iotagentMqtt.js
```
This will start the JSON IoT Agent in the foreground. Use standard linux commands to start it in background.

When started with no arguments, the IoT Agent will expect to find a `config.js` file with the configuration in the root
folder. An argument can be passed with the path to a new configuration file (relative to the application folder) to be
used instead of the default one.

### Configuration
#### Overview
All the configuration for the IoT Agent is stored in a single configuration file (typically installed in the root folder).

This configuration file is a JavaScript file and contains three configuration chapters:
* **iota**: this object stores the configuration of the North Port of the IoT Agent, and is completely managed by the
IoT Agent library. More information about this options can be found [here](https://github.com/telefonicaid/iotagent-node-lib#configuration).
* **mqtt**: this object stores MQTT's specific configuration. A detailed description can be found in the next section.
* **http**: this object stores HTTP's specific configuration. A detailed description can be found in the next section.

There are also some global configuration options:
* **configRetrieval**: this flag indicates whether the incoming notifications to the IoTAgent should be processed
using the bidirectionality plugin from the latest versions of the library or the JSON-specific configuration retrieval
mechanism (described in the User Manual). Simultaneous use of both mechanisms is not allowed.
* **compressTimestamp**: this flags enables the timestamp compression mechanism, described in the User Manual.

#### MQTT configuration
These are the currently available MQTT configuration options:
* **host**: host of the MQTT broker.
* **port**: port where the MQTT broker is listening.
* **defaultKey**: default API Key to use when a device is provisioned without a configuration.
* **username**: user name that identifies the IOTA against the MQTT broker (optional).
* **password**: password to be used if the username is provided (optional).
* **qos**: QoS level: at most once (0), at least once (1), exactly once (2). (default is 0).
* **retain**: retain flag (default is false).

#### Configuration with environment variables
Some of the more common variables can be configured using environment variables. The ones overriding general parameters
in the `config.iota` set are described in the [IoTA Library Configuration manual](https://github.com/telefonicaid/iotagent-node-lib#configuration).

The ones relating specific Ultralight 2.0 bindings are described in the following table.

| Environment variable      | Configuration attribute             |
|:------------------------- |:----------------------------------- |
| IOTA_MQTT_HOST            | mqtt.host                           |
| IOTA_MQTT_PORT            | mqtt.port                           |
| IOTA_MQTT_USERNAME        | mqtt.username                       |
| IOTA_MQTT_PASSWORD        | mqtt.password                       |
| IOTA_MQTT_QOS             | mqtt.qos                            |
| IOTA_MQTT_RETAIN          | mqtt.retain                         |
| IOTA_HTTP_HOST            | http.host (still not in use)        |
| IOTA_HTTP_PORT            | http.port (still not in use)        |

(HTTP-related environment variables will be used in the upcoming HTTP binding)
