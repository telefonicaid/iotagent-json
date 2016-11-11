# Operations Manual: logs and alarms
## Index

* [Overview](#overview)
* [Logs](#logs)
* [Alarms](#alarms)
* [Error naming code](#errorcode)


## <a name="overview"/>  Overview
The following document shows all the errors that can appear in the IoTAgent Ultralight 2.0 log file, and gives a brief
idea of the severity and how to react to those errors.

## <a name="logs"/>  Logs
The following section contains the error log entries that can appear in the IoTA logs, grouped by category.

### Command errors

#### COMMAND-001: Command execution could not be handled, as device for entity [%s] [%s] wasn\'t found
Indicates that a command has been received for a non-registered entity. This could mean the device was removed from the
IoT Agent without removing the registration in the Context Broker. Check for the existence of a provisioned device for
the entity, and, if it doesn't exist, remove the Context Broker registration for that unexistent device.

#### COMMANDS-002: Couldn\'t update command status in the Context broker for device [%s] with apiKey [%s]: %s
There was some communication error connecting with the Context Broker that made it impossible to update the command
status. If this error appears, the command status will be left inconsistent. If this log appears frequently, it may be
a signal of network problems between the IoTAgent and the Context Broker. Check the IoTAgent network connection, and
the configured Context Broker port and host.

### Configuration retrieval

#### CONFIG-001: Couldn\'t get the requested values from the Context Broker: %s

The client device requested some attributes that didn't exist in the Context Broker. This usually means there was an
error in the client side (either the client did not write the appropriate values in the CB or the device sent different
IDs in the request). Occasionally it may reflect an error in the communication with the Context Broker.

#### CONFIG-002: There was an error subscribing device [%s] to attributes [%j]

The IoTAgent could not subscribe to the requested entity. Most of the times this will indicate a problem communicating
with the Context Broker (check it by looking for other Context Broker communication-related problems).

#### CONFIG-003: Unknown command type from device [%s]

A configuration request was received from a device with a type that is not one of the available values: "configuartion"
or "subscription". This is always an error on the client side.

### Thinking Things errors

#### TTHINGS-001: Too few fields parsing Battery module: %s

Parse error reading a battery payload. This is always an error on the client side (redirect it to the documentation).

#### TTHINGS-002: Too few fields parsing GSM module: %s

Parse error reading a GSM payload. This is always an error on the client side (redirect it to the documentation).

#### TTHINGS-003: Too few fields parsing C1 module: %s

Parse error reading a C1 payload. This is always an error on the client side (redirect it to the documentation).


### Measure errors

#### MEASURES-001: Bad payload received while processing timestamps
The Timestamp insertion plugin found an object with a wrong format that prevented the plugin from writing the Timestamp.
This object is written by internal code so this shouldn't happen. If it does, it will be as a consecuence of a previous
error, or it will indicate a bug in the code.

#### MEASURES-002: Couldn\'t send the updated values to the Context Broker due to an error: %s
There was some communication error connecting with the Context Broker that made it impossible to send the measures.
If this log appears frequently, it may be a signal of network problems between the IoTAgent and the Context Broker.
Check the IoTAgent network connection, and the configured Context Broker port and host.

#### MEASURES-003: Impossible to handle malformed message: %s
The received MQTT message did not contain a valid JSON payload. This will usually be caused by an error in the client
side: either the JSON itself is not well-formed, or it has been encoded in a way the IoTAgent was not able to decode.

#### MEASURES-004: Device not found for topic [%s]
This error log will appear whenever a measure arrives to the IoTAgent for a device that has not been provisioned or for
an API Key that has not been registered in the IOTAgent. This could have several origins: the may be a typo in the
DeviceId or APIKey used by the customer; or either the Configuration or the Device for the corresponding measure may
have been removed; or the customer may have forgotten to provision both the Configuration and the Device.

#### MEASURES-005: Couldn\'t process message [%s] due to format issues.
Implies a message was received in an invalid MQTT Topic. Normally, this is an error that can only be addressed by the
client itself.


### Global errors

#### GLOBAL-001: Error subscribing to topics: %s
Error subscribing the IoT Agent to the appropriate MQTT Topics. This error can only happen at startup time, and should
prevent the IOTA from starting. If this error occurs, check the Mosquitto MQTT broker is up and running and check the
connectivity from the IoTAgent to the broker.

#### GLOBAL-002: Configuration error. Configuration object [config.http] is missing

Indicates the mandatory "config.http" configuration parameter was not found while starting the IoTAgent. This will
prevent the IoTAgent from starting. Check the configuration files and fix them to be valid.

## <a name="alarms"/> Alarms

The following table shows the alarms that can be raised in the JSON IoTAgent library. All the alarms are signaled by an
error log starting with the prefix "Raising [%s]:" (where %s is the alarm name). All the alarms are released by an info
log with the prefix "Releasing [%s]". These texts appear in the `msg=` field of the generic log record format.

| Alarm name            | Severity     | Description            |
|:--------------------- |:-------------|:---------------------- |
| MQTTB-ALARM           | **Critical** | Indicates a persistent error accessing the Mosquitto MQTT Broker |

while the 'Severity' criterium is as follows:

* **Critical** - The system is not working
* **Major** - The system has a problem that degrades the service and must be addressed
* **Warning** - It is happening something that must be notified

## <a name="errorcode"/> Error naming code
Every error has a code composed of a prefix and an ID, codified with the following table:

| Prefix           | Type of operation      |
|:---------------- |:---------------------- |
| GLOBAL           | Global errors          |
| TTHINGS          | Thinking Things plugin errors          |
| CONFIG           | Errors related with the configuration retrieval mechanism          |
| MEASURES         | Errors related with measure processing |
| COMMANDS         | Errors related with command processing |
