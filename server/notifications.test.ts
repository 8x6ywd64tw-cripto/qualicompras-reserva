import { describe, it, expect } from 'vitest';

describe('Notifications - VAPID Keys', () => {
  it('should have VAPID_PUBLIC_KEY set', () => {
    const key = process.env.VAPID_PUBLIC_KEY;
    expect(key).toBeDefined();
    expect(typeof key).toBe('string');
    expect(key!.length).toBeGreaterThan(10);
  });

  it('should have VAPID_PRIVATE_KEY set', () => {
    const key = process.env.VAPID_PRIVATE_KEY;
    expect(key).toBeDefined();
    expect(typeof key).toBe('string');
    expect(key!.length).toBeGreaterThan(10);
  });

  it('VAPID keys should be valid base64url format', () => {
    const pubKey = process.env.VAPID_PUBLIC_KEY!;
    const privKey = process.env.VAPID_PRIVATE_KEY!;
    const base64urlRegex = /^[A-Za-z0-9_-]+$/;
    expect(pubKey).toMatch(base64urlRegex);
    expect(privKey).toMatch(base64urlRegex);
  });
});
