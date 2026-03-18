import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode('test-secret');

describe('Password Hashing (bcryptjs)', () => {
  it('hashes and verifies a password', async () => {
    const password = 'mySecurePassword123';
    const hash = await bcrypt.hash(password, 10);

    expect(hash).not.toBe(password);
    expect(await bcrypt.compare(password, hash)).toBe(true);
    expect(await bcrypt.compare('wrongPassword', hash)).toBe(false);
  });

  it('generates unique hashes for the same password', async () => {
    const password = 'mySecurePassword123';
    const hash1 = await bcrypt.hash(password, 10);
    const hash2 = await bcrypt.hash(password, 10);

    expect(hash1).not.toBe(hash2);
    expect(await bcrypt.compare(password, hash1)).toBe(true);
    expect(await bcrypt.compare(password, hash2)).toBe(true);
  });
});

describe('JWT Token Flow (jose)', () => {
  it('creates and verifies a token', async () => {
    const token = await new SignJWT({
      sub: 'user-123',
      email: 'test@example.com',
      role: 'admin',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    expect(typeof token).toBe('string');

    const { payload } = await jwtVerify(token, JWT_SECRET);
    expect(payload.sub).toBe('user-123');
    expect(payload.email).toBe('test@example.com');
    expect(payload.role).toBe('admin');
  });

  it('rejects token with wrong secret', async () => {
    const token = await new SignJWT({ sub: 'user-123' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    const wrongSecret = new TextEncoder().encode('wrong-secret');
    await expect(jwtVerify(token, wrongSecret)).rejects.toThrow();
  });

  it('rejects expired token', async () => {
    const token = await new SignJWT({ sub: 'user-123' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // Expired 1 hour ago
      .sign(JWT_SECRET);

    await expect(jwtVerify(token, JWT_SECRET)).rejects.toThrow();
  });
});
