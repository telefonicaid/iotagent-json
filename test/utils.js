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

const fs = require('fs');
const request = require('iotagent-node-lib').request;

function readExampleFile(name, raw) {
    let text = null;
    try {
        text = fs.readFileSync(name, 'UTF8');
    } catch (e) {
        /* eslint-disable no-console */
        console.error(JSON.stringify(e));
    }
    return raw ? text : JSON.parse(text);
}

function delay(ms) {
    return function (callback) {
        setTimeout(callback, ms);
    };
}

exports.readExampleFile = readExampleFile;
exports.delay = delay;
exports.request = request;
