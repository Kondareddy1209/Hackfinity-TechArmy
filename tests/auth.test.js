const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

describe('Authentication & User Model Logic Tests', () => {
    describe('Password Hashing & Verification Method', () => {
        it('should correctly verify valid password against hash using matchPassword', async () => {
            const rawPassword = 'SecurePassword123!';
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(rawPassword, salt);

            const userInstance = new User({
                firstName: 'Test',
                lastName: 'User',
                email: 'test@example.com',
                mobile: '1234567890',
                password: hashedPassword,
                gender: 'Male'
            });

            const isMatch = await userInstance.matchPassword(rawPassword);
            expect(isMatch).toBe(true);

            const isWrongMatch = await userInstance.matchPassword('WrongPassword');
            expect(isWrongMatch).toBe(false);
        });

        it('should return false for matchPassword if user has no password set (e.g. Google-only account)', async () => {
            const googleUser = new User({
                firstName: 'Google',
                lastName: 'User',
                email: 'google@example.com',
                googleId: 'google-oauth-id-12345',
                provider: 'google'
            });

            const isMatch = await googleUser.matchPassword('AnyPassword');
            expect(isMatch).toBe(false);
        });
    });

    describe('JWT Token Verification', () => {
        const secret = process.env.JWT_SECRET || 'test_secret_key';

        it('should sign and decode JWT token with user id payload', () => {
            const payload = { id: 'mockUserId123' };
            const token = jwt.sign(payload, secret, { expiresIn: '1h' });

            const decoded = jwt.verify(token, secret);
            expect(decoded.id).toEqual('mockUserId123');
        });

        it('should reject invalid or tampered JWT tokens', () => {
            const payload = { id: 'mockUserId123' };
            const token = jwt.sign(payload, 'different_secret', { expiresIn: '1h' });

            expect(() => {
                jwt.verify(token, secret);
            }).toThrow();
        });
    });
});
