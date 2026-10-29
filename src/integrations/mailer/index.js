// Outgoing email. Modules call the functions below; they never build a transport themselves.
// MAIL_TRANSPORT=log writes each message to the log instead of sending it (local development, tests).
const nodemailer = require('nodemailer');
const config = require('../../core/config/config');
const logger = require('../../core/logger');
const { emailVerificationFormat } = require('./templates/emailVerification');
const { forgotPasswordSendOTPFormat } = require('./templates/forgotPasswordOTP');

const transport = config.email.transport === 'smtp' ? nodemailer.createTransport(config.email.smtp) : null;

if (transport && config.env !== 'test') {
    transport.verify()
        .then(() => logger.info('Connected to the email server.'))
        .catch((error) => logger.warn(`Unable to connect to the email server: ${error.message}`));
}

// Sends one message. A failed send throws, so the caller's error handling sees it.
const sendMail = async ({ to, subject, text, html }) => {
    const message = { from: config.email.from, to, subject, text, html };
    if (!transport) {
        logger.info(`[mail to ${to}] ${subject}: ${text}`);
        return { messageId: 'log' };
    }
    return transport.sendMail(message);
};

const sendEmailVerification = (to, otp) => sendMail({
    to,
    subject: 'Please verify your email',
    text: `Your ${config.app_name} verification code is ${otp}. It is valid for 5 minutes. If you did not request this, you can ignore this email.`,
    html: emailVerificationFormat(otp),
});

const sendForgotPasswordOTP = (to, otp) => sendMail({
    to,
    subject: 'Forgot Password Request',
    text: `Your ${config.app_name} password reset code is ${otp}. It is valid for 5 minutes. If you did not request a password reset, you can ignore this email.`,
    html: forgotPasswordSendOTPFormat(otp),
});

const sendResetPasswordConfirmation = (to) => sendMail({
    to,
    subject: 'Successfully Changed password',
    text: 'Dear user,\nYour password has been changed successfully.\nIf you did not request this password reset, please contact support immediately.',
});

module.exports = { sendMail, sendEmailVerification, sendForgotPasswordOTP, sendResetPasswordConfirmation };
