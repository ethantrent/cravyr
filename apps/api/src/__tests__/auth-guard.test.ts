import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server';

describe('Auth guard on protected endpoints', () => {
  const protectedRoutes = [
    { method: 'get', path: '/api/v1/recommendations?lat=37&lng=-122' },
    { method: 'post', path: '/api/v1/swipes' },
    { method: 'post', path: '/api/v1/saves' },
    { method: 'post', path: '/api/v1/notifications/register' },
    { method: 'delete', path: '/api/v1/users/me' },
  ];

  for (const route of protectedRoutes) {
    it(`${route.method.toUpperCase()} ${route.path} returns 401 without auth`, async () => {
      const agent = request(app) as any;
      const res = await agent[route.method](route.path);
      expect(res.status).toBe(401);
    });
  }

  it('returns 401 with invalid bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/recommendations?lat=37&lng=-122')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });
});
