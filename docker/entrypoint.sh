#!/bin/bash
#
# Copyright 2019 Telefonica Investigación y Desarrollo, S.A.U
#
# This file is part of iotagent-json
#
# iotagent-json is free software: you can redistribute it and/or
# modify it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the License,
# or (at your option) any later version.
#
# iotagent-json is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
# See the GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public
# License along with iotagent-ul. If not, see http://www.gnu.org/licenses/.
#
# For those usages not covered by the GNU Affero General Public License please contact
# with iot_support at tid dot es
#

# usage: file_env VAR [DEFAULT]
#    ie: file_env 'XYZ_DB_PASSWORD' 'example'
# (will allow for "$XYZ_DB_PASSWORD_FILE" to fill in the value of
#  "$XYZ_DB_PASSWORD" from a file, especially for Docker's secrets feature)
file_env() {
    local var="$1"
    local fileVar="${var}_FILE"
    local def="${2:-}"
    if [ "${!var:-}" ] && [ "${!fileVar:-}" ]; then
        echo >&2 "error: both $var and $fileVar are set (but are exclusive)"
        exit 1
    fi
    local val="$def"
    if [ "${!var:-}" ]; then
        val="${!var}"
    elif [ "${!fileVar:-}" ]; then
        val="$(< "${!fileVar}")"
    fi
    export "$var"="$val"
    unset "$fileVar"
}

file_env 'IOTA_AUTH_USER'
file_env 'IOTA_AUTH_PASSWORD'
file_env 'IOTA_AUTH_CLIENT_ID'
file_env 'IOTA_AUTH_CLIENT_SECRET'

if [[  -z "$IOTA_AUTH_ENABLED" ]]; then
 echo "***********************************************"
 echo "WARNING: It is recommended to enable authentication for secure connection"
 echo "***********************************************"
else
    if  [[ -z "$IOTA_AUTH_USER" ]] || [[ -z "$IOTA_AUTH_PASSWORD" ]]; then
        echo "***********************************************"
        echo "WARNING: Default IoT Agent Auth credentials have not been overridden"
        echo "***********************************************"
    else
        echo "***********************************************"
        echo "INFO: IoT Agent Auth credentials have been overridden"
        echo "***********************************************"
    fi
fi

if [[  -z "$PM2_ENABLED" ]]; then
    echo "INFO: IoT Agent running standalone"
    node bin/iotagent-json
else
    echo "***********************************************"
    echo "INFO: IoT Agent encapsulated by pm2-runtime see https://pm2.io/doc/en/runtime/integration/docker/"
    echo "***********************************************"
    pm2-runtime bin/iotagent-json
fi
