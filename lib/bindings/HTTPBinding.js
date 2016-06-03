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
var iotAgentLib = require('iotagent-node-lib'),
    intoTrans = iotAgentLib.intoTrans,
    _ = require('underscore'),
    logger = require('logops'),
    async = require('async'),
    commandHandler = require('../commandHandler'),
    request = require('request'),
    errors = require('../errors'),
    express = require('express'),
    http = require('http'),
    commonBindings = require('../commonBindings'),
    bodyParser = require('body-parser'),
    constants = require('../constants'),
    apply = async.apply,
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

        logger.debug(context, 'Parsing payload [%s]', payload);

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

        logger.debug(context, 'Parsed data: [%j]', data);
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
        if (error || response.statusCode !== 200) {
            callback(new errors.HTTPCommandResponseError(response.statusCode, error));
        } else {
            process.nextTick(commandHandler.updateCommand.bind(null, apiKey, device, body, callback));
            callback();
        }
    });
}

function sendConfigurationToDevice(apiKey, deviceId, results, callback) {
    callback();
}

function addTimestamp(req, res, next) {
    if (req.query.t && req.jsonPayload) {
        for (var i = 0; i < req.jsonPayload.length; i++) {
            req.jsonPayload[i][constants.TIMESTAMP_ATTRIBUTE] = req.query.t;
        }
    }

    next();
}

function handleIncomingMeasure(req, res, next) {
    var values;

    logger.debug('Processing multiple HTTP measures for device [%s] with apiKey [%s]', req.deviceId, req.apiKey);

    function processHTTPWithDevice(device) {
        values = commonBindings.extractAttributes(device, req.jsonPayload);

        iotAgentLib.update(device.name, device.type, '', values, device, function(error) {
            if (error) {
                next(error);
                logger.error(context,
                    'Couldn\'t send the updated values to the Context Broker due to an error: %s', error);
            } else {
                logger.debug(context,
                    'Multiple measures for device [%s] with apiKey [%s] successfully updated',
                    req.deviceId, req.apiKey);
                res.status(200).send({});
            }
        });
    }

    function processDeviceMeasure(error, device) {
        if (error) {
            next(error);
        } else {
            var localContext = _.clone(context);

            localContext.service = device.service;
            localContext.subservice = device.subservice;

            intoTrans(localContext, processHTTPWithDevice)(device);
        }
    }

    function extractServiceAndSubservice(group, callback) {
        callback(null, group.service, group.subservice);
    }

    if (req.apiKey === config.getConfig().iota.defaultKey) {
        iotAgentLib.getDevicesByAttribute('id', req.deviceId, undefined, undefined, function(error, devices) {
            if (error) {
                next(error);
            } else if (devices && devices.length === 1) {
                processDeviceMeasure(null, devices[0]);
            } else {
                logger.error(context, 'Couldn\'t find device data for APIKey [%s] and DeviceId[%s]',
                    req.deviceId, req.apiKey);

                next(new errors.DeviceNotFound(req.deviceId));
            }
        });
    } else {
        async.waterfall([
            apply(iotAgentLib.getConfiguration, config.getConfig().iota.defaultResource, req.apiKey),
            extractServiceAndSubservice,
            apply(iotAgentLib.getDevice, req.deviceId)
        ], processDeviceMeasure);
    }
}

function handleError(error, req, res, next) {
    var code = 500;

    logger.debug(context, 'Error [%s] handing request: %s', error.name, error.message);

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
    if (!device.transport && device.endpoint) {
        device.transport = 'HTTP';
    }

    callback(null, device);
}

function start(callback) {
    var baseRoot = '/';

    httpBindingServer = {
        server: null,
        app: express(),
        router: express.Router()
    };

    if (!config.getConfig().http) {
        logger.fatal(context, 'Configuration error. Configuration object [config.http] is missing');
        callback(new errors.ConfigurationError('config.http'));
        return;
    }

    logger.info(context, 'HTTP Binding listening on port [%s]', config.getConfig().http.port);

    httpBindingServer.app.set('port', config.getConfig().http.port);
    httpBindingServer.app.set('host', config.getConfig().http.host || '0.0.0.0');

    httpBindingServer.router.post(
        config.getConfig().iota.defaultResource || constants.HTTP_MEASURE_PATH,
        bodyParser.json(),
        checkMandatoryParams(false),
        parseData,
        addTimestamp,
        handleIncomingMeasure);

    httpBindingServer.app.use(baseRoot, httpBindingServer.router);
    httpBindingServer.app.use(handleError);

    httpBindingServer.server = http.createServer(httpBindingServer.app);

    httpBindingServer.server.listen(httpBindingServer.app.get('port'), httpBindingServer.app.get('host'), callback);
}

function stop(callback) {
    logger.info(context, 'Stopping JSON HTTP Binding: ');

    if (httpBindingServer) {
        httpBindingServer.server.close(function() {
            logger.info('HTTP Binding Stopped');
            callback();
        });
    } else {
        callback();
    }
}

exports.start = start;
exports.stop = stop;
exports.sendConfigurationToDevice = sendConfigurationToDevice;
exports.deviceProvisioningHandler = deviceProvisioningHandler;
exports.executeCommand = executeCommand;
exports.protocol = 'HTTP';
