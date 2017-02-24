'use strict';

const Joi = require('joi');
const emailer = require('./email');

// Joi Schema Validation
const SCHEMA_ADDRESS = Joi.string().email();
const SCHEMA_ADDRESSES = Joi.array()
    .items(SCHEMA_ADDRESS)
    .min(0);
const SCHEMA_STATUS = Joi.string();
const SCHEMA_STATUSES = Joi.array()
    .items(SCHEMA_STATUS)
    .min(0);
const SCHEMA_BUILD_SETTINGS = Joi.alternatives().try(
    Joi.object().keys({ addresses: SCHEMA_ADDRESSES, statuses: SCHEMA_STATUSES }),
    Joi.string().email()
    );
const SCHEMA_BUILD_DATA = Joi.object()
    .keys({
        settings: SCHEMA_BUILD_SETTINGS,
        status: SCHEMA_STATUS
    });
const SCHEMA_SMTP_CONFIG = Joi.object()
    .keys({
        host: Joi.string(),
        port: Joi.number().integer(),
        from: Joi.string().email()
    });

const DESCRIPTION_MAP = {
    SUCCESS: 'Everything looks good!',
    FAILURE: 'Did not work as expected.',
    ABORTED: 'Aborted mid-flight',
    RUNNING: 'Testing your code...',
    QUEUED: 'Looking for a place to park...'
};
const DEFAULT_STATUSES = ['FAILURE'];

class EmailNotifier {
    constructor(inConfig, inServer, inEventName) {
        this.config = Joi.attempt(inConfig, SCHEMA_SMTP_CONFIG.unknown(true),
            'Invalid config for email notifications');
        this.server = inServer;
        this.eventName = inEventName; // The event that notify() will trigger a listener on
    }

    /**
    * Sets listener on server event of name 'eventName'
    * Currently, event is triggered with a build status is updated
    * @method notify
    * @return {Promise} resolves to false if status is not in notification statuses
    *                   resolves to emailer if status is in notification statuses
    */
    notify() {
        return new Promise((resolve) => {
            this.server.on(this.eventName, (buildData) => {
                // Check buildData format against SCHEMA_BUILD_DATA
                Joi.attempt(buildData, SCHEMA_BUILD_DATA, 'Invalid build data format');
                if (typeof buildData.settings === 'string' ||
                    buildData.settings instanceof String) {
                    buildData.settings = {
                        addresses: buildData.settings,
                        statuses: DEFAULT_STATUSES
                    };
                }

                if (buildData.settings.statuses.indexOf(buildData.status) <= -1) {
                    return resolve(null);
                }

                const message = DESCRIPTION_MAP[buildData.status];

                const mailOpts = {
                    from: this.config.from,
                    to: buildData.settings.addresses,
                    subject: `Screwdriver Build ${buildData.status}`,
                    text: message
                };

                const smtpConfig = {
                    host: this.config.host,
                    port: this.config.port
                };

                return resolve(emailer(mailOpts, smtpConfig));
            });
        });
    }
}

module.exports = EmailNotifier;
