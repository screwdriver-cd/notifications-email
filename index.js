'use strict';

const Joi = require('joi');

const SCHEMA_ADDRESS = Joi.string().email();
const SCHEMA_ADDRESSES = Joi.array()
    .items(SCHEMA_ADDRESS)
    .min(0);
const SCHEMA_STATUS = Joi.string();
const SCHEMA_BUILD_DATA = Joi.object()
    .keys({
        addresses: SCHEMA_ADDRESSES,
        status: SCHEMA_STATUS
    });

const SCHEMA_SMTP_CONFIG = Joi.object()
    .keys({
        host: Joi.string(),
        port: Joi.number().integer()
    });

const DESCRIPTION_MAP = {
    SUCCESS: 'Everything looks good!',
    FAILURE: 'Did not work as expected.',
    ABORTED: 'Aborted mid-flight',
    RUNNING: 'Testing your code...',
    QUEUED: 'Looking for a place to park...'
};

class EmailNotifier {
    notify(buildData) {
        Joi.attempt(buildData, SCHEMA_BUILD_DATA, 'Invalid build data format');
        const message = DESCRIPTION_MAP[buildData.status];
    }

    constructor(config = {}, server) {
        this.config = Joi.attempt(config, SCHEMA_SMTP_CONFIG.unknown(true),
            'Invalid config for Notifications (Email)');
        this.server = server;
        server.on('notify', this.notify);
    }
}

module.exports = EmailNotifier;
