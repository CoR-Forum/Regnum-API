const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { User } = require('./models');
const app = require('./index');

describe('API Tests', () => {
    beforeAll(async () => {
        await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    test('GET /api/v2/status should return API status', async () => {
        const response = await request(app).get('/api/v2/status');
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
    });

    test('POST /api/v2/login should return error for invalid credentials', async () => {
        const response = await request(app)
            .post('/api/v2/login')
            .send({ username: 'invalidUser', password: 'invalidPass' });
        expect(response.status).toBe(401);
        expect(response.body.status).toBe('error');
    });

    test('POST /api/v2/register should return error for missing fields', async () => {
        const response = await request(app)
            .post('/api/v2/register')
            .send({ username: '', password: '', email: '' });
        expect(response.status).toBe(400);
        expect(response.body.status).toBe('error');
    });

    test('POST /api/v2/register should create a new user', async () => {
        const response = await request(app)
            .post('/api/v2/register')
            .send({ username: 'testUser', password: 'testPass123', email: 'test@example.com' });
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
    });

    test('POST /api/v2/login should login with valid credentials', async () => {
        const response = await request(app)
            .post('/api/v2/login')
            .send({ username: 'testUser', password: 'testPass123' });
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
    });
});