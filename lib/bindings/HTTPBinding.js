/*
 * Copyright 2016 Telefonica Investigación y Desarrollo, S.A.U
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

'use strict';

var iotAgentLib = require('iotagent-node-lib'),
    intoTrans = iotAgentLib.intoTrans,
    _ = require('underscore'),
    commandHandler = require('../commandHandler'),
    async = require('async'),
    apply = async.apply,
    request = require('request'),
    errors = require('../errors'),
    express = require('express'),
    iotaUtils = require('../iotaUtils'),
    http = require('http'),
    commonBindings = require('../commonBindings'),
    bodyParser = require('body-parser'),
    constants = require('../constants'),
    context = {
        op: 'IoTAgentJSON.HTTPBinding'
    },
    config = require('../configService'),
    httpBindingServer;

function checkMandatoryParams(queryPayload) {
    return function(req, res, next) {
        var notFoundParams = [],
            error;

        req.apiKey = req.query.k;
        req.deviceId = req.query.i;

        if (!req.apiKey) {
            notFoundParams.push('API Key');
        }

        if (!req.deviceId) {
            notFoundParams.push('Device Id');
        }

        if (queryPayload && !req.query.d) {
            notFoundParams.push('Payload');
        }

        if (req.method === 'POST' && !req.is('json')) {
            error = new errors.UnsupportedType('application/json');
        }

        if (notFoundParams.length !== 0) {
            next(new errors.MandatoryParamsNotFound(notFoundParams));
        } else {
            next(error);
        }
    };
}

function parseData(req, res, next) {
    var data,
        error,
        payload;

    if (req.body) {
        data = req.body;
    } else {
        payload = req.query.d;

        config.getLogger().debug(context, 'Parsing payload [%s]', payload);

        try {
            data = JSON.parse(payload);
        } catch (e) {
            error = e;
        }
    }

    if (error) {
        next(error);
    } else {
        req.jsonPayload = data;

        config.getLogger().debug(context, 'Parsed data: [%j]', data);
        next();
    }
}

function executeCommand(apiKey, device, serializedPayload, callback) {
    var options = {
        url: device.endpoint,
        method: 'POST',
        body: serializedPayload,
        headers: {
            'fiware-service': device.service,
            'fiware-servicepath': device.subservice
        }
    };

    request(options, function(error, response, body) {
        if (error || response.statusCode !== 200 && response.statusCode !== 201) {
            callback(new errors.HTTPCommandResponseError(response.statusCode, error));
        } else {
            if (apiKey) {
                var parsedBody;

                try {
                    parsedBody = JSON.parse(body);
                    process.nextTick(commandHandler.updateCommand.bind(null, apiKey, device.id, device, parsedBody));

                    callback();
                } catch (e) {
                    callback(new errors.HTTPCommandResponseError(400, error));
                }
            } else {
                callback();
            }
        }
    });
}

function addTimestamp(req, res, next) {
    if (req.query.t && req.jsonPayload) {
        req.jsonPayload[constants.TIMESTAMP_ATTRIBUTE] = req.query.t;
    }

    next();
}

function handleIncomingMeasure(req, res, next) {
    var values;

    config.getLogger().debug(context, 'Processing multiple HTTP measures for device [%s] with apiKey [%s]',
        req.deviceId, req.apiKey);

    function updateCommandHandler(error) {
        if (error) {
            next(error);
            config.getLogger().error(context,
                'MEASURES-002: Couldn\'t send the updated values to the Context Broker due to an error: %s', error);
        } else {
            config.getLogger().debug(context,
                'Multiple measures for device [%s] with apiKey [%s] successfully updated',
                req.deviceId, req.apiKey);

            next();
        }
    }

    function processHTTPWithDevice(device) {
        values = commonBindings.extractAttributes(device, req.jsonPayload);

        if (req.isCommand) {
            var executions = [];

            for (var i in values) {
                executions.push(iotAgentLib.setCommandResult.bind(null,
                    device.name,
                    config.getConfig().iota.defaultResource,
                    req.apiKey,
                    values[i].name,
                    values[i].value,
                    constants.COMMAND_STATUS_COMPLETED,
                    device
                ));
            }

            async.parallel(executions, updateCommandHandler);

        } else {
            iotAgentLib.update(device.name, device.type, '', values, device, updateCommandHandler);
        }
    }

    function processDeviceMeasure(error, device) {
        if (error) {
            next(error);
        } else {
            var localContext = _.clone(context);

            req.device = device;

            localContext.service = device.service;
            localContext.subservice = device.subservice;

            intoTrans(localContext, processHTTPWithDevice)(device);
        }
    }

    iotAgentLib.retrieveDevice(req.deviceId, req.apiKey, processDeviceMeasure);
}

function isCommand(req, res, next) {
    if (req.path ===
        (config.getConfig().iota.defaultResource || constants.HTTP_MEASURE_PATH) + constants.HTTP_COMMANDS_PATH) {

        req.isCommand = true;
    }

    next();
}

function sendConfigurationToDevice(apiKey, deviceId, results, callback) {

    function handleDeviceResponse(innerCallback) {
        return function(error, response, body) {
            if (error) {
                innerCallback(error);
            } else if (response.statusCode !== 200) {
                innerCallback(new errors.DeviceEndpointError(response.statusCode, body));
            } else {
                innerCallback();
            }
        };
    }

    function sendRequest(device, results, innerCallback) {
        var resultRequest = {
            url: device.endpoint + constants.HTTP_CONFIGURATION_PATH,
            method: 'POST',
            json: iotaUtils.createConfigurationNotification(results),
            headers: {
                'fiware-service': device.service,
                'fiware-servicepath': device.subservice
            }
        };

        request(resultRequest, handleDeviceResponse(innerCallback));
    }

    iotAgentLib.retrieveDevice(deviceId, apiKey, function(error, device) {
        if (error) {
            callback(error);
        } else if (!device.endpoint) {
            callback(new errors.EndpointNotFound(device.id));
        } else {
            sendRequest(device, results, callback);
        }
    });
}

function handleConfigurationRequest(req, res, next) {
    function replyToDevice(error) {
        if (error) {
            res.status(error.code).json(error);
        } else {
            res.status(200).json({});
        }
    }

    iotAgentLib.retrieveDevice(req.deviceId, req.apiKey, function(error, device) {
       if (error) {
           next(error);
       } else {
           iotaUtils.manageConfiguration(
               req.apiKey, req.deviceId, device, req.jsonPayload, sendConfigurationToDevice, replyToDevice);
       }
    });
}

function handleError(error, req, res, next) {
    var code = 500;

    config.getLogger().debug(context, 'Error [%s] handing request: %s', error.name, error.message);

    if (error.code && String(error.code).match(/^[2345]\d\d$/)) {
        code = error.code;
    }

    res.status(code).json({
        name: error.name,
        message: error.message
    });
}

/**
 * Device provisioning handler. This handler just fills in the transport protocol in case there is none.
 *
 * @param {Object} device           Device object containing all the information about the provisioned device.
 */
function deviceProvisioningHandler(device, callback) {
    if (!device.transport) {
        device.transport = 'HTTP';
    }

    if (device.transport === 'HTTP') {
        if (device.endpoint) {
            device.polling = false;
        } else {
            device.polling = true;
        }
    }

    callback(null, device);
}

/**
 * This middleware checks whether there is any polling command pending to be sent to the device. If there is some,
 * add the command information to the return payload. Otherwise it returns an empty payload.
 */
function returnCommands(req, res, next) {

    function updateCommandStatus(device, commandList) {
        var updates,
            cleanCommands;

        function createCommandUpdate(command) {
            return apply(iotAgentLib.setCommandResult,
                device.name,
                device.resource,
                req.query.k,
                command.name,
                ' ',
                'DELIVERED',
                device
            );
        }

        function cleanCommand(command) {
            return apply(iotAgentLib.removeCommand,
                device.service,
                device.subservice,
                device.id,
                command.name);
        }

        updates = commandList.map(createCommandUpdate);
        cleanCommands = commandList.map(cleanCommand);

        async.parallel(updates.concat(cleanCommands), function(error, results) {
            if (error) {
                config.getLogger().error(context,
                    'Error updating command status after delivering commands for device [%s]',
                    device.id);
            } else {
                config.getLogger().debug(context,
                    'Command status updated successfully after delivering command list to device [%s]', device.id);
            }
        });
    }

    function parseCommand(item) {
        var result = {},
            cleanedValue = String(item.value).trim();

        if (cleanedValue !== '') {
            result[item.name] = item.value;
        }

        return result;
    }

    function concatCommand(previous, current) {
        if (previous === {}) {
            return current;
        } else {
            return _.extend(previous, current);
        }
    }

    if (req.query && req.query.getCmd === '1') {
        iotAgentLib.commandQueue(
            req.device.service,
            req.device.subservice,
            req.deviceId,
            function(error, list) {
                if (error || !list || list.count === 0) {
                    res.status(200).send('');
                } else {
                    res.status(200).send(
                        JSON.stringify(list.commands.map(parseCommand).reduce(concatCommand, {}))
                    );

                    process.nextTick(updateCommandStatus.bind(null, req.device, list.commands));
                }
            });
    } else {
        res.status(200).send('');
    }
}

function start(callback) {
    var baseRoot = '/';

    httpBindingServer = {
        server: null,
        app: express(),
        router: express.Router()
    };

    if (!config.getConfig().http) {
        config.getLogger().fatal(context,
            'GLOBAL-002: Configuration error. Configuration object [config.http] is missing');
        callback(new errors.ConfigurationError('config.http'));
        return;
    }

    config.getLogger().info(context, 'HTTP Binding listening on port [%s]', config.getConfig().http.port);

    httpBindingServer.app.set('port', config.getConfig().http.port);
    httpBindingServer.app.set('host', config.getConfig().http.host || '0.0.0.0');

    httpBindingServer.router.post(
        config.getConfig().iota.defaultResource || constants.HTTP_MEASURE_PATH,
        bodyParser.json(),
        checkMandatoryParams(false),
        parseData,
        addTimestamp,
        handleIncomingMeasure,
        returnCommands);

    httpBindingServer.router.post(
        (config.getConfig().iota.defaultResource || constants.HTTP_MEASURE_PATH) + constants.HTTP_COMMANDS_PATH,
        bodyParser.json(),
        checkMandatoryParams(false),
        parseData,
        addTimestamp,
        isCommand,
        handleIncomingMeasure,
        returnCommands);

    httpBindingServer.router.post(
        (config.getConfig().iota.defaultResource || constants.HTTP_MEASURE_PATH) + constants.HTTP_CONFIGURATION_PATH,
        bodyParser.json(),
        checkMandatoryParams(false),
        parseData,
        handleConfigurationRequest
    );

    httpBindingServer.app.use(baseRoot, httpBindingServer.router);
    httpBindingServer.app.use(handleError);

    httpBindingServer.server = http.createServer(httpBindingServer.app);

    httpBindingServer.server.listen(httpBindingServer.app.get('port'), httpBindingServer.app.get('host'), callback);
}

function stop(callback) {
    config.getLogger().info(context, 'Stopping JSON HTTP Binding: ');

    if (httpBindingServer) {
        httpBindingServer.server.close(function() {
            config.getLogger().info(context, 'HTTP Binding Stopped');
            callback();
        });
    } else {
        callback();
    }
}


function sendPushNotifications(device, values, callback) {
    var executions = _.flatten(values.map(commandHandler.generateCommandExecution.bind(null, null, device)));

    async.series(executions, function(error) {
        callback(error);
    });
}

function storePollNotifications(device, values, callback) {

    function addPollNotification(item, innerCallback) {
        iotAgentLib.addCommand(device.service, device.subservice, device.id, item, innerCallback);
    }

    async.map(values, addPollNotification, callback);
}

function notificationHandler(device, values, callback) {
    if (device.endpoint) {
        sendPushNotifications(device, values, callback);
    } else {
        storePollNotifications(device, values, callback);
    }
}

exports.start = start;
exports.stop = stop;
exports.sendConfigurationToDevice = sendConfigurationToDevice;
exports.deviceProvisioningHandler = deviceProvisioningHandler;
exports.notificationHandler = notificationHandler;
exports.executeCommand = executeCommand;
exports.protocol = 'HTTP';
