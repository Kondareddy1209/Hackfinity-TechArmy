// utils/emailSender.js
const nodemailer = require('nodemailer');

// Create a transporter using your Gmail account and the generated App Password
const transporter = nodemailer.createTransport({
    service: 'gmail', // Use 'gmail' for Gmail accounts
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail address (from .env)
        pass: process.env.EMAIL_APP_PASSWORD // Your generated App Password (from .env)
    }
});

const sendVerificationEmail = async (userEmail, token) => {
    // Make sure this matches your frontend URL for local testing or deployed domain
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    const mailOptions = {
        from: process.env.EMAIL_USER, // Sender email address
        to: userEmail,                // Recipient email address
        subject: 'Verify Your TechArMy Account',
        html: `
            <p>Hello,</p>
            <p>Thank you for registering with TechArMy! Please verify your email address by clicking the link below:</p>
            <p><a href="${verificationLink}">Click here to verify your email</a></p>
            <p>This link will expire in 24 hours. If you did not register for this service, please ignore this email.</p>
            <p>Regards,<br/>The TechArMy Team</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Verification email sent to: ${userEmail}`);
    } catch (error) {
        console.error(`Error sending verification email to ${userEmail}:`, error);
        throw new Error('Failed to send verification email. Please check server logs.');
    }
};

module.exports = sendVerificationEmail;