# FIWARE IoT Agent for a JSON-based Protocol

An Internet of Things Agent for a JSON based protocol (with
[AMQP](https://www.amqp.org/), [HTTP](https://www.w3.org/Protocols/) and
[MQTT](https://mqtt.org/) transports). This IoT Agent is designed to be a bridge
between [JSON](https://json.org/) and the
[NGSI](https://swagger.lab.fiware.org/?url=https://raw.githubusercontent.com/Fiware/specifications/master/OpenAPI/ngsiv2/ngsiv2-openapi.json)
interface of a context broker.

It is based on the
[IoT Agent Node.js Library](https://github.com/telefonicaid/iotagent-node-lib).
Further general information about the FIWARE IoT Agents framework, its
architecture and the common interaction model can be found in the library's
GitHub repository.

This project is part of [FIWARE](https://www.fiware.org/). For more information
check the FIWARE Catalogue entry for the
[IoT Agents](https://github.com/Fiware/catalogue/tree/master/iot-agents).

## Configuration with environment variables
Some of the more common variables can be configured using environment variables. The ones overriding general parameters
in the `config.iota` set are described in the [IoTA Library Configuration manual](https://github.com/telefonicaid/iotagent-node-lib#configuration).

The ones specifically relating to JSON bindings are described in the following table.

| Environment variable      | Configuration attribute             |
|:------------------------- |:----------------------------------- |
| IOTA_MQTT_HOST            | mqtt.host                           |
| IOTA_MQTT_PORT            | mqtt.port                           |
| IOTA_MQTT_USERNAME        | mqtt.username                       |
| IOTA_MQTT_PASSWORD        | mqtt.password                       |
| IOTA_MQTT_QOS             | mqtt.qos                            |
| IOTA_MQTT_RETAIN          | mqtt.retain                         |
| IOTA_AMQP_HOST            | amqp.host                           |
| IOTA_AMQP_PORT            | amqp.port                           |
| IOTA_AMQP_USERNAME        | amqp.username                       |
| IOTA_AMQP_PASSWORD        | amqp.password                       |
| IOTA_AMQP_EXCHANGE        | amqp.exchange                       |
| IOTA_AMQP_QUEUE           | amqp.queue                          |
| IOTA_AMQP_DURABLE         | amqp.durable                        |
| IOTA_AMQP_RETRIES         | amqp.retries                        |
| IOTA_AMQP_RETRY_TIME      | amqp.retryTime                      |
| IOTA_HTTP_HOST            | http.host (still not in use)        |
| IOTA_HTTP_PORT            | http.port (still not in use)        |

(HTTP-related environment variables will be used in the upcoming HTTP binding)