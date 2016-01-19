/*
 * Copyright 2016 Telefonica Investigación y Desarrollo, S.A.U
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
        op: 'IoTAgentMQTT.TimestampProcessPlugin'
    };

/**
 * Looks for Thinking Thing modules and parses them, updating the entity with the transformed value.
 *
 * @param {Object} entity           NGSI Entity as it would have been sent before the plugin.
 */
function updatePlugin(entity, entityType, callback) {
    var timestamp;

    function insertMetadata(element) {
        if (element.name !== 'TimeInstant') {
            element.metadatas = [{
                name: 'TimeInstant',
                type: 'timestamp',
                value: timestamp.value
            }];
        }

        return element;
    }

    if (entity.contextElements && entity.contextElements[0] && entity.contextElements[0].attributes) {
        for (var i in entity.contextElements[0].attributes) {
            if (entity.contextElements[0].attributes[i].name === 'TimeInstant') {
                timestamp = entity.contextElements[0].attributes[i];
            }
        }

        if (timestamp) {
            entity.contextElements[0].attributes = entity.contextElements[0].attributes.map(insertMetadata);
        }

        callback(null, entity, entityType);
    } else {
        logger.error(context, 'Bad payload received while processing timestamps');
        callback(new errors.BadPayload(entity));
    }

}

exports.updatePlugin = updatePlugin;
