/**
 * @file tests/location-privacy.test.ts
 * @description Ensures sensitive location fields are never exposed in API responses.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDummyUser, clearDatabase, getAuthToken } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import type { FastifyInstance } from 'fastify';

const SENSITIVE_FIELDS = new Set(['latitude', 'longitude', 'locationSecret']);

function assertNoSensitiveFields(payload: any) {
  if (payload === null || payload === undefined) return;
  if (Array.isArray(payload)) {
    payload.forEach(assertNoSensitiveFields);
    return;
  }
  if (typeof payload === 'object') {
    for (const key of Object.keys(payload)) {
      if (SENSITIVE_FIELDS.has(key)) {
        throw new Error(`Sensitive field leaked: ${key}`);
      }
      assertNoSensitiveFields(payload[key]);
    }
  }
}

describe('Location Privacy - Response Sanitization', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  it('does not expose sensitive location fields in /api/feed', async () => {
    const authToken = await getAuthToken('ignored', 'ignored');
    const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!me) throw new Error('Missing auth user');

    await prisma.user.update({
      where: { id: me.id },
      data: { latitude: 37.7749, longitude: -122.4194, locationSecret: 'secret' },
    });

    await createDummyUser('FeedUser', {
      latitude: 40.7128,
      longitude: -74.0060,
      locationSecret: 'other-secret',
      locationSharing: 'always',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/feed',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(() => assertNoSensitiveFields(body)).not.toThrow();
  });

  it('does not expose sensitive location fields in /api/likes/received', async () => {
    const authToken = await getAuthToken('ignored', 'ignored');
    const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!me) throw new Error('Missing auth user');

    const liker = await createDummyUser('LikerUser', {
      latitude: 51.5074,
      longitude: -0.1278,
      locationSecret: 'liker-secret',
    });

    await prisma.like.create({
      data: {
        likerId: liker.id,
        likedId: me.id,
        liked: true,
        message: 'This is a long enough intro message for testing purposes.',
        status: 'active',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/likes/received',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(() => assertNoSensitiveFields(body)).not.toThrow();
  });

  it('does not expose sensitive location fields in /api/matches', async () => {
    const authToken = await getAuthToken('ignored', 'ignored');
    const me = await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!me) throw new Error('Missing auth user');

    const other = await createDummyUser('MatchedUser', {
      latitude: 48.8566,
      longitude: 2.3522,
      locationSecret: 'match-secret',
    });

    const [user1Id, user2Id] = [me.id, other.id].sort();
    await prisma.match.create({
      data: {
        user1Id,
        user2Id,
        status: 'active',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/matches',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(() => assertNoSensitiveFields(body)).not.toThrow();
  });
});
