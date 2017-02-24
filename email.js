'use strict';
var nodemailer = require('nodemailer');

var smtpConfig = {
    host: 'smarthost.yahoo.com',
    port: 25
};

var transporter = nodemailer.createTransport(smtpConfig);

// setup email data with unicode symbols
let mailOptions = {
    from: '"Reetika Yahoo" <reetika@yahoo-inc.com>', // sender address
    to: 'r3rastogi@gmail.com', // list of receivers
    subject: 'Hello from Yahoo!', // Subject line
    text: 'Here is an email', // plain text body
    html: '<b>Lalala what a pretty email!</b><br><i>The prettiest email you ever did see!</i>' // html body
};

// send mail with defined transport object
transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        return console.log(error);
    }
    console.log('Message %s sent: %s', info.messageId, info.response);
});
