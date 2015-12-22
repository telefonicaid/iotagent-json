/*
 * Copyright 2015 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of iotagent-mqtt
 *
 * iotagent-mqtt is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * iotagent-mqtt is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with iotagent-mqtt.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 */

'use strict';

var errors = require('./errors'),
    logger = require('logops'),
    context = {
        op: 'IoTAgentMQTT.ThinkingThingsPlugin'
    };

function parseGSM(fields) {
    var result = [];

    logger.debug(context, 'Parsing GSM module: %s', JSON.stringify(fields, null, 4));

    if (fields.length >= 7) {
        result.push({
            name: 'mcc',
            type: 'string',
            value: fields[2]
        });
        result.push({
            name: 'mnc',
            type: 'string',
            value: fields[3]
        });
        result.push({
            name: 'lac',
            type: 'string',
            value: fields[4]
        });
        result.push({
            name: 'cell-id',
            type: 'string',
            value: fields[5]
        });
        result.push({
            name: 'dbm',
            type: 'string',
            value: fields[6]
        });

        return result;
    } else {
        logger.error(context, 'Too few fields parsing GSM module');
        return [];
    }
}

function modifyAttributes(attribute) {
    var rawValue = '0,' + attribute.name + ',' + attribute.value,
        fields = rawValue.split(',');

    switch (attribute.name) {
        case 'P1':
            attribute.value = parseGSM(fields);
            attribute.type = 'compound';
            break;
    }

    return attribute;
}

function updatePlugin(entity, callback) {
    if (entity.contextElements && entity.contextElements[0] && entity.contextElements[0].attributes) {
        var moduleAttributes = entity.contextElements[0].attributes.map(modifyAttributes);

        entity.contextElements[0].attributes = moduleAttributes;

        callback(null, entity);
    } else {
        callback(new errors.BadPayload(entity));
    }

}

exports.updatePlugin = updatePlugin;
