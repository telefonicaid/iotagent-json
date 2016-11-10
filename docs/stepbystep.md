Step by Step guide
==================

## Index

* [Introduction](#introduction)
* [Provisioning a single device with the default API Key](#singledevice)
* [Provisioning multiple devices with a Configuration](#withconfiguration)
* [Using ACLs to secure provisioning access](#acls)

## <a name="introduction"/> Introduction

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

### Prerequisites
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
* Mosquitto (v1.4.7) (out-of-the-box setup)
* Curl (v7.19.7)
* Git (v1.7.1)

These are the versions that were used while writing this tutorial, but any version above the ones given here should
work as well (previous versions could also work, but also may not, so we encourage you to use versions aboveg).

To enhance readability all the commands will be executed as root. To use other users, give it the appropriate permissions
and use `sudo` as usual (installation from the RPM package creates a special user for the agent, but it will not be
used along this tutorial).
 
## <a name="singledevice"/> Provisioning a single device with the default API Key

### Installing the IoT Agent
There are different ways to install the IoT Agent. In this tutorial, we will clone the last version of the agent from 
the repository. For different setups, check the installation guide in the main `README.md` file.
 
We will install our IoT Agent in the '/opt'  repository. To do so, go to the folder and clone the repository with the
following commands:
```
cd /opt
git clone https://github.com/telefonicaid/iotagent-json.git
```

Now the repository has been cloned, enter the new directory and install the dependencies, with the following commands:
```
cd iotagent-json
npm install
```

Now, run the agent in the background executing:
```
nohup bin/iotagent-json &> /var/log/iotAgent&
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
bin/iotaJsonTester.js
```

You can type `help` for a brief description of the full list of commands.

Mosquitto also comes along with two command-line utilities that can be used to test the MQTT south-bound of the IoTA. 

Mosquitto-sub can be used to subscribe to a certain topic, showing all the information sent to the topic in the console
output. To subscribe to a topic, use:
```
mosquitto_sub -h <mosquittoIp> -t /<apiKey>/<devId>/attrs
```

Where <mosquittoIp> is the IP where your instance of the Mosquitto broker is listening and <apiKey> and <devId> depende 
on the device you are using. You can omit the `-h` parameter if working on localhost.

Mosquitto-pub can be used to send information to a topic. This will be a typical execution example:
```
mosquitto_pub -h <mosquittoIp> -t /<apiKey>/<devId>/attrs -m '{"L":4,"T": "31.5","H":30}'
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
mosquitto_pub -t /1234/sensor01/attrs -m '{"l":4,"t": "31.5"}'
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

The MQTT-JSON IoT Agent offers a special mechanism to retrieve information from the device entity, for device configuration
purposes. This mechanism is based on two special topics, with suffix `/configuration/commands` and `/configuration/values`.

In order to test this functionality, we will, first of all, add some configuration attributes to the Context Broker entity
representing the device. We will add the `sleepTime` attribute with the following NGSI request:
```
curl -X POST -H "Content-Type: application/json" -H "Accept: application/json" -H "Fiware-Service: myHome" -H "Fiware-ServicePath: /environment" -H "Cache-Control: no-cache" -d '{
"value" : "300"
}' 'http://localhost:1026/v1/contextEntities/LivingRoomSensor/attrs/sleepTime'
```

When the IoTAgent is asked for configuration values, it will ask the Context Broker for those values. Once it has collected
them, it will send them to the device in the topic with suffix '/configuration/values'. To check this operation with our 
simulated device, execute the following line:
```
mosquitto_sub -t /1234/sensor01/configuration/values
```

Leave this command in a sepparate window while you execute the following steps.

Now we can ask the IoT Agent for the attribute value sending an MQTT request like the following one:
```
mosquitto_pub -t /1234/sensor01/configuration/commands -m '{ "type": "configuration", "fields": [ "sleepTime" ] }'
```

If we return now to the subscription window, we should be able to see the value of the `sleepTime` command:
```
{"sleepTime":"300","dt":"20160209T111442Z"}
```

Along with all the information requested by the device, the IoTAgent will report the server time in the `dt` field of
the response.

## <a name="withconfiguration"/>  Provisioning multiple devices with a Configuration

In those cases where a group of devices with similar characteristics will be provisioned, a common configuration can be
created for them. This configuration provision can be used to separate device messages between services, by 
establishing a specific API Key for each group. This can be used to secure access for specific groups of devices (an 
example of how to do that will be shown in the last section for the Mosquitto MQTT broker).

### Provisioning the configuration

First of all, we will provision a new configuration with the data we defined in the introduction section. In order to do
that, we will issue the following command:

```
curl -X POST -H "Fiware-Service: myHome" -H "Fiware-ServicePath: /environment" -H "Content-Type: application/json" -H "Cache-Control: no-cache" -d '{ 
    "services": [ 
      {
          "resource": "",
          "apikey": "AAFF9977",
          "type": "potSensor"
      }
    ]
}

' 'http://localhost:4041/iot/services'
```

This will make devices provisioned for that service, subservice and type use the provided APIKey as its APIKey prefix
in the MQTT topics. As you can see, the `resource` field is left blank (this IoT Agent doesn't make use of this field, 
but it's a mandatory attribute in the API, so it should always be sent with the empty string).

### Provisioning the device

For IoT Agents that support automatic device provisioning, provisioning a configuration is enough to start using devices
that use that configuration. For those who don't, each specific device must be provisioned, in order to save its deviceID
in the Device Registry. The provision of the device is quite similar to the one of the single device:

```
curl -X POST -H "Fiware-Service: myHome" -H "Fiware-ServicePath: /environment" -H "Content-Type: application/json" -H "Cache-Control: no-cache" -d '{ 
    "devices": [ 
        { 
            "device_id": "sensor02", 
            "entity_name": "RosesPot", 
            "entity_type": "potSensor",
            "attributes": [
              {
                "name": "humidity",
                "type": "degrees"
              },
              {
                "name": "happyness",
                "type": "subjective"
              }
            ]
        }
    ]
}

' 'http://localhost:4041/iot/devices'
```

### Sending measures

Now we can simulate a measure as in the case of the single device provision. Use the following command to send a new
simulated measure:
```
mosquitto_pub -t /AAFF9977/sensor02/attrs -m '{"humidity": 76,"happyness": "Not bad"}'
```

Note in this case the APIKey is not the default one, but the one we defined in the Configuration API.

We can check everything went OK calling the Context Broker again:
```
curl -X POST -H "Content-Type: application/json" -H "Accept: application/json" -H "Fiware-Service: myHome" -H "Fiware-ServicePath: /environment" -d '{
    "entities": [
        {
            "isPattern": "false",
            "id": "RosesPot",
            "type": "potSensor"
        }
    ]
}' 'http://localhost:1026/NGSI10/queryContext'
```

We will get something like this:
```
{
  "contextResponses" : [
    {
      "contextElement" : {
        "type" : "potSensor",
        "isPattern" : "false",
        "id" : "RosesPot",
        "attributes" : [
          {
            "name" : "happyness",
            "type" : "subjective",
            "value" : "Not bad"
          },
          {
            "name" : "humidity",
            "type" : "degrees",
            "value" : "76"
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

That shows the information we sent with the measures has been written to the Context Broker properly.

## <a name="acls"/> Using ACLs to secure provisioning access

### Overview
The use of special APIKeys gives the IoTAgent administrator the opportunity to set different MQTT-Broker level permissions
for each group of devices, using different authorization mechanisms to sepparate access between groups. 

With the plain out-of-the-box Mosquitto setup, any device (any MQTT client, in fact) can send information impersonating 
other devices or read the information in their entities, just knowing their API-Key and deviceId. To avoid this problem, 
we will create an ACL that will give special permissions for our Configuration, and a set of credentials for the devices 
of the group (that should be secretly shared with the devices). To make it simple, we will use a set of user and password
credentials, the same for all the devices of the group (other means of authentication could have been used instead, as
certificates, check Mosquitto documentation for other options).

The same problem of device impersonation can occur in the case of the IoTA access (as the IoTA is other MQTT client,
anonymous by default). To protect the interactions for the IoTA, another user will be created.

### Configuration

In order to create the users, we will use the password tool provided by mosquitto. Execute the following commands:
```
touch /etc/mosquitto/pwfile
mosquitto_passwd -b /etc/mosquitto/pwfile iota iota
mosquitto_passwd -b /etc/mosquitto/pwfile potteduser pottedpass
```

This will create two sets of credentials (login/password): iota/iota and potteduser/pottedpass.

The permissions for different topics can be given with ACL files. To create one, just create a new `/etc/mosquitto/aclfile` 
file with the following contents:
```
topic read $SYS/#

topic write /1234/+/attrs
topic write /1234/+/attrs/#
topic write /1234/+/configuration/commands
topic read /1234/+/configuration/values

user iota
topic /#

user potteduser
topic write /AAFF9977/+/attrs
topic write /AAFF9977/+/attrs/#
topic write /AAFF9977/+/configuration/commands
topic read /AAFF9977/+/configuration/values

pattern write $SYS/broker/connection/%c/state
```

There are three sections of interest in this file:

* In the first section, a set of topics is defined for the default APIKey (`1234` in this case). This topics are marked
 with write or read depending on the action devices wil do with that topic. Access for actions other than the ones defined
 as well as publishing to a read topic or viceversa is forbidden. This ensures no device will be able to impersonate the
 IoT Agent, but this doesn't forbid one device impersonating others. This access is anonymous.

* An authenticated `iota` user can access everything, as it is supposed to be the owner of the broker (and just administrators
should have access to this user). 

* For the `potteduser` account, the permissions are similar to those of the anonymous devices, but with a different APIKey
 as the prefix. This ensures that no device coming from other group (that is supposed not to have valid credentials as
 `potteduser`) will impersonate a device of the gorup, or subscribe to information sent by the group devices.
 
There are two more changes needed before we restart our test. First of all, we should add the IoTA Mosquitto credentials
to the IoTA Configuration, to give it full access to the MQTT Broker topics. To do so, edit the `/opt/iotajson/config.js`
 file and change the `config.mqtt` section to look like this:
```
config.mqtt = {
    host: 'localhost',
    port: 1883,
    defaultKey: '1234',
    username: 'iota',
    password: 'iota'
};
```

The last action to take is to edit the `/etc/mosquitto/mosquitto.conf` to add the `aclfile` and `pwfile` files to the 
configuration. The finished configuration should be something like this:
```
pid_file /var/run/mosquitto.pid

persistence true
persistence_location /var/lib/mosquitto/

log_dest file /var/log/mosquitto/mosquitto.log

#acl_file /etc/mosquitto/aclfile
password_file /etc/mosquitto/pwfile
include_dir /etc/mosquitto/conf.d
```

Now that all the changes have been completed, restart mosquitto:
```
service mosquitto restart
```

and rerun the IoT Agent (you can check its PID with `ps` or `netstat` and kill it).

### Testing

#### Configuration and Device Provisioning
In order to test the ACL files, first of all, provision the configuration and device as we did in the previous chapter,
but using a different device, with data:

 * *Name*: DaisyPot
 * *DevId*: sensor03
 
It's important that you provision the configuration with the exact same APIKey you declared in the ACL.

The device provisioning request will be the following:
```
curl -X POST -H "Fiware-Service: myHome" -H "Fiware-ServicePath: /environment" -H "Content-Type: application/json" -H "Cache-Control: no-cache" -d '{ 
    "devices": [ 
        { 
            "device_id": "sensor03", 
            "entity_name": "DaisyPot", 
            "entity_type": "potSensor",
            "attributes": [
              {
                "name": "humidity",
                "type": "degrees"
              },
              {
                "name": "happyness",
                "type": "subjective"
              }
            ]
        }
    ]
}

' 'http://localhost:4041/iot/devices'
```

#### Sending mesaures

Now we can try to provision new measures with the same command we used in the first case:
```
mosquitto_pub -t /AAFF9977/sensor03/attrs -m '{"humidity": 76,"happyness": "Not bad"}'
```

If we use a queryContext to check if the changes have been progressed to the Context Broker we will find that those
measures have been ignored:
```
curl -X POST -H "Content-Type: application/json" -H "Accept: application/json" -H "Fiware-Service: myHome" -H "Fiware-ServicePath: /environment" -d '{
    "entities": [
        {
            "isPattern": "false",
            "id": "DaisyPot",
            "type": "potSensor"
        }
    ]
}' 'http://localhost:1026/NGSI10/queryContext'
```

Checking the IoTAgent logs you will see that the request was completely ignored. The problem was that the client was
trying to make an anonymous publish in a ACL protected topic that let only the user `potteduser`publish new messages.
If we try again using the credentials we generated for the user:
```
mosquitto_pub -t /AAFF9977/sensor03/attrs -m '{"humidity": 76,"happyness": "Not bad"}' -u potteduser -P pottedpass
```

And execute the queryContext again, we will get the updated entity:
```
{
  "contextResponses" : [
    {
      "contextElement" : {
        "type" : "potSensor",
        "isPattern" : "false",
        "id" : "DaisyPot",
        "attributes" : [
          {
            "name" : "happyness",
            "type" : "subjective",
            "value" : " "
          },
          {
            "name" : "humidity",
            "type" : "degrees",
            "value" : " "
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
