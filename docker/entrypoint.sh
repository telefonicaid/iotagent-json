#!/bin/sh

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

if [[ ${IOTA_MONGO_PORT} =~ ^http://(.*):(.*)+$ ]] ; then
    export IOTA_MONGO_PORT=${BASH_REMATCH[2]}
    export IOTA_MONGO_HOST=${BASH_REMATCH[1]}
    
fi

if [[ ${IOTA_CB_PORT} =~ ^http://(.*):(.*)+$ ]] ; then
    export IOTA_CB_PORT=${BASH_REMATCH[2]}
    export IOTA_CB_HOST=${BASH_REMATCH[1]}
fi

export HOST_IP=`awk 'NR==1{print $1}' /etc/hosts`

echo "HOST IP: $HOST_IP"
echo "MONGODB HOST: $IOTA_MONGO_HOST"
echo "MONGODB PORT: $IOTA_MONGO_PORT"
echo "ORION CB HOST: $IOTA_CB_HOST"
echo "ORION CB PORT: $IOTA_CB_PORT"


sed -i /lib/configService.js \
        -e "s|IOTA_CB_HOST|${IOTA_CB_HOST}|g" \
        -e "s|IOTA_CB_PORT|${IOTA_CB_PORT}|g" \
        -e "s|IOTA_MONGO_HOST|${IOTA_MONGO_HOST}|g" \
    -e "s|IOTA_MONGO_PORT|${IOTA_MONGO_PORT}|g" \
    -e "s|IOTA_AUTH_HOST|${IOTA_AUTH_HOST}|g" \
    -e "s|IOTA_AUTH_PORT|${IOTA_AUTH_PORT}|g" \
    -e "s|IOTA_AUTH_USER|${IOTA_AUTH_USER}|g" \
    -e "s|IOTA_AUTH_PASSWORD|${IOTA_AUTH_PASSWORD}|g" \
    -e "s|IOTA_AUTH_PERMANENT_TOKEN|${IOTA_AUTH_PERMANENT_TOKEN}|g" \
    -e "s|IOTA_PROVIDER_URL|${IOTA_PROVIDER_URL}|g" \
    -e "s|IOTA_IOTAM_HOST|${IOTA_IOTAM_HOST}|g"



exec /sbin/init




#/bin/bash
