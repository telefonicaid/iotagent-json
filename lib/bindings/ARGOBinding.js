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

const iotAgentLib = require('iotagent-node-lib');
const _ = require('underscore');
const async = require('async');
const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
require('body-parser-xml')(bodyParser);
const crypto = require('crypto');
const uuid = require('uuid');

const xml2js = require('xml2js');
const typeis = require('type-is');
const context = {
    op: 'IOTAJSON.ARGO.Binding'
};
let argoBindingServer;

// Unstream dependencies
const constants = require('../constants');
const errors = require('../errors');
const configService = require('../configService');
const retrieveDevice = require('../iotaUtils').retrieveDevice;
const guessType = require('../commonBindings').guessType;

/**
 * Reads environment variables specific to ARGO binding
 *
 * Do it here instead of extending the global
 * `processEnvironmentVariables` function, to avoid
 * changes upstream.
 */
function processEnvironmentVariables(logger, config) {
    const argoDisabled = process.env.IOTA_ARGO_DISABLED || 'true';
    if (argoDisabled) {
        const disabled = argoDisabled.toLowerCase().startsWith('f') ? false : true;
        logger.info('Setting IOTA_ARGO_DISABLED to environment value: %s', disabled);
        config.disabled = disabled;
    }
    const argoHost = process.env.IOTA_ARGO_HOST;
    if (argoHost) {
        logger.info('Setting IOTA_ARGO_HOST to environment value: %s', argoHost);
        config.host = argoHost;
    }
    const argoPort = process.env.IOTA_ARGO_PORT;
    if (argoPort) {
        logger.info('Setting IOTA_ARGO_PORT to environment value: %s', argoPort);
        config.port = parseInt(argoPort);
    }
    config.argoNamespace = process.env.IOTA_ARGO_NAMESPACE || 'missing_IOTA_ARGO_NAMESPACE';
    config.argoAction = process.env.IOTA_ARGO_ACTION || 'missing_IOTA_ARGO_ACTION';
    return config;
}

function checkPostContentType(...mimeTypes) {
    return function (req, res, next) {
        // use typeis.is on a trimmed header, instead of
        // req.is on the request, to work around
        // https://github.com/jshttp/type-is/issues/52
        const contentType = req.get('content-type').split(';').shift().trim();
        if (!typeis.hasBody(req) || !typeis.is(contentType, mimeTypes)) {
            return next(new errors.UnsupportedType(mimeTypes.join(', ')));
        }
        return next();
    };
}

/**
 * Check apiKey and deviceId are present
 */
function checkMandatoryParams(req, res, next) {
    const notFoundParams = [];
    req.apiKey = req.query.k;
    req.deviceId = req.query.i;

    if (!req.apiKey) {
        notFoundParams.push('API Key');
    }
    if (!req.deviceId) {
        notFoundParams.push('Device Id');
    }
    if (notFoundParams.length > 0) {
        return next(new errors.MandatoryParamsNotFound(notFoundParams));
    }
    return next();
}

class InvalidApiKey {
    constructor(apikey) {
        this.name = 'INVALID_API_KEY';
        this.message = 'Invalid API key [' + apikey + ']. Hashed API keys must have the format "hash.field.key"';
        this.code = 400;
    }
}

class InvalidHashSelector {
    constructor(hashSelector) {
        this.name = 'INVALID_API_KEY_SELECTOR';
        this.message = 'API Key requires hashing of empty or inexistent property ' + hashSelector;
        this.code = 400;
    }
}

// Find a nested property in an object.
// depth is just a safeguard against too deep recursion.
function findProperty(item, property, depth) {
    // safeguard agains null, undefined, or empty arrays
    if (!item || depth >= 16) {
        return null;
    }
    depth += 1;
    // Iterate over arrays
    if (item instanceof Array) {
        for (const subitem of item) {
            const result = findProperty(subitem, property, depth);
            if (result !== null) {
                return result;
            }
        }
        return null;
    }
    // If it is not an array or an object, nothing to find
    if (typeof item !== 'object') {
        return null;
    }
    for (const [name, subitem] of Object.entries(item)) {
        if (name === property) {
            // The way bodyparser-xml is configured, a property
            // can be converted to an array of 1 element, if it has
            // some attributes
            let value = subitem;
            while (value instanceof Array) {
                if (value.length === 0) {
                    return ''; // empty value found
                }
                value = value[0];
            }
            // Otherwise, bodyparser-xml might have converted
            // the property into an object, to preserve the attributes.
            // In that case, the actual value should be in
            // the property named "_" of the object.
            if (typeof value === 'object' && !(value instanceof String)) {
                if (!value || !_.has(value, '_')) {
                    return ''; // empty value found
                }
                value = value._;
            }
            // Value might still be null or undefined
            if (!value) {
                return '';
            }
            // Here, subitem should only be a primitive type
            // or a string
            return String(value).trim();
        }
        // If name doesn't match, do a deep search
        const result = findProperty(subitem, property, depth);
        if (result !== null) {
            return result;
        }
    }
    return null;
}

function apiKeyList(apiKey, body, callback) {
    const hashPrefix = 'hash.';
    if (!apiKey.startsWith(hashPrefix)) {
        return callback(null, [apiKey]);
    }
    // Hashing api keys have three parts:
    // <'hash' literal>:<field>:<key>
    //
    // The way they work is:
    // - We look for the value of field <field>
    //   in the payload.
    // - We calculate a HMAC-SHA256 of that
    //   value, using the secret key <key>
    // - We urlsafe-base64-encode the resulting hash,
    //   and truncate it to 20 characters
    // - We prepend the prefix "h256"
    // - And that is what is used as the
    //   actual API key in the mongo database.
    //
    // For testing, do:
    // node
    // const crypto = require('crypto')
    // let secret = 'key123';
    // let text = 'text123';
    // console.log("h256" + crypto.createHmac('sha256', secret).update(text).digest('base64url').slice(0, 20));
    const nextDot = apiKey.indexOf('.', hashPrefix.length);
    if (nextDot <= 0 || nextDot >= apiKey.length - 1) {
        return callback(new InvalidApiKey(apiKey), null);
    }
    const hashSecret = apiKey.slice(nextDot + 1);
    const hashSelector = apiKey.slice(hashPrefix.length, nextDot);
    const hashText = findProperty(body, hashSelector, 0);
    if (!hashText) {
        return callback(new InvalidHashSelector(hashSelector), null);
    }
    const hmac = crypto.createHmac('sha256', hashSecret);
    hmac.update(hashText);
    const hashedKey = 'h256' + hmac.digest('base64url').slice(0, 20);
    return callback(null, [hashedKey, hashSecret]);
}

/**
 * Middleware to add context to request
 */
function addLogContext(req, res, next) {
    const trans = uuid.v4();
    const corr = req.get('fiware-correlator') || trans;
    req.logContext = {
        path: req.path,
        op: req.url,
        //start: Date.now(),
        corr,
        trans,
        ...context
    };
    return next();
}

/**
 * Retreve the first device that matches any of the api keys in the keyList
 * @param {Object} reqContext the context to use when logging
 * @param {string} deviceId ID of the device
 * @param {Array} keyList list of API keys to try
 * @param {Function} callback the calback(error, device) to call
 */
function retrieveFirstDevice(reqContext, deviceId, keyList, callback) {
    const logger = configService.getLogger();
    const match = {
        device: null,
        error: null
    };
    return async.eachSeries(
        keyList,
        function (apiKey, done) {
            // If device already found, do nothing
            if (match.device) {
                // returning error = false is supposed to
                // cause the series to stop, we shouldn't be here
                logger.warn(reqContext, 'Unexpected API Key match retry');
                return done(false);
            }
            return retrieveDevice(deviceId, apiKey, function (error, device) {
                if (error) {
                    if (!error.code || error.code !== 404) {
                        // Errors other than "404 not found" are not retryable
                        return done(error);
                    }
                    match.error = error;
                    return done(); // keep trying
                }
                match.device = device;
                // set callback error to "false" to stop the series early
                // See https://caolan.github.io/async/v3/
                return done(false);
            });
        },
        function (error) {
            // If device found, ignore accumulated errors
            if (match.device) {
                return callback(null, match.device);
            }
            return callback(error || match.error);
        }
    );
}

/**
 * Middleware to handle incoming measures.
 */
function handleIncomingMeasure(req, res, next) {
    const logger = configService.getLogger();
    // We decide NOT to generate a new transaction (domain) at this
    // point. domain API is deprecated and it has been proven to be
    // very detrimental for performance, the way it is used here.
    // iotAgentLib.regenerateTransid(req.body);
    return async.waterfall(
        [
            // Convert api key to hash index, if required
            function (callback) {
                return apiKeyList(req.apiKey, req.body, function (error, keyList) {
                    if (error) {
                        logger.error(req.logContext, 'Error hashing api key: %j', error);
                        return callback(error);
                    }
                    return callback(null, keyList);
                });
            },

            // Get device information
            function (keyList, callback) {
                retrieveFirstDevice(req.logContext, req.deviceId, keyList, function (error, device) {
                    if (error) {
                        logger.error(req.logContext, 'Error retrieving device %s: %j', req.deviceId, error);
                        return callback(error);
                    }
                    req.logContext.service = device.service;
                    req.logContext.subservice = device.subservice;
                    return callback(null, device);
                });
            },

            // Update transaction data using device info
            // We decide NOT to generate a new transaction (domain) at this
            // point. domain API is deprecated and it has been proven to be
            // very detrimental for performance, the way it is used here.
            // function (device, callback) {
            // iotAgentLib.intoTrans(req.logContext, function () {
            // callback(null, device);
            // })();
            // },

            // Perfom the entity update
            function (device, callback) {
                const attrs = Object.keys(req.body).map((key) => ({
                    name: key,
                    type: guessType(key, device, null),
                    value: req.body[key]
                }));
                if (!attrs || attrs.length === 0) {
                    return callback();
                }
                return iotAgentLib.update(device.name, device.type, '', attrs, device, function (error) {
                    if (error) {
                        logger.error(req.logContext, 'Error updating device %s: %j', req.deviceId, error);
                    }
                    return callback(error);
                });
            }
        ],
        function (error) {
            // We decide NOT to generate a new transaction (domain) at this
            // point. domain API is deprecated and it has been proven to be
            // very detrimental for performance, the way it is used here.
            // iotAgentLib.finishSouthBoundTransaction(function () {
            // next(error);
            // });
            next(error);
        }
    );
}

/**
 * Default error handler for express
 */
function handleError(localConf) {
    return function (error, req, res, next) {
        if (res.headersSent) {
            return next(error);
        }
        return writeSoapEnvelope(localConf, res, error);
    };
}

/**
 * Send reply
 */
function argoReply(localConf) {
    return function (req, res, next) {
        return writeSoapEnvelope(localConf, res, null);
    };
}

/**
 * Write ARGO envelope as result
 */
function writeSoapEnvelope(localConf, res, error) {
    let message = 'OK';
    let status = 200;
    let returnCode = 0;
    if (error) {
        message = error.message || error;
        status = error.code && String(error.code).match(/^[2345]\d\d$/) ? error.code : 500;
        returnCode = status;
    }
    res.setHeader('content-type', `application/soap+xml; action="urn:${localConf.argoAction}"; charset=utf-8`);
    return res.status(status).send(`<?xml version="1.0" encoding="UTF-8"?>
    <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ser="${localConf.argoNamespace}">
        <soap:Header/>
        <soap:Body>
            <ser:${localConf.argoAction}>
                <ser:returnCode>${returnCode}</ser:returnCode>
                <ser:message>${message}</ser:message>
                <ser:IDCasoExterno/>
            </ser:${localConf.argoAction}>
        </soap:Body>
    </soap:Envelope>`);
}

/**
 * Start the ARGO binding
 */
function start(callback) {
    const logger = configService.getLogger();
    const upstreamConf = configService.getConfig();
    const localConf = processEnvironmentVariables(logger, {
        host: 'localhost',
        port: 7898,
        disabled: true
    });
    if (localConf.disabled) {
        // finish early if disabled
        return callback();
    }
    const bindingPort = localConf.port;
    const bindingHost = localConf.host || '0.0.0.0';
    const baseRoot = '/';
    const pathPrefix = upstreamConf.iota.defaultResource || constants.HTTP_MEASURE_PATH;

    const xmlStripPrefix = xml2js.processors.stripPrefix;
    const xmlOptions = {
        // Tell bodyparser-xml to not check the Content-Type header,
        // we will check it ourselves. This works around upstream bug
        // https://github.com/jshttp/type-is/issues/52
        type: () => true,
        xmlParseOptions: {
            // XML namespaces might change from one request to the next.
            // It is useful to remove them from the document,
            // to be able to refer to tags later in JEXL transformations.
            // See https://github.com/Leonidas-from-XIV/node-xml2js/issues/87
            tagNameProcessors: [xmlStripPrefix],
            attrNameProcessors: [xmlStripPrefix]
        }
    };

    const router = express.Router({ mergeParams: true });
    router.use(checkMandatoryParams);
    router.use(checkPostContentType('application/soap+xml'));
    router.use(bodyParser.xml(xmlOptions));
    router.use(addLogContext);

    router.post(
        [pathPrefix, constants.MEASURES_SUFIX, ':attrValue'].join('/'),
        // If the request URL has attrValue parameter,
        // wrap the whole payload in a single attribute
        function (req, res, next) {
            req.body = {
                [req.params.attrValue]: req.body
            };
            next();
        },
        handleIncomingMeasure,
        argoReply(localConf)
    );

    const app = express();
    app.set('port', bindingPort);
    app.set('host', bindingHost);
    app.use(baseRoot, router);
    app.use(handleError(localConf));

    logger.info(context, 'ARGO Binding listening on port %s', bindingPort);
    argoBindingServer = http.createServer(app);
    return argoBindingServer.listen(bindingPort, bindingHost, callback);
}

/**
 * Stop the argo binding
 */
function stop(callback) {
    const logger = configService.getLogger();
    logger.info(context, 'Stopping JSON ARGO Binding: ');

    if (argoBindingServer) {
        return argoBindingServer.close(function () {
            logger.info(context, 'ARGO Binding Stopped');
            argoBindingServer = null;
            return callback();
        });
    }
    return callback();
}

/**
 * sendConfigurationToDevice handler. Not implemented.
 */
function sendConfigurationToDevice(...args) {
    // TODO: Not implemented
    const logger = configService.getLogger();
    logger.error(context, 'sendConfigurationToDevice not implemented');
    const callback = args[args.length - 1];
    return callback();
}

/**
 * Device provisioning handler.
 *
 * @param {Object} device           Device object containing all the information about the provisioned device.
 */
function deviceProvisioningHandler(device, callback) {
    return callback(null, device);
}

/**
 * Device updating handler. This handler just fills in the transport protocol in case there is none.
 *
 * @param {Object} device           Device object containing all the information about the updated device.
 */
function deviceUpdatingHandler(device, callback) {
    return callback(null, device);
}

/**
 * Execute command handler. Not implemented.
 */
function executeCommand(...args) {
    // TODO: Not implemented
    const logger = configService.getLogger();
    logger.error(context, 'executeCommand not implemented');
    const callback = args[args.length - 1];
    return callback();
}

exports.apiKeyList = apiKeyList;
exports.start = start;
exports.stop = stop;
exports.sendConfigurationToDevice = sendConfigurationToDevice;
exports.deviceProvisioningHandler = deviceProvisioningHandler;
exports.deviceUpdatingHandler = deviceUpdatingHandler;
exports.executeCommand = executeCommand;
exports.protocol = 'ARGO';
