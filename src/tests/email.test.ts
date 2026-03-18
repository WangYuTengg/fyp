import { describe, it, expect } from 'vitest';
import { buildPasswordResetEmail } from '../server/lib/email.js';

describe('Email Templates', () => {
  describe('buildPasswordResetEmail', () => {
    it('includes the reset URL in the email HTML', () => {
      const url = 'https://example.com/reset-password?token=abc123';
      const html = buildPasswordResetEmail(url);

      expect(html).toContain(url);
      expect(html).toContain('Password Reset Request');
      expect(html).toContain('href="https://example.com/reset-password?token=abc123"');
    });

    it('includes the reset link as plain text fallback', () => {
      const url = 'https://example.com/reset-password?token=abc123';
      const html = buildPasswordResetEmail(url);

      // Should have the URL in plain text too (for copy/paste)
      const urlOccurrences = html.split(url).length - 1;
      expect(urlOccurrences).toBeGreaterThanOrEqual(2); // In button href and plain text
    });

    it('includes expiry information', () => {
      const html = buildPasswordResetEmail('https://example.com/reset');
      expect(html).toContain('1 hour');
    });
  });
});
