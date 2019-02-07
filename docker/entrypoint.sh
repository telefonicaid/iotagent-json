#!/bin/sh

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
file_env 'IOTA_AUTH_ENABLED'

if [[ $IOTA_AUTH_ENABLED ==  "false" ]]; then
 echo "***********************************************"
 echo "WARNING: It is recommended to enable authentication for secure connection"
 echo "***********************************************"
else
    if [[ $IOTA_AUTH_USER ==  "" ]] || [[ $IOTA_AUTH_PASSWORD == "" ]]; then
        echo "***********************************************"
        echo "WARNING: It is recommended to set IOTA Auth credentials when using authentication"
        echo "These keys should be set using Docker Secrets"
        echo "***********************************************"
    fi
fi

pm2 start /bin/iotagent-json

/bin/bash
