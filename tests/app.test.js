const request = require('supertest');
const mongoose = require('mongoose');

// Ensure NODE_ENV is set to test
process.env.NODE_ENV = 'test';

const app = require('../app');

describe('Application Core & Route Security Tests', () => {
    afterAll(async () => {
        // Disconnect mongoose if connected to ensure clean test exit
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });

    describe('Public Routes', () => {
        it('GET / should render the landing page for unauthenticated visitors', async () => {
            const res = await request(app).get('/');
            expect(res.statusCode).toEqual(200);
            expect(res.text).toContain('<!DOCTYPE html>');
        });

        it('GET /team should render the team page with member profiles', async () => {
            const res = await request(app).get('/team');
            expect(res.statusCode).toEqual(200);
            expect(res.text).toContain('Meet Our Team');
        });

        it('GET /health should return JSON system health status', async () => {
            const res = await request(app).get('/health');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('status', 'UP');
            expect(res.body).toHaveProperty('database');
        });

        it('GET /non-existent-route should render 404 page', async () => {
            const res = await request(app).get('/non-existent-route');
            expect(res.statusCode).toEqual(404);
            expect(res.text).toContain('404');
            expect(res.text).toContain('Page Not Found');
        });
    });

    describe('Authentication Page Routes', () => {
        it('GET /auth/login should render login page', async () => {
            const res = await request(app).get('/auth/login');
            expect(res.statusCode).toEqual(200);
        });

        it('GET /auth/signup should render signup page', async () => {
            const res = await request(app).get('/auth/signup');
            expect(res.statusCode).toEqual(200);
        });

        it('GET /auth/forgot-password should render forgot password page', async () => {
            const res = await request(app).get('/auth/forgot-password');
            expect(res.statusCode).toEqual(200);
        });

        it('GET /auth/admin-login should render admin login page', async () => {
            const res = await request(app).get('/auth/admin-login');
            expect(res.statusCode).toEqual(200);
        });
    });

    describe('Protected Route Security Guards (Unauthenticated Requests)', () => {
        it('GET /user/my-catalog should redirect unauthenticated requests to /auth/login', async () => {
            const res = await request(app).get('/user/my-catalog');
            expect(res.statusCode).toEqual(302);
            expect(res.headers.location).toEqual('/auth/login');
        });

        it('GET /admin/users should redirect unauthenticated requests to /auth/login', async () => {
            const res = await request(app).get('/admin/users');
            expect(res.statusCode).toEqual(302);
            expect(res.headers.location).toEqual('/auth/login');
        });

        it('GET /api/products should return 401 Unauthorized for unauthenticated API requests', async () => {
            const res = await request(app).get('/api/products');
            expect(res.statusCode).toEqual(401);
            expect(res.body).toHaveProperty('success', false);
            expect(res.body.error).toContain('Unauthorized');
        });

        it('POST /api/grok-chat should return 401 Unauthorized for unauthenticated API requests', async () => {
            const res = await request(app)
                .post('/api/grok-chat')
                .send({ message: 'Hello' });
            expect(res.statusCode).toEqual(401);
            expect(res.body).toHaveProperty('success', false);
        });
    });
});
