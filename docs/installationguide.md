# Installation & Administration Guide

-   [Installation](#installation)
-   [Usage](#usage)
-   [Configuration](#configuration)

### Installation

There are three ways of installing the JSON IoT Agent: using Git, RPMs or Docker image.

#### Using GIT

In order to install the TT Agent, just clone the project and install the dependencies:

```bash
git clone https://github.com/telefonicaid/iotagent-json.git
npm install
```

In order to start the IoT Agent, from the root folder of the project, type:

```bash
bin/iotagent-json
```

#### Using RPM

The project contains a script for generating an RPM that can be installed in Red Hat 6.5 compatible Linux distributions.
The RPM depends on Node.js 0.10 version, so EPEL repositories are advisable.

In order to create the RPM, execute the following scritp, inside the `/rpm` folder:

```bash
create-rpm.sh -v <versionNumber> -r <releaseNumber>
```

Once the RPM is generated, it can be installed using the followogin command:

```bash
yum localinstall --nogpg <nameOfTheRPM>.rpm
```

The IoTA will then be installed as a linux service, and can ve started with the `service` command as usual:

```bash
service iotaJSON start
```

#### Using Docker

A docker container is available on docker hub. It will start the container with the default settings defined in
`config.js`.

```bash
docker run -it --init fiware/iotagent-json
```

To use your own configuration you can mount a local configuration file:

```bash
docker run -it --init -v <path-to-configuration-file>:/opt/iotajson/new_config.js fiware/iotagent-json  -- new_config.js
```

As an alternative, it is also possible to pass configuration using environmental variables, as explained in
[Configuration with environment variables](#configuration-with-environment-variables) subsection.

### Usage

In order to execute the JSON IoT Agent just execute the following command from the root folder:

```bash
bin/iotagentMqtt.js
```

This will start the JSON IoT Agent in the foreground. Use standard linux commands to start it in background.

When started with no arguments, the IoT Agent will expect to find a `config.js` file with the configuration in the root
folder. An argument can be passed with the path to a new configuration file (relative to the application folder) to be
used instead of the default one.

### Configuration

#### Overview

All the configuration for the IoT Agent is stored in a single configuration file (typically installed in the root
folder).

This configuration file is a JavaScript file and contains three configuration chapters:

-   **iota**: this object stores the configuration of the North Port of the IoT Agent, and is completely managed by the
    IoT Agent library. More information about this options can be found
    [here](https://github.com/telefonicaid/iotagent-node-lib#configuration).
-   **mqtt**: this object stores MQTT's specific configuration. A detailed description can be found in the next section.
-   **http**: this object stores HTTP's specific configuration. A detailed description can be found in the next section.

There are also some global configuration options:

-   **configRetrieval**: this flag indicates whether the incoming notifications to the IoTAgent should be processed
    using the bidirectionality plugin from the latest versions of the library or the JSON-specific configuration
    retrieval mechanism (described in the User Manual). Simultaneous use of both mechanisms is not allowed.
-   **compressTimestamp**: this flag enables the timestamp compression mechanism, described in the User Manual.
-   **multiCore**: this (optional) flag enables the execution of the IoT Agent in multi-cores if it is `true` or in
    single-thread if it is either `false` or not specified.

#### MQTT configuration

These are the currently available MQTT configuration options:

-   **protocol**: protocol to use for connecting with the MQTT broker (`mqtt`, `mqtts`, `tcp`, `tls`, `ws`, `wss`).
-   **host**: host of the MQTT broker.
-   **port**: port where the MQTT broker is listening.
-   **defaultKey**: default API Key to use when a device is provisioned without a configuration.
-   **ca**: ca certificates to use for validating server certificates (optional). Default is to trust the well-known CAs
    curated by Mozilla. Mozilla's CAs are completely replaced when CAs are explicitly specified using this option.
-   **cert**: cert chains in PEM format to use for authenticating into the MQTT broker (optional). Only used when using
    `mqtts`, `tls` or `wss` as connnection protocol.
-   **key**: optional private keys in PEM format to use on the client-side for connecting with the MQTT broker
    (optional). Only used when using `mqtts`, `tls` or `wss` as connection protocol.
-   **rejectUnauthorized**: whether to reject any connection which is not authorized with the list of supplied CAs. This
    option only has an effect when using `mqtts`, `tls` or `wss` protocols (default is `true`).
-   **username**: username that identifies the IOTA against the MQTT broker (optional).
-   **password**: password to be used if the username is provided (optional).
-   **qos**: QoS level: at most once (0), at least once (1), exactly once (2). (default is 0).
-   **retain**: retain flag (default is false).
-   **retries**: Number of MQTT connection error retries (default is 5).
-   **retryTime**: Time between MQTT connection retries (default is 5 seconds).
-   **keepalive**: Time to keep connection open between client and MQTT broker (default is 0 seconds)

TLS options (i.e. **ca**, **cert**, **key**, **rejectUnauthorized**) are directly linked with the ones supported by the
[tls module of Node.js](https://nodejs.org/api/tls.html#tls_tls_createsecurecontext_options).

#### AMQP Binding configuration

The `config.amqp` section of the config file contains all the information needed to connect to the AMQP Broker from the
IoT Agent. The following attributes are accepted:

-   **host**: Host where the AMQP Broker is located.
-   **port**: Port where the AMQP Broker is listening
-   **username**: username that identifies the IOTA against the AMQP broker (optional).
-   **password**: password to be used if the username is provided (optional).
-   **exchange**: Exchange in the AMQP broker
-   **queue**: Queue in the AMQP broker
-   **durable**: durable queue flag (default is `false`).
-   **retries**: Number of AMQP connection error retries (default is 5).
-   **retryTime**: Time between AMQP connection retries (default is 5 seconds).

#### HTTP Binding configuration

The `config.http` section of the config file contains all the information needed to start the HTTP server for the HTTP
transport protocol binding. The following options are accepted:

-   **port**: South Port where the HTTP listener will be listening for information from the devices.
-   **timeout**: HTTP Timeout for the HTTP endpoint (in miliseconds).

#### Configuration with environment variables

Some of the more common variables can be configured using environment variables. The ones overriding general parameters
in the `config.iota` set are described in the
[IoTA Library Configuration manual](https://github.com/telefonicaid/iotagent-node-lib#configuration).

The ones relating specific JSON bindings are described in the following table.

| Environment variable          | Configuration attribute |
| :---------------------------- | :---------------------- |
| IOTA_MQTT_PROTOCOL            | mqtt.protocol           |
| IOTA_MQTT_HOST                | mqtt.host               |
| IOTA_MQTT_PORT                | mqtt.port               |
| IOTA_MQTT_CA                  | mqtt.ca                 |
| IOTA_MQTT_CERT                | mqtt.cert               |
| IOTA_MQTT_KEY                 | mqtt.key                |
| IOTA_MQTT_REJECT_UNAUTHORIZED | mqtt.rejectUnauthorized |
| IOTA_MQTT_USERNAME            | mqtt.username           |
| IOTA_MQTT_PASSWORD            | mqtt.password           |
| IOTA_MQTT_QOS                 | mqtt.qos                |
| IOTA_MQTT_RETAIN              | mqtt.retain             |
| IOTA_MQTT_RETRIES             | mqtt.retries            |
| IOTA_MQTT_RETRY_TIME          | mqtt.retryTime          |
| IOTA_MQTT_KEEPALIVE           | mqtt.keepalive          |
| IOTA_AMQP_HOST                | amqp.host               |
| IOTA_AMQP_PORT                | amqp.port               |
| IOTA_AMQP_USERNAME            | amqp.username           |
| IOTA_AMQP_PASSWORD            | amqp.password           |
| IOTA_AMQP_EXCHANGE            | amqp.exchange           |
| IOTA_AMQP_QUEUE               | amqp.queue              |
| IOTA_AMQP_DURABLE             | amqp.durable            |
| IOTA_AMQP_RETRIES             | amqp.retries            |
| IOTA_AMQP_RETRY_TIME          | amqp.retryTime          |
| IOTA_HTTP_HOST                | http.host               |
| IOTA_HTTP_PORT                | http.port               |
| IOTA_HTTP_TIMEOUT             | http.timeout            |

(HTTP-related environment variables will be used in the upcoming HTTP binding)

`IOTA_MQTT_CA`, `IOTA_MQTT_CERT`, `IOTA_MQTT_KEY` environment variables should provide the filename of the file whose
contents will be used for the configuration attribute.

#### High performance configuration

Node.js is single‑threaded and uses nonblocking I/O, allowing it to scale up to tens of thousands of concurrent
operations. Nevertheless, Node.js has a few weak points and vulnerabilities that can make Node.js‑based systems to offer
underperformance behaviour, specially when a Node.js web application experiences rapid traffic growth.

Additionally, It is important to know the place in which the node.js server is running, because it has limitations.
There are two types of limits on the host: hardware and software. Hardware limits can be easy to spot. Your application
might be consuming all of the memory and needing to consume disk to continue working. Adding more memory by upgrading
your host, whether physical or virtual, seems to be the right choice.

Moreover, Node.js applications have also a software memory limit (imposed by V8), therefore we cannot forget about these
limitations when we execute a service. In this case of 64-bit environment, your application would be running by default
at a 1 GB V8 limit. If your application is running in high traffic scenarios, you will need a higher limit. The same is
applied to other parameters.

It means that we need to make some changes in the execution of node.js and in the configuration of the system:

-   **Node.js flags**

    -   **--use-idle-notification**

        Turns of the use idle notification to reduce memory footprint.

    -   **--expose-gc**

        Use the expose-gc command to enable manual control of the garbage collector from the own node.js server code. In
        case of the IoTAgent, it is not implemented because it is needed to implement the calls to the garbage collector
        inside the ser server, nevertheless the recommended value is every 30 seconds.

    -   **--max-old-space-size=xxxx**

        In that case, we want to increase the limit for heap memory of each V8 node process in order to use max capacity
        that it is possible instead of the 1,4Gb default on 64-bit machines (512Mb on a 32-bit machine). The
        recommendation is at least to use half of the total memory of the physical or virtual instance.

-   **User software limits**

    Linux kernel provides some configuration about system related limits and maximums. In a distributed environment with
    multiple users, usually you need to take into control the resources that are available for each of the users.
    Nevertheless, when the case is that you have only one available user but this one request a lot of resources due to
    a high performance application the default limits are not proper configured and need to be changed to resolve the
    high performance requirements. These are like maximum file handler count, maximum file locks, maximum process count
    etc.

    You can see the limits of your system executing the command:

    ```bash
    ulimit -a
    ```

    You can detine the corresponding limits inside the file limits.conf. This description of the configuration file
    syntax applies to the `/etc/security/limits.conf` file and \*.conf files in the `/etc/security/limits.d` directory.
    You can get more information about the limits.conf in the
    [limits.con - linux man pages](http://man7.org/linux/man-pages/man5/limits.conf.5.html). The recommended values to
    be changes are the following:

    -   **core**

        Limits of the core file size in KB, we recommend to change to `unlimited` both hard and soft types.

            * soft core unlimited
            * hard core unlimited

    -   **data**

        Maximum data size in KB, we recommend to change to `unlimited` both hard and soft types.

            * soft data unlimited
            * hard data unlimited

    -   **fsize**

        Maximum filesize in KB, we recommend to change to `unlimited` both hard and soft types.

            * soft fsize unlimited
            * hard fsize unlimited

    -   **memlock**

        Maximum locked-in-memory address space in KB, we recommend to change to `unlimited` both hard and soft types.

            * memlock unlimited
            * memlock unlimited

    -   **nofile**

        Maximum number of open file descriptors, we recommend to change to `65535` both hard and soft types.

            * soft nofile 65535
            * hard nofile 65535

    -   **rss**

        Maximum resident set size in KB (ignored in Linux 2.4.30 and higher), we recommend to change to `unlimited` both
        hard and soft types.

            * soft rss unlimited
            * hard rss unlimited

    -   **stack**

        Maximum stack size in KB, we recommend to change to `unlimited` both hard and soft types.

            * soft stack unlimited
            * hard stack unlimited

    -   **nproc**

        Maximum number of processes, we recommend to change to `unlimited` both hard and soft types.

            * soft nproc unlimited
            * hard nproc unlimited

    You can take a look to the [limits.conf](limits.conf) file provided in this folder with all the values provided.

-   **Configure kernel parameters**

    sysctl is used to modify kernel parameters at runtime. We plan to modify the corresponding `/etc/sysctl.conf` file.
    You can get more information in the corresponding man pages of
    [sysctl](http://man7.org/linux/man-pages/man8/sysctl.8.html) and
    [sysctl.conf](http://man7.org/linux/man-pages/man5/sysctl.conf.5.html). You can search all the kernel parameters by
    using the command `sysctl -a`

    -   **fs.file-max**

        The maximum file handles that can be allocated, the recommended value is `1000000`.

            fs.file-max = 1000000

    -   **fs.nr_open**

        Max amount of file handles that can be opened, the recommended value is `1000000`.

            fs.nr_open = 1000000

    -   **net.netfilter.nf_conntrack_max**

        Size of connection tracking table. Default value is nf_conntrack_buckets value \* 4.

            net.nf_conntrack_max = 1048576

    For more details about any other kernel parameters, take a look to the example [sysctl.conf](sysctl.conf) file.

## Packaging

The only package type allowed is RPM. In order to execute the packaging scripts, the RPM Build Tools must be available
in the system.

From the root folder of the project, create the RPM with the following commands:

```bash
cd rpm
./create-rpm.sh -v <version-number> -r  <release-number>
```

Where `<version-number>` is the version (x.y.z) you want the package to have and `<release-number>` is an increasing
number dependent in previous installations.
