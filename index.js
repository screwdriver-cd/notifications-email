'use strict';

const NotificationBase = require('screwdriver-notifications-base');
const Joi = require('joi');
const emailer = require('./email');
const tinytim = require('tinytim');
const path = require('path');

const COLOR_MAP = {
    SUCCESS: '3D9970',
    FAILURE: 'FF4136',
    ABORTED: '767676',
    RUNNING: '7FDBFF',
    QUEUED: 'FFDC00'
};
const DEFAULT_STATUSES = ['FAILURE'];
// Joi Schema Validation
const SCHEMA_ADDRESS = Joi.string().email();
const SCHEMA_ADDRESSES = Joi.array()
    .items(SCHEMA_ADDRESS)
    .min(0);
const SCHEMA_STATUS = Joi.string().valid(Object.keys(COLOR_MAP));
const SCHEMA_STATUSES = Joi.array()
    .items(SCHEMA_STATUS)
    .min(0);
const SCHEMA_EMAIL = Joi.alternatives().try(
    Joi.object().keys({ addresses: SCHEMA_ADDRESSES, statuses: SCHEMA_STATUSES }),
    SCHEMA_ADDRESS, SCHEMA_ADDRESSES
    );
const SCHEMA_BUILD_SETTINGS = Joi.object()
    .keys({
        email: SCHEMA_EMAIL.required()
    }).unknown(true);
const SCHEMA_SCM_REPO = Joi.object()
    .keys({
        name: Joi.string().required()
    }).unknown(true);
const SCHEMA_PIPELINE_DATA = Joi.object()
    .keys({
        scmRepo: SCHEMA_SCM_REPO.required()
    }).unknown(true);
const SCHEMA_BUILD_DATA = Joi.object()
    .keys({
        settings: SCHEMA_BUILD_SETTINGS.required(),
        status: SCHEMA_STATUS.required(),
        pipeline: SCHEMA_PIPELINE_DATA.required(),
        jobName: Joi.string(),
        build: Joi.object().keys({
            id: Joi.number().integer().required()
        }).unknown(true),
        event: Joi.object(),
        buildLink: Joi.string()
    });
const SCHEMA_SMTP_CONFIG = Joi.object()
    .keys({
        host: Joi.string().required(),
        port: Joi.number().integer().required(),
        from: SCHEMA_ADDRESS.required(),
        username: Joi.string(),
        password: Joi.string()
    });

class EmailNotifier extends NotificationBase {
    /**
    * Constructs an EmailNotifier
    * @constructor
    * @param {object} config - Screwdriver config object initialized in API
    */
    constructor(config) {
        super(...arguments);
        this.config = Joi.attempt(config, SCHEMA_SMTP_CONFIG,
            'Invalid config for email notifications');
    }

    /**
    * Sets listener on server event of name 'eventName' in Screwdriver
    * Currently, event is triggered with a build status is updated
    * @method _notify
    * @param {Object} buildData - Build data emitted with some event from Screwdriver
    */
    _notify(buildData) {
        // Check buildData format against SCHEMA_BUILD_DATA
        try {
            Joi.attempt(buildData, SCHEMA_BUILD_DATA, 'Invalid build data format');
        } catch (e) {
            return;
        }
        if (typeof buildData.settings.email === 'string' ||
            Array.isArray(buildData.settings.email)) {
            buildData.settings.email = {
                addresses: buildData.settings.email,
                statuses: DEFAULT_STATUSES
            };
        }

        if (!buildData.settings.email.statuses.includes(buildData.status)) {
            return;
        }

        const subject = `${buildData.status} - Screwdriver ${buildData.pipeline.scmRepo.name} ` +
            `${buildData.jobName} #${buildData.build.id}`;
        const message = `Build status: ${buildData.status}` +
            `\nBuild link:${buildData.buildLink}`;
        const html = tinytim.renderFile(path.resolve(__dirname, './template/email.html'), {
            buildStatus: buildData.status,
            buildLink: buildData.buildLink,
            buildId: buildData.build.id,
            statusColor: COLOR_MAP[buildData.status]
        });

        const mailOpts = {
            from: this.config.from,
            to: buildData.settings.email.addresses,
            subject,
            text: message,
            html
        };

        const smtpConfig = {
            host: this.config.host,
            port: this.config.port
        };

        if (this.config.username && this.config.password) {
            smtpConfig.auth = {
                user: this.config.username,
                pass: this.config.password
            };
        }

        emailer(mailOpts, smtpConfig);
    }
}

module.exports = EmailNotifier;
