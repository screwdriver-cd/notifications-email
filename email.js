'use strict';

const nodemailer = require('nodemailer');

/**
* Sends email message
* @param {Object} mailOpts
* @param {String} mailOpts.from           sender email address (must be compatible with smtp)
* @param {(String|String[])} mailOpts.to  recipient(s) of email
* @param {String} mailOpts.subject        subject of email
* @param {String} mailOpts.text           plain text body of email
* @param {String} mailOpts.html           html body of email
* @param {Object} smtpConfig
* @param {String} smtpConfig.host         smtp server host url
* @param {Number} smtpConfig.port         smtp host port (e.g. 25)
* @param {String} [smtpConfig.auth.user]  smtp username
* @param {String} [smtpConfig.auth.pass]  smtp password
*/
module.exports = (mailOpts, smtpConfig) => {
    const transporter = nodemailer.createTransport(smtpConfig);

    transporter.sendMail(mailOpts, (error) => {
        if (error) {
            // eslint-disable-next-line no-console
            console.error(error);
        }
    });
};
