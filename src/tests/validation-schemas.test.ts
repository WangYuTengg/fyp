import { describe, it, expect } from 'vitest';
import {
  createUserSchema,
  updateUserSchema,
  adminResetPasswordSchema,
  bulkCreateUsersSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  loginSchema,
} from '../server/lib/validation-schemas.js';

describe('Admin User Management Schemas', () => {
  describe('createUserSchema', () => {
    it('accepts valid user data', () => {
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
        role: 'student',
        password: 'Password1',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = createUserSchema.safeParse({
        email: 'not-an-email',
        name: 'Test User',
        role: 'student',
        password: 'Password1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
        name: '',
        role: 'student',
        password: 'Password1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid role', () => {
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
        role: 'superadmin',
        password: 'Password1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects short password', () => {
      const result = createUserSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
        role: 'student',
        password: '12345',
      });
      expect(result.success).toBe(false);
    });

    it('accepts all valid roles', () => {
      for (const role of ['admin', 'staff', 'student']) {
        const result = createUserSchema.safeParse({
          email: 'test@example.com',
          name: 'Test User',
          role,
          password: 'Password1',
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('updateUserSchema', () => {
    it('accepts partial updates', () => {
      expect(updateUserSchema.safeParse({ name: 'New Name' }).success).toBe(true);
      expect(updateUserSchema.safeParse({ role: 'staff' }).success).toBe(true);
      expect(updateUserSchema.safeParse({ isActive: false }).success).toBe(true);
      expect(updateUserSchema.safeParse({}).success).toBe(true);
    });

    it('rejects invalid role in update', () => {
      const result = updateUserSchema.safeParse({ role: 'invalid' });
      expect(result.success).toBe(false);
    });
  });

  describe('adminResetPasswordSchema', () => {
    it('accepts valid password', () => {
      const result = adminResetPasswordSchema.safeParse({ password: 'Newpass1' });
      expect(result.success).toBe(true);
    });

    it('rejects short password', () => {
      const result = adminResetPasswordSchema.safeParse({ password: '12345' });
      expect(result.success).toBe(false);
    });
  });

  describe('bulkCreateUsersSchema', () => {
    it('accepts valid bulk user data', () => {
      const result = bulkCreateUsersSchema.safeParse({
        users: [
          { email: 'a@example.com', name: 'User A', role: 'student', password: 'Pass1234' },
          { email: 'b@example.com', name: 'User B', role: 'staff', password: 'Pass4567' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty array', () => {
      const result = bulkCreateUsersSchema.safeParse({ users: [] });
      expect(result.success).toBe(false);
    });

    it('rejects when any user has invalid email', () => {
      const result = bulkCreateUsersSchema.safeParse({
        users: [
          { email: 'valid@example.com', name: 'User A', role: 'student', password: 'Pass1234' },
          { email: 'invalid', name: 'User B', role: 'student', password: 'Pass4567' },
        ],
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Password Reset Schemas', () => {
  describe('forgotPasswordSchema', () => {
    it('accepts valid email', () => {
      const result = forgotPasswordSchema.safeParse({ email: 'user@example.com' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = forgotPasswordSchema.safeParse({ email: 'bad' });
      expect(result.success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('accepts valid token and password', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'abc-123-def',
        password: 'Newpass1',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty token', () => {
      const result = resetPasswordSchema.safeParse({
        token: '',
        password: 'Newpass1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects short password', () => {
      const result = resetPasswordSchema.safeParse({
        token: 'abc-123',
        password: '12345',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('accepts valid credentials', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'Password1',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'not-email',
        password: 'Password1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty password', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });
});
