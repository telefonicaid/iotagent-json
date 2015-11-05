var config = {};

config.mqtt = {
    host: 'localhost',
    port: 1883,
    defaultKey: '1234'
};

config.iota = {
    logLevel: 'FATAL',
    contextBroker: {
        host: '10.11.128.16',
        port: '1026'
    },
    server: {
        port: 4041
    },
    deviceRegistry: {
        type: 'memory'
    },
    types: {},
    service: 'howtoService',
    subservice: '/howto',
    providerUrl: 'http://localhost:4041',
    deviceRegistrationDuration: 'P1M',
    defaultType: 'Thing'
};

module.exports = config;
