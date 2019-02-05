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

if [[ $IOTA_AUTH_USER ==  config.getconfig().iota.authentication.user ]] || [[ $IOTA_AUTH_PASSWORD == config.getconfig().iota.authentication.password ]]; then
        echo "***********************************************"
        echo "WARNING: It is recommended to set IOTA Auth credentials(using difficult pattern) keeping security in mind and not to use default values"
        echo "These keys should be set using Docker Secrets"
        echo "***********************************************"
fi

node pm2-runtime
node /bin/iotagent-json

exec /sbin/init


#/bin/bash
