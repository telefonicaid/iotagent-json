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

module.exports = {
    MEASURES_SUFIX: 'attrs',
    CONFIGURATION_SUFIX: 'configuration',
    CONFIGURATION_COMMAND_SUFIX: 'commands',
    CONFIGURATION_COMMAND_UPDATE: 'cmdexe',
    CONFIGURATION_VALUES_SUFIX: 'values',

    DATE_FORMAT: 'yyyymmdd\'T\'HHMMss\'Z\'',

    HTTP_MEASURE_PATH: '/iot/d',
    HTTP_CONFIGURATION_PATH: '/configuration',

    TIMESTAMP_ATTRIBUTE: 'TimeInstant',
    TIMESTAMP_TYPE: 'ISO8601',

    DEFAULT_ATTRIBUTE_TYPE: 'string',

    COMMAND_STATUS_PENDING: 'PENDING',
    COMMAND_STATUS_ERROR: 'ERROR',
    COMMAND_STATUS_COMPLETED: 'OK'
};
