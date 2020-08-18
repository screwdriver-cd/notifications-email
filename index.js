'use strict';

const NotificationBase = require('screwdriver-notifications-base');
const Hoek = require('hoek');
const Joi = require('joi');
const emailer = require('./email');
const tinytim = require('tinytim');
const path = require('path');

// See also COLOR_MAP in Slack Notification.
// https://github.com/screwdriver-cd/notifications-slack/blob/master/index.js#L10
const COLOR_MAP = {
    ABORTED: '767676',
    CREATED: '0B548C',
    FAILURE: 'FF4000',
    QUEUED: '669999',
    RUNNING: '0F69FF',
    SUCCESS: '00CC00',
    BLOCKED: 'CCC',
    UNSTABLE: 'FFD333',
    COLLAPSED: 'F2F2F2',
    FIXED: '00CC00',
    FROZEN: 'ACD9FF'
};
const DEFAULT_STATUSES = ['FAILURE'];
// Joi Schema Validation
const SCHEMA_ADDRESS = Joi.string().email();
const SCHEMA_ADDRESSES = Joi.array()
    .items(SCHEMA_ADDRESS)
    .min(1);
const SCHEMA_STATUS = Joi.string().valid(Object.keys(COLOR_MAP));
const SCHEMA_STATUSES = Joi.array()
    .items(SCHEMA_STATUS)
    .min(1);
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
        buildLink: Joi.string(),
        isFixed: Joi.boolean()
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

        const emailSettings = Hoek.reach(buildData, 'settings.email');

        // Convert shorthand config to object
        // ie: 'email: [test@email.com, test2@email.com]' or 'email: test@email.com'
        if (typeof emailSettings === 'string' || Array.isArray(emailSettings)) {
            buildData.settings.email = {
                addresses: emailSettings
            };
        }

        // Make sure statuses are set
        const defaultSettings = {
            statuses: DEFAULT_STATUSES
        };

        buildData.settings.email = Object.assign(defaultSettings, buildData.settings.email);

        const statuses = Hoek.reach(buildData, 'settings.email.statuses');

        // Add for fixed notification
        if (!statuses.includes('SUCCESS') && buildData.isFixed) {
            statuses.push('SUCCESS');
        }
        // Short circuit if status does not match
        if (!statuses.includes(buildData.status)) {
            return;
        }

        let notificationStatus = buildData.status;

        if (statuses.includes('FAILURE')) {
            if (buildData.status === 'SUCCESS' && buildData.isFixed) {
                notificationStatus = 'FIXED';
            }
        }

        const changedFiles = Hoek.reach(buildData, 'build.meta.commit.changedFiles').split(',');

        let changedFilesStr = '';

        if (changedFiles.length > 0 && changedFiles[0] !== '') {
            changedFiles.forEach((file) => {
                const li = '<li>{{contents}}</li>';

                changedFilesStr += tinytim.tim(li, { contents: file });
            });
        } else {
            changedFilesStr = 'There are no changed files.';
        }

        const ul = '<ul>{{list}}</ul>';

        changedFilesStr = tinytim.tim(ul, { list: changedFilesStr });

        const subject = `${notificationStatus} - Screwdriver ` +
            `${Hoek.reach(buildData, 'pipeline.scmRepo.name')} ` +
            `${buildData.jobName} #${Hoek.reach(buildData, 'build.id')}`;
        const message = `Build status: ${notificationStatus}` +
            `\nBuild link:${buildData.buildLink}`;
        const commitSha = Hoek.reach(buildData, 'build.meta.build.sha').slice(0, 7);
        const commitMessage = Hoek.reach(buildData, 'build.meta.commit.message');
        const commitLink = Hoek.reach(buildData, 'build.meta.commit.url');
        const html = tinytim.renderFile(path.resolve(__dirname, './template/email.html'), {
            buildStatus: notificationStatus,
            buildLink: buildData.buildLink,
            buildId: buildData.build.id,
            changedFiles: changedFilesStr,
            commitSha,
            commitMessage,
            commitLink,
            statusColor: COLOR_MAP[buildData.status]
        });

        const mailOpts = {
            from: this.config.from,
            to: Hoek.reach(buildData, 'settings.email.addresses'),
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

    // Validate the settings email object
    static validateConfig(config) {
        return Joi.validate(config, SCHEMA_EMAIL);
    }
}

module.exports = EmailNotifier;
