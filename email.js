'use strict';

const nodemailer = require('nodemailer');

/**
* Sends email message
* @param {object} mailOpts                keys described below
* @param {string} mailOpts.from           sender email address (must be compatible with smtp)
* @param {(string|string[])} mailOpts.to  recipient(s) of email
* @param {string} mailOpts.subject        subject of email
* @param {string} mailOpts.text           plain text body of email
* @param {string} mailOpts.html           html body of email
* @param {object} smtpConfig              keys described below
* @param {string} smtpConfig.host         smtp server host url
* @param {number} smtpConfig.port         smtp host port (e.g. 25)
* @return {Promise}                       resolves if email is sent
*/
module.exports = (mailOpts, smtpConfig) => {
    const transporter = nodemailer.createTransport(smtpConfig);

    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOpts, (error) => {
            if (error) {
                return reject(error);
            }

            return resolve();
        });
    });
};
