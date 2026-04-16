import { describe, it, expect } from 'vitest';
import {
  SwipeBodySchema,
  SaveBodySchema,
  RegisterPushTokenSchema,
  LatLngQuerySchema,
  PhotoResolveQuerySchema,
} from '@cravyr/shared';

describe('SwipeBodySchema', () => {
  it('accepts valid swipe', () => {
    const result = SwipeBodySchema.safeParse({
      restaurant_id: '550e8400-e29b-41d4-a716-446655440000',
      direction: 'right',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid direction', () => {
    const result = SwipeBodySchema.safeParse({
      restaurant_id: '550e8400-e29b-41d4-a716-446655440000',
      direction: 'up',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-uuid restaurant_id', () => {
    const result = SwipeBodySchema.safeParse({
      restaurant_id: 'not-a-uuid',
      direction: 'left',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = SwipeBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('SaveBodySchema', () => {
  it('accepts valid save with default interaction_type', () => {
    const result = SaveBodySchema.safeParse({
      restaurant_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.interaction_type).toBe('right');
    }
  });

  it('accepts explicit superlike', () => {
    const result = SaveBodySchema.safeParse({
      restaurant_id: '550e8400-e29b-41d4-a716-446655440000',
      interaction_type: 'superlike',
    });
    expect(result.success).toBe(true);
  });
});

describe('RegisterPushTokenSchema', () => {
  it('accepts valid token', () => {
    const result = RegisterPushTokenSchema.safeParse({
      expo_push_token: 'ExponentPushToken[abc123]',
      platform: 'ios',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid platform', () => {
    const result = RegisterPushTokenSchema.safeParse({
      expo_push_token: 'ExponentPushToken[abc123]',
      platform: 'web',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty token', () => {
    const result = RegisterPushTokenSchema.safeParse({
      expo_push_token: '',
      platform: 'android',
    });
    expect(result.success).toBe(false);
  });
});

describe('LatLngQuerySchema', () => {
  it('coerces string coords to numbers', () => {
    const result = LatLngQuerySchema.safeParse({ lat: '37.7749', lng: '-122.4194' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lat).toBe(37.7749);
      expect(result.data.lng).toBe(-122.4194);
    }
  });

  it('rejects out-of-range lat', () => {
    const result = LatLngQuerySchema.safeParse({ lat: '91', lng: '0' });
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric values', () => {
    const result = LatLngQuerySchema.safeParse({ lat: 'abc', lng: '0' });
    expect(result.success).toBe(false);
  });
});

describe('PhotoResolveQuerySchema', () => {
  it('accepts valid photo name', () => {
    const result = PhotoResolveQuerySchema.safeParse({
      name: 'places/abc123/photos/xyz',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxWidth).toBe(600);
    }
  });

  it('rejects name without places/ prefix', () => {
    const result = PhotoResolveQuerySchema.safeParse({
      name: 'invalid/path',
    });
    expect(result.success).toBe(false);
  });

  it('coerces maxWidth from string', () => {
    const result = PhotoResolveQuerySchema.safeParse({
      name: 'places/abc/photos/xyz',
      maxWidth: '800',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxWidth).toBe(800);
    }
  });
});
