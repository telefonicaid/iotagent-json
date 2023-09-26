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

class InvalidResource {
    constructor() {
        this.name = 'INVALID_RESOURCE';
        this.message = 'MQTT+JSON Groups must have an empty resource field.';
        this.code = 400;
    }
}
class BadPayload {
    constructor(payload) {
        this.name = 'BAD_PAYLOAD';
        this.message = 'The request payload [' + payload + '] could not be parsed';
        this.code = 400;
    }
}
class GroupNotFound {
    constructor(service, subservice) {
        this.name = 'GROUP_NOT_FOUND';
        this.message = 'Group not found for service [' + service + '] and subservice [' + subservice + ']';
    }
}
class MandatoryParamsNotFound {
    constructor(paramList) {
        this.name = 'MANDATORY_PARAMS_NOT_FOUND';
        this.message = "Some of the mandatory params weren't found in the request: " + JSON.stringify(paramList);
        this.code = 400;
    }
}
class UnsupportedType {
    constructor(expectedType) {
        this.name = 'UNSUPPORTED_TYPE';
        this.message =
            //prettier-ignore

            "The request content didn't have the expected type [" + expectedType + " ]";

        this.code = 400;
    }
}
class DeviceNotFound {
    constructor(deviceId) {
        this.name = 'DEVICE_NOT_FOUND';
        this.message = 'Device not found with ID [' + deviceId + ']';
        this.code = 404;
    }
}
class ConfigurationError {
    constructor(parameter) {
        this.name = 'CONFIGURATION_ERROR';
        this.message = 'Mandatory configuration parameter not found: ' + parameter;
        this.code = 500;
    }
}
class HTTPCommandResponseError {
    constructor(code, error) {
        this.name = 'HTTP_COMMAND_RESPONSE_ERROR';
        this.message =
            'There was an error in the response of a device to a command [' + code + ' ]:' + JSON.stringify(error);
        this.code = 400;
    }
}
class EndpointNotFound {
    constructor(id) {
        this.name = 'ENDPOINT_NOT_FOUND';
        this.message = 'The provisioned device [' + id + ' ] did not have an HTTP endpoint to call';
        this.code = 400;
    }
}
class DeviceEndpointError {
    constructor(code, msg) {
        this.name = 'DEVICE_ENDPOINT_ERROR';
        this.message =
            'Request to the device ended up in error with code [' +
            code +
            ' ] and message [' +
            JSON.stringify(msg) +
            ']';
        this.code = code;
    }
}

module.exports = {
    InvalidResource,
    BadPayload,
    GroupNotFound,
    MandatoryParamsNotFound,
    UnsupportedType,
    DeviceNotFound,
    ConfigurationError,
    HTTPCommandResponseError,
    EndpointNotFound,
    DeviceEndpointError
};
