'use strict';

const nodemailer = require('nodemailer');

const smtpConfig = {
    host: 'smarthost.yahoo.com',
    port: 25
};

const transporter = nodemailer.createTransport(smtpConfig);

// setup email data with unicode symbols
const mailOptions = {
    from: '"Reetika Yahoo" <reetika@yahoo-inc.com>', // sender address
    to: 'r3rastogi@gmail.com', // list of receivers
    subject: 'Hello from Yahoo!', // Subject line
    text: 'Here is an email', // plain text body
    html: '<b>Lalala what a pretty email!</b><br><i>The prettiest email you ever did see!</i>' // html body
};

// send mail with defined transport object
transporter.sendMail(mailOptions, (error) => {
    if (error) {
        return error;
    }

    return 'success';
});
