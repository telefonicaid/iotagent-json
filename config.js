/*
 * Copyright 2015 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of iotagent-json
 *
 * iotagent-json is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * iotagent-json is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with iotagent-json.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 */
var config = {};

/**
 * Configuration for the MQTT binding.
 */
config.mqtt = {
    /**
     * Host where the MQTT Broker is located.
     */
    host: 'localhost',
    /**
     * Port where the MQTT Broker is listening.
     */
    port: 1883,
    /**
     * Activating thinkingThingsPlugin flag. When it is set to true the constraint devices sends an HTTP POST request
     * to the server with a Content-Type, containing a field name and a payload. The payload can be divided in modules,
     * each one of them responsible for a single measure. Modules are separated by the '#' character, and all of them
     * consists of a series of parameters separated by commas.
     */
    thinkingThingsPlugin: true,
    /**
     * QoS Level: at most once (0), at least once (1), exactly once (2). (default is 2).
     */
    qos: 0,
    /**
     * Retain flag. (default is true.) Normally if a publisher publishes a message to a topic, and no one is
     * subscribed to that topic (i.e retain flag is set to false) the message is simply discarded by the broker.
     * The publisher can tell the broker to keep the last message on that topic by setting the retained message
     * flag to true.
     */
    retain: false,
    /**
     * Number of MQTT connection error retries (default is 5).
     */
    retries: 5,
    /**
     * Time between MQTT connection retries (default is 5 seconds).
     */
    retryTime: 5,
    /**
     * Time to keep connection open between client and MQTT broker (default is 0 seconds)
     */
    keepalive: 0
};

/**
 * Configuration for the AMQP binding.
 */
config.amqp = {
    /**
     * Host where the AMQP broker is located.
     */
    host: 'localhost',
    /**
     * Port where the AMQP broker is listening.
     */
    port: 5672,
    /**
     * user name that identifies the IOTA against the AMQP broker (optional).
     */
    // username: 'guest',
    /**
     * password to be used if the username is provided (optional).
     */
    // password: 'guest',
    /**
     *  Exchange in the AMQP broker
     */
    exchange: 'iota-exchange',
    /**
     * Queue in the AMQP broker
     */
    queue: 'iotaqueue',
    /**
     * durable queue flag (default is false).
     */
    options: { durable: true }
};

/**
 * Configuration for the HTTP transport binding.
 */
config.http = {
    /**
     * South Port where the Ultralight transport binding for HTTP will be listening for device requests.
     */
    port: 7896
    /**
     * HTTP Timeout for the http command endpoint (in miliseconds).
     */
    //timeout: 1000
};

config.iota = {
    /**
     * Configures the log level. Appropriate values are: FATAL, ERROR, INFO, WARN and DEBUG.
     */
    logLevel: 'DEBUG',
    /**
     * When this flag is active, the IoTAgent will add the TimeInstant attribute to every entity created, as well
     * as a TimeInstant metadata to each attribute, with the current timestamp.
     */
    timestamp: true,
    /**
     * Context Broker configuration. Defines the connection information to the instance of the Context Broker where
     * the IoT Agent will send the device data.
     */
    contextBroker: {
        /**
         * Host where the Context Broker is located.
         */
        host: 'localhost',
        /**
         * Port where the Context Broker is listening.
         */
        port: '1026'
    },
    /**
     * Configuration of the North Port of the IoT Agent.
     */
    server: {
        /**
         * Port where the IoT Agent will be listening for NGSI and Provisioning requests.
         */
        port: 4041
    },

    /**
     * Configuration for secured access to instances of the Context Broker secured with a PEP Proxy.
     * For the authentication mechanism to work, the authentication attribute in the configuration has to be fully
     * configured, and the authentication.enabled subattribute should have the value `true`.
     *
     * The Username and password should be considered as sensitive data and should not be stored in plaintext.
     * Either encrypt the config and decrypt when initializing the instance or use environment variables secured by
     * docker secrets.
     */
    //authentication: {
    //enabled: false,
    /**
     * Type of the Identity Manager which is used when authenticating the IoT Agent.
     */
    //type: 'keystone',
    /**
     * Name of the additional header passed to hold the identity of the IoT Agent
     */
    //header: 'X-Auth-Token',
    /**
     * Hostname of the Identity Manager.
     */
    //host: 'localhost',
    /**
     * Port of the Identity Manager.
     */
    //port: '5000',
    /**
     * Username for the IoT Agent - Note this should not be stored in plaintext.
     */
    //user: 'IOTA_AUTH_USER',
    /**
     * Password for the IoT Agent - Note this should not be stored in plaintext.
     */
    //password: 'IOTA_AUTH_PASSWORD',
    /**
     * OAuth2 client ID - Note this should not be stored in plaintext.
     */
    //clientId: 'IOTA_AUTH_CLIENT_ID',
    /**
     * OAuth2 client secret - Note this should not be stored in plaintext.
     */
    //clientSecret: 'IOTA_AUTH_CLIENT_SECRET'
    //},

    /**
     * Defines the configuration for the Device Registry, where all the information about devices and configuration
     * groups will be stored. There are currently just two types of registries allowed:
     *
     * - 'memory': transient memory-based repository for testing purposes. All the information in the repository is
     *             wiped out when the process is restarted.
     *
     * - 'mongodb': persistent MongoDB storage repository. All the details for the MongoDB configuration will be read
     *             from the 'mongodb' configuration property.
     */
    deviceRegistry: {
        type: 'mongodb'
    },
    /**
     * Mongo DB configuration section. This section will only be used if the deviceRegistry property has the type
     * 'mongodb'.
     */
    mongodb: {
        /**
         * Host where MongoDB is located. If the MongoDB used is a replicaSet, this property will contain a
         * comma-separated list of the instance names or IPs.
         */
        host: 'localhost',
        /**
         * Port where MongoDB is listening. In the case of a replicaSet, all the instances are supposed to be listening
         * in the same port.
         */
        port: '27017',
        /**
         * Name of the Mongo database that will be created to store IoT Agent data.
         */
        db: 'iotagentjson'
    },
    /**
     * Types array for static configuration of services. Check documentation in the IoT Agent Library for Node.js for
     *  further details:
     *
     *      https://github.com/telefonicaid/iotagent-json#type-configuration
     */
    types: {},
    /**
     * Default service, for IoT Agent installations that won't require preregistration.
     */
    service: 'howtoService',
    /**
     * Default subservice, for IoT Agent installations that won't require preregistration.
     */
    subservice: '/howto',
    /**
     * URL Where the IoT Agent Will listen for incoming updateContext and queryContext requests (for commands and
     * passive attributes). This URL will be sent in the Context Registration requests.
     */
    providerUrl: 'http://localhost:4041',
    /**
     * Default maximum expire date for device registrations.
     */
    deviceRegistrationDuration: 'P1M',
    /**
     * Default type, for IoT Agent installations that won't require preregistration.
     */
    defaultType: 'Thing',
    /**
     * Default resource of the IoT Agent. This value must be different for every IoT Agent connecting to the IoT
     * Manager.
     */
    defaultResource: '/iot/json'
};

/**
 * flag indicating whether the incoming notifications to the IoTAgent should be processed using the bidirectionality
 * plugin from the latest versions of the library or the JSON-specific configuration retrieval mechanism.
 */
config.configRetrieval = false;
/**
 * Default API Key, to use with device that have been provisioned without a Configuration Group.
 */
config.defaultKey = '1234';
/**
 * Default transport protocol when no transport is provisioned through the Device Provisioning API.
 */
config.defaultTransport = 'MQTT';
/**
 * flag indicating whether the node server will be executed in multi-core option (true) or it will be a
 * single-thread one (false).
 */
//config.multiCore = false;

module.exports = config;
