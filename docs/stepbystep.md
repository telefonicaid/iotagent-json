Step by Step guide
==================

## Introduction

This guide will show, step-by-step, how to deploy and configure an MQTT-JSON IoT Agent for its use to connect devices
to an external NGSI Broker (aka Context Broker).

The MQTT-JSON IoT Agent acts as a gateway for communicating devices using the MQTT protocol with NGSI brokers (or any
other piece which uses the NGSI protocol). The communication is based on a series of unidirectionsl MQTT topics 
(i.e.: each topic is used to *publish* device information or to *subscribe* to entity updates, but not both). Every
topic has the same prefix, of the form:
```
/<apiKey>/<deviceId>/topicSpecificPart
```

Where `apiKey` is an alfanumerical string used to group devices logically (and for security matters) and `deviceId` is
an ID that uniquely identifies the device. The API Key can be configured globally for an instance of the IoT Agent, or
specifically for a given group of devices (as will be explained in the following sections). 

A detailed specification of the protocol can be found [here](../README#protocol).

This guide will give a step-by-step example for the most common scenarios of use of the agent, from the IoT Agent
setup to the measure reporting (both for the case where individual devices are provisioned and the case where a group
of devices with a new API Key is provisioned first). Please, make sure you fulfill all the requirements from the next
section before starting the guides.

Before we start the tutorial we need some information about the service we are going to deploy. We will use the following
data, simulating a Smart Home application:

* *Service*: myhome
* *Subservice*: /environment
* *DevId*: sensor01, sensor02 and actuator01

## Prerequisites
This step-by-step guide assumes you are going to install all the software in a single machine, with a Red Hat 6.5 
Linux installation. As such, it may not be an appropriate architecture for production purposes, but it should
serve as a development machine to test the MQTT IoT Agent. All the commands are meant to be executed from the same
machine (even curls and mosquitto-pub commands), but changing them to execute them from an external machine should be
a trivial task.

The selected MQTT Broker for this tutorial was Mosquitto, although it could be substituted by any other standard 
MQTT broker. The Mosquitto command tools will also be used along this guide to test the installation and show the
information interchanged between simulated devices and the Context Broker.

The following list shows the prerequisite software and versions:

* Orion Context Broker (v0.26)
* Node.js (v0.12.0)
* Mosquitto (v1.4.7)
* Curl (v7.19.7)
* Git (v1.7.1)

These are the versions that were used while writing this tutorial, but any version above the ones given here should
work as well (previous versions could also work, but also may not, so we encourage you to use versions aboveg).

To enhance readability all the commands will be executed as root. To use other users, give it the appropriate permissions
and use `sudo` as usual (installation from the RPM package creates a special user for the agent, but it will not be
used along this tutorial).
 
## Provisioning a single device with the default API Key

### Installing the IoT Agent
There are different ways to install the IoT Agent. In this tutorial, we will clone the last version of the agent from 
the repository. For different setups, check the installation guide in the main `README.md` file.
 
We will install our IoT Agent in the '/opt'  repository. To do so, go to the folder and clone the repository with the
following commands:
```
cd /opt
git clone https://github.com/telefonicaid/iotagent-mqtt.git
```

Now the repository has been cloned, enter the new directory and install the dependencies, with the following commands:
```
cd /opt/iotagent-mqtt
npm install
```

Now, run the agent in the background executing:
```
nohup bin/iotagentMqtt.js &> /var/log/iotAgent&
```

The agent should be now listening in the northbound port (defaults to 4041). Check it with a netstat command:
```
netstat -ntpl | grep 4041
```

You should see an output like this:
```
tcp        0      0 0.0.0.0:4041                0.0.0.0:*                   LISTEN      18388/node 
```

An easy way to see everything is working is to get the version from the north bound API:
```
curl http://localhost:4041/iot/about
```

The result will be a JSON document indicating the MQTT-JSON IoTA version and the version of the IoTA Library in use:
```
{
  "libVersion":"0.9.5",
  "port":4041,
  "baseRoot":"/",
  "version":"0.1.5"
}
```

You can also check the logs in the `/var/log/iotAgent` file created with the nohup command.

### IoT Agent configuration

All the configuration of the IoTAgent can be done modifying a single file, `config.js`. The default values should meet
the needs of this tutorial. 

For a detailed description of this values, check the [configuration documentation](../README.md#configuration).

There is a configuration value that you may want to change while following this tutorial, and that's the `logLevel`. If
you have any problems following the instructions, or you simply want to know more of what's going on in the IoTA internals,
set its value to `DEBUG`.

Also note that the configuration type of the `deviceRegistry` is set to `memory`. This means all the contents of the 
Device Registry will be wiped out from memory when the IoTAgent restarts. This is meant to be used in testing environments
and it will force you to provision again all your devices once you have restarted the agent. For persistent registries,
check the documentation to see how to connect the IoTA to a MongoDB instance.

### Using the command-line clients

The IoT Agent comes with a command-line client that can be used for an initial testing of the installation. This client
offers commands to simulate MQTT requests with measures, device and configuration provisioning requests and NGSI queries
to the Context Broker, that can be used to test the results. 

In order to start the command line client, just type:
```
bin/iotaMqttTester.js
```

You can type `help` for a brief description of the full list of commands.

Mosquitto also comes along with two command-line utilities that can be used to test the MQTT south-bound of the IoTA. 

Mosquitto-sub can be used to subscribe to a certain topic, showing all the information sent to the topic in the console
output. To subscribe to a topic, use:
```
mosquitto_sub -h <mosquittoIp> -t /<apiKey>/<devId>/attributes
```

Where <mosquittoIp> is the IP where your instance of the Mosquitto broker is listening and <apiKey> and <devId> depende 
on the device you are using. You can omit the `-h` parameter if working on localhost.

Mosquitto-pub can be used to send information to a topic. This will be a typical execution example:
```
mosquitto_pub -h <mosquittoIp> -t /<apiKey>/<devId>/attributes -m '{"L":4,"T": "31.5","H":30}'
```

If you execute both commands in different windows, when you run the latter command, you should see the string `{"L":4,"T": "31.5","H":30}`
appearing in the former.

This tutorial will use mainly the mosquitto clients and curl commands, to give a detailed view of how the APIs (both 
northbound and southbound work). Whenever a command is needed, the exact command to be executed will be given.

### Provisioning the device

In order to start using the IoTA, a new device must be provisioned. We will use curl commands to create it. Execute the
following command:
```
curl -X POST -H "Fiware-Service: myHome" -H "Fiware-ServicePath: /environment" -H "Content-Type: application/json" -H "Cache-Control: no-cache" -d '{ 
    "devices": [ 
        { 
            "device_id": "sensor01", 
            "entity_name": "LivingRoomSensor", 
            "entity_type": "multiSensor", 
            "attributes": [ 
                  { "object_id": "t", "name": "Temperature", "type": "celsius" },
                  { "object_id": "l", "name": "Luminosity", "type": "lumens" }                  
            ]
        }
    ]
}

' 'http://localhost:4041/iot/devices'
```
This command will create the simplest kind of device, with just two declared active attributes: Temperature and Luminosity.

We have not created a specific configuration for our devices yet, so *the API Key will be the default one* for the IoTA 
(i.e.: 1234). This default API Key can be changed in the config file.

### Sending measures with the device

Now we can simulate some measures from the device. Since our device has DeviceID `sensor01` and the API Key we are using
is the default one, `1234`, we can send a measure with the mosquitto command line client using the following command:
```
mosquitto_pub -t /1234/sensor01/attributes -m '{"l":4,"t": "31.5"}'
```

This command should publish all the information in the Context Broker. A queryContext operation over the device entity
should give us the published information:
```
curl -X POST -H "Content-Type: application/json" -H "Accept: application/json" -H "Fiware-Service: myHome" -H "Fiware-ServicePath: /environment" -d '{
    "entities": [
        {
            "isPattern": "false",
            "id": "LivingRoomSensor",
            "type": "multiSensor"
        }
    ]
}' 'http://localhost:1026/NGSI10/queryContext'
```

The resulting response should look like the following:
```
{
  "contextResponses" : [
    {
      "contextElement" : {
        "type" : "multiSensor",
        "isPattern" : "false",
        "id" : "LivingRoomSensor",
        "attributes" : [
          {
            "name" : "Luminosity",
            "type" : "lumens",
            "value" : "4"
          },
          {
            "name" : "Temperature",
            "type" : "celsius",
            "value" : "31.5"
          }
        ]
      },
      "statusCode" : {
        "code" : "200",
        "reasonPhrase" : "OK"
      }
    }
  ]
}
```

### Retrieving configuration parameters from the Context Broker


## Provisioning multiple devices with a Configuration


### Provisioning the configuration


### Provisioning the device


### Sending measures
