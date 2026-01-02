const request = require('supertest');
const mongoose = require('mongoose');

// Mock mongoose.connect to prevent actual DB connection during tests
// We need to do this before requiring the app
const connectSpy = jest.spyOn(mongoose, 'connect').mockImplementation(() => Promise.resolve());

const app = require('../app');

describe('Sanity Check', () => {
    afterAll(async () => {
        jest.restoreAllMocks();
    });

    it('GET / should return 200 OK', async () => {
        const res = await request(app).get('/');
        // If the user is not logged in, it renders 'index' (200). 
        // If it redirects, it would be 302, but without session/cookies, it should represent a logged-out user.
        expect(res.statusCode).toEqual(200);
    });

    it('GET /404 should return 404', async () => {
        const res = await request(app).get('/this-route-does-not-exist');
        expect(res.statusCode).toEqual(404);
    });
});
