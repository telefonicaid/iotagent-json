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

/* eslint-disable no-unused-vars */

const fs = require('fs');
const iotAgentLib = require('iotagent-node-lib');
const regenerateTransid = iotAgentLib.regenerateTransid;
const finishSouthBoundTransaction = iotAgentLib.finishSouthBoundTransaction;
const intoTrans = iotAgentLib.intoTrans;
const _ = require('underscore');
const commandHandler = require('../commandHandler');
const async = require('async');
const apply = async.apply;
const request = iotAgentLib.request;
const errors = require('../errors');
const express = require('express');
const iotaUtils = require('../iotaUtils');
const http = require('http');
const https = require('https');
const commonBindings = require('../commonBindings');
const bodyParser = require('body-parser');
const constants = require('../constants');
const context = {
    op: 'IOTAJSON.HTTP.Binding'
};
const config = require('../configService');
let httpBindingServer;
const transport = 'HTTP';

const { promisify } = require('util');
const json = promisify(bodyParser.json({ strict: false })); // accept anything JSON.parse accepts.
const text = promisify(bodyParser.text());
const raw = promisify(bodyParser.raw());

function parserBody() {
    // generic bodyParser
    return function (req, res, next) {
        if (req.is('text/plain')) {
            text(req, res).then(() => next(), next);
        } else if (req.is('application/octet-stream')) {
            raw(req, res).then(() => next(), next);
        } else {
            // (req.is('json')
            json(req, res).then(() => next(), next);
        }
    };
}

function checkMandatoryParams(queryPayload) {
    return function (req, res, next) {
        const notFoundParams = [];
        let error;

        req.apiKey = req.query.k;
        req.deviceId = req.query.i;
        req.attr = req.params ? req.params.attrValue : undefined; // req.query.attr; // optional

        if (!req.apiKey) {
            notFoundParams.push('API Key');
        }

        if (!req.deviceId) {
            notFoundParams.push('Device Id');
        }

        // Check if retrievingParam
        if (queryPayload && !req.query.d && req.query.getCmd !== '1') {
            notFoundParams.push('Payload');
        }
        // req.is('*/json')
        if (req.method === 'POST' && !req.is('json') && !req.is('text/plain') && !req.is('application/octet-stream')) {
            error = new errors.UnsupportedType('application/json, text/plain, application/octet-stream');
        }

        if (notFoundParams.length !== 0) {
            next(new errors.MandatoryParamsNotFound(notFoundParams));
        } else {
            next(error);
        }
    };
}

function parseData(req, res, next) {
    let data;
    let error;
    let payload;

    if (req.body) {
        config.getLogger().debug(context, 'Using body [%s]', req.body);
        data = req.body;
        regenerateTransid(data);
    } else {
        payload = req.query.d;
        regenerateTransid(payload);
        config.getLogger().debug(context, 'Parsing payload [%s]', payload);

        try {
            if (payload) {
                data = JSON.parse(payload);
            }
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

function parseDataMultipleMeasure(req, res, next) {
    let data;
    let error;
    let payload;
    let dataArray;
    dataArray = [];
    if (req.body) {
        config.getLogger().debug(context, 'Using body [%s]', req.body);
        if (!Array.isArray(req.body)) {
            dataArray.push(req.body);
        } else {
            dataArray = req.body;
        }
        regenerateTransid(dataArray);
    } else {
        payload = req.query.d;
        regenerateTransid(payload);
        config.getLogger().debug(context, 'Parsing payload [%s]', payload);
        try {
            if (payload) {
                data = JSON.parse(payload);
                dataArray.push(data);
            }
        } catch (e) {
            error = e;
        }
    }
    if (error) {
        next(error);
    } else {
        req.jsonPayload = dataArray;
        config.getLogger().debug(context, 'Parsed data array: [%j]', dataArray);
        next();
    }
}

function executeCommand(apiKey, device, cmdName, serializedPayload, contentType, callback) {
    const options = {
        url: device.endpoint,
        method: 'POST',
        body: serializedPayload,
        headers: {
            'fiware-service': device.service,
            'fiware-servicepath': device.subservice,
            'content-type': contentType
        }
    };

    if (config.getConfig().http.timeout) {
        options.timeout = config.getConfig().http.timeout;
    }
    config
        .getLogger()
        .debug(
            context,
            'Sending command [%s] with payload [%s] and with http options [%j]',
            cmdName,
            serializedPayload,
            options
        );
    request(options, function (error, response, body) {
        if (error || !response || (response.statusCode !== 200 && response.statusCode !== 201)) {
            callback(new errors.HTTPCommandResponseError(response ? response.statusCode : 400, error));
        } else if (apiKey) {
            config
                .getLogger()
                .info(
                    context,
                    'Cmd:\n %j was sent to the device %s with http options %j',
                    serializedPayload,
                    cmdName,
                    options
                );
            process.nextTick(commandHandler.updateCommand.bind(null, apiKey, device.id, device, body));
            callback();
        } else {
            config
                .getLogger()
                .info(
                    context,
                    'Cmd:\n %j was sent to the device %s with http options %j',
                    serializedPayload,
                    cmdName,
                    options
                );
            callback();
        }
    });
}

function addTimestamp(req, res, next) {
    const arr = req.jsonPayload;
    let timeStampData;
    const dataWithTimeStampArr = [];
    for (const i in arr) {
        if (req.query.t && arr[i]) {
            timeStampData = arr[i];
            timeStampData[constants.TIMESTAMP_ATTRIBUTE] = req.query.t;
            dataWithTimeStampArr.push(timeStampData);
        }
    }
    next();
}

function handleIncomingMeasure(req, res, next) {
    let values;

    config
        .getLogger()
        .debug(context, 'Processing multiple HTTP measures for device [%s] with apiKey [%s]', req.deviceId, req.apiKey);

    function updateCommandHandler(error) {
        if (error) {
            next(error);
            config.getLogger().error(
                context,
                /*jshint quotmark: double */
                "MEASURES-002: Couldn't send the updated values to the Context Broker due to an error: %j",
                /*jshint quotmark: single */
                error
            );
        } else {
            config
                .getLogger()
                .info(
                    context,
                    'Multiple measures for device [%s] with apiKey [%s] successfully updated',
                    req.deviceId,
                    req.apiKey
                );

            finishSouthBoundTransaction(next);
        }
    }

    function processHTTPWithDevice(device) {
        let payloadDataArr;
        let attributeArr;
        let attributeValues;
        attributeArr = [];
        payloadDataArr = [];

        if (req.attr && req.jsonPayload) {
            config.getLogger().debug(context, 'Parsing attr [%s] with value [%s]', req.attr, req.jsonPayload);
            // TBD: update when is not called from parsedData
            var theAttr = [{ name: req.attr, value: req.jsonPayload, type: 'None' }];
            attributeArr.push(theAttr);
        } else {
            if (!Array.isArray(req.jsonPayload)) {
                payloadDataArr.push(req.jsonPayload);
            } else {
                payloadDataArr = req.jsonPayload;
            }
            if (req.jsonPayload) {
                for (const i in payloadDataArr) {
                    values = commonBindings.extractAttributes(device, payloadDataArr[i]);
                    attributeArr.push(values);
                }
            } else {
                attributeArr = [];
            }
        }

        if (attributeArr.length === 0) {
            finishSouthBoundTransaction(next);
        } else {
            for (const j in attributeArr) {
                attributeValues = attributeArr[j];
                config
                    .getLogger()
                    .debug(
                        context,
                        'Processing measure device [%s] with attributeArr [%j] attributeValues [%j]',
                        device.name,
                        attributeArr,
                        attributeValues
                    );
                if (req.isCommand) {
                    const executions = [];
                    for (const k in attributeValues) {
                        executions.push(
                            iotAgentLib.setCommandResult.bind(
                                null,
                                device.name,
                                config.getConfig().iota.defaultResource,
                                req.apiKey,
                                attributeValues[k].name,
                                attributeValues[k].value,
                                constants.COMMAND_STATUS_COMPLETED,
                                device
                            )
                        );
                    }
                    async.parallel(executions, updateCommandHandler);
                } else if (attributeValues.length > 0) {
                    iotAgentLib.update(device.name, device.type, '', attributeValues, device, updateCommandHandler);
                } else {
                    finishSouthBoundTransaction(next);
                }
            }
        }
    }

    function processDeviceMeasure(error, device) {
        if (error) {
            next(error);
        } else {
            const localContext = _.clone(context);
            req.device = device;
            localContext.service = device.service;
            localContext.subservice = device.subservice;
            intoTrans(localContext, processHTTPWithDevice)(device);
        }
    }

    iotaUtils.retrieveDevice(req.deviceId, req.apiKey, transport, processDeviceMeasure);
}

function isCommand(req, res, next) {
    if (
        req.path ===
        (config.getConfig().iota.defaultResource || constants.HTTP_MEASURE_PATH) + constants.HTTP_COMMANDS_PATH
    ) {
        req.isCommand = true;
    }

    next();
}

function sendConfigurationToDevice(apiKey, deviceId, results, callback) {
    function handleDeviceResponse(innerCallback) {
        return function (error, response, body) {
            if (error) {
                innerCallback(error);
            } else if (response && response.statusCode !== 200) {
                innerCallback(new errors.DeviceEndpointError(response.statusCode, body));
            } else {
                innerCallback();
            }
        };
    }

    function sendRequest(device, results, innerCallback) {
        const resultRequest = {
            url: device.endpoint + constants.HTTP_CONFIGURATION_PATH,
            method: 'POST',
            json: iotaUtils.createConfigurationNotification(results),
            headers: {
                'fiware-service': device.service,
                'fiware-servicepath': device.subservice,
                'content-type': 'application/json'
            }
        };

        request(resultRequest, handleDeviceResponse(innerCallback));
    }
    iotaUtils.retrieveDevice(deviceId, apiKey, transport, function (error, device) {
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
    iotaUtils.retrieveDevice(req.deviceId, req.apiKey, transport, function (error, device) {
        if (error) {
            next(error);
        } else {
            iotaUtils.manageConfiguration(
                req.apiKey,
                req.deviceId,
                device,
                req.jsonPayload,
                sendConfigurationToDevice,
                replyToDevice
            );
        }
    });
}

function handleError(error, req, res, next) {
    let code = 500;

    config.getLogger().debug(context, 'Error [%s] handling request: %s', error.name, error.message);

    if (error.code && String(error.code).match(/^[2345]\d\d$/)) {
        code = error.code;
    }

    res.status(code).json({
        name: error.name,
        message: error.message
    });
}

/**
 * Just fills in the transport protocol in case there is none and polling if endpoint.
 *
 * @param {Object} device           Device object containing all the information about the device.
 */
function setPollingAndDefaultTransport(device, callback) {
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
 * Device provisioning handler.
 *
 * @param {Object} device           Device object containing all the information about the provisioned device.
 */
function deviceProvisioningHandler(device, callback) {
    config.getLogger().debug(context, 'httpbinding.deviceProvisioningHandler [%j]', device);
    setPollingAndDefaultTransport(device, callback);
}

/**
 * Device updating handler. This handler just fills in the transport protocol in case there is none.
 *
 * @param {Object} device           Device object containing all the information about the updated device.
 */
function deviceUpdatingHandler(device, callback) {
    config.getLogger().debug(context, 'httpbinding.deviceUpdatingHandler [%j]', device);
    setPollingAndDefaultTransport(device, callback);
}

/**
 * This middleware checks whether there is any polling command pending to be sent to the device. If there is some,
 * add the command information to the return payload. Otherwise it returns an empty payload.
 */
function returnCommands(req, res, next) {
    function updateCommandStatus(device, commandList) {
        function createCommandUpdate(command) {
            return apply(
                iotAgentLib.setCommandResult,
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
            return apply(iotAgentLib.removeCommand, device.service, device.subservice, device.id, command.name);
        }

        const updates = commandList.map(createCommandUpdate);
        const cleanCommands = commandList.map(cleanCommand);
        if (updates) {
            async.parallel(updates.concat(cleanCommands), function (error, results) {
                if (error) {
                    config
                        .getLogger()
                        .error(
                            context,
                            'Error updating command status after delivering commands for device [%s]',
                            device.id
                        );
                } else {
                    config
                        .getLogger()
                        .debug(
                            context,
                            'Command status updated successfully after delivering command list to device [%s]',
                            device.id
                        );
                }
            });
        }
    }

    function parseCommand(item) {
        const result = {};
        const cleanedValue = String(item.value).trim();

        if (cleanedValue !== '') {
            result[item.name] = item.value;
        }
        return result;
    }

    function concatCommand(previous, current) {
        if (previous === {}) {
            return current;
        }
        return _.extend(previous, current);
    }
    if (req.query && req.query.getCmd === '1') {
        iotAgentLib.commandQueue(req.device.service, req.device.subservice, req.deviceId, function (error, list) {
            if (error || !list || list.count === 0) {
                if (req.accepts('json')) {
                    res.status(200).send({});
                } else {
                    res.status(200).send('');
                }
            } else {
                if (req.accepts('json')) {
                    res.status(200).send(list.commands.map(parseCommand).reduce(concatCommand, {}));
                } else {
                    res.status(200).send(JSON.stringify(list.commands.map(parseCommand).reduce(concatCommand, {})));
                }
                process.nextTick(updateCommandStatus.bind(null, req.device, list.commands));
            }
        });
    } else {
        if (req.accepts('json')) {
            res.status(200).send({});
        } else {
            res.status(200).send('');
        }
    }
}

function start(callback) {
    const baseRoot = '/';

    httpBindingServer = {
        server: null,
        app: express(),
        router: express.Router()
    };

    if (!config.getConfig().http) {
        config
            .getLogger()
            .fatal(context, 'GLOBAL-002: Configuration error. Configuration object [config.http] is missing');
        callback(new errors.ConfigurationError('config.http'));
        return;
    }

    httpBindingServer.app.set('port', config.getConfig().http.port);
    httpBindingServer.app.set('host', config.getConfig().http.host || '0.0.0.0');

    httpBindingServer.router.get(
        config.getConfig().iota.defaultResource || constants.HTTP_MEASURE_PATH,
        checkMandatoryParams(true),
        parseData,
        addTimestamp,
        handleIncomingMeasure,
        returnCommands
    );

    httpBindingServer.router.post(
        config.getConfig().iota.defaultResource || constants.HTTP_MEASURE_PATH,
        bodyParser.json({ strict: false }), // accept anything JSON.parse accepts
        checkMandatoryParams(false),
        parseDataMultipleMeasure,
        addTimestamp,
        handleIncomingMeasure,
        returnCommands
    );

    httpBindingServer.router.post(
        (config.getConfig().iota.defaultResource || constants.HTTP_MEASURE_PATH) +
            '/' +
            constants.MEASURES_SUFIX +
            '/:attrValue',
        parserBody(),
        checkMandatoryParams(false),
        parseData, // non multiple measures are expected in this route
        addTimestamp,
        handleIncomingMeasure,
        returnCommands
    );

    httpBindingServer.router.post(
        (config.getConfig().iota.defaultResource || constants.HTTP_MEASURE_PATH) + constants.HTTP_COMMANDS_PATH,
        bodyParser.json({ strict: false }), // accept anything JSON.parse accepts.
        checkMandatoryParams(false),
        parseData,
        addTimestamp,
        isCommand,
        handleIncomingMeasure,
        returnCommands
    );

    httpBindingServer.router.post(
        (config.getConfig().iota.defaultResource || constants.HTTP_MEASURE_PATH) + constants.HTTP_CONFIGURATION_PATH,
        bodyParser.json({ strict: false }), // accept anything JSON.parse accepts.
        checkMandatoryParams(false),
        parseData,
        handleConfigurationRequest
    );

    httpBindingServer.app.use(baseRoot, httpBindingServer.router);
    httpBindingServer.app.use(handleError);

    if (config.getConfig().http && config.getConfig().http.key && config.getConfig().http.cert) {
        const privateKey = fs.readFileSync(config.getConfig().http.key, 'utf8');
        const certificate = fs.readFileSync(config.getConfig().http.cert, 'utf8');
        const credentials = { key: privateKey, cert: certificate };

        config.getLogger().info(context, 'HTTPS Binding listening on port [%s]', config.getConfig().http.port);
        httpBindingServer.server = https.createServer(credentials, httpBindingServer.app);
    } else {
        config.getLogger().info(context, 'HTTP Binding listening on port [%s]', config.getConfig().http.port);
        httpBindingServer.server = http.createServer(httpBindingServer.app);
    }

    httpBindingServer.server.listen(httpBindingServer.app.get('port'), httpBindingServer.app.get('host'), callback);
}

function stop(callback) {
    config.getLogger().info(context, 'Stopping JSON HTTP Binding: ');

    if (httpBindingServer) {
        httpBindingServer.server.close(function () {
            config.getLogger().info(context, 'HTTP Binding Stopped');
            callback();
        });
    } else {
        callback();
    }
}

function sendPushNotifications(device, values, callback) {
    const executions = _.flatten(values.map(commandHandler.generateCommandExecution.bind(null, null, device)));

    async.series(executions, function (error) {
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
exports.deviceUpdatingHandler = deviceUpdatingHandler;
exports.notificationHandler = notificationHandler;
exports.executeCommand = executeCommand;
exports.protocol = 'HTTP';
