'use strict';

const Joi = require('joi');

const SCHEMA_ADDRESS = Joi.string().email();
const SCHEMA_ADDRESSES = Joi.array()
    .items(SCHEMA_ADDRESS)
    .min(0);
const SCHEMA_STATUSES = Joi.array()
    .min(0);
const SCHEMA_EMAIL = Joi.object()
    .keys({
        addresses: SCHEMA_ADDRESSES,
        statuses: SCHEMA_STATUSES
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
        const message = DESCRIPTION_MAP[buildData.status];
    }

    constructor(config = {}, server) {
        this.config = Joi.attempt(config, Joi.object().keys({
            email: SCHEMA_EMAIL
        }).unknown(true), 'Invalid config for Notifications (Email)');
        this.server = server;
        server.on('notify', this.notify);
    }
}

module.exports = EmailNotifier;
