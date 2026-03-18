import { describe, it, expect } from 'vitest';

// Re-implement the CSV parser for testing (same logic as BulkCreateModal)
type ParsedRow = {
  email: string;
  name: string;
  role: 'admin' | 'staff' | 'student';
  password: string;
  lineNumber: number;
};
type ParseError = { lineNumber: number; message: string };

function parseCsv(text: string): { rows: ParsedRow[]; errors: ParseError[] } {
  const lines = text.trim().split('\n');
  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];

  const firstLine = lines[0]?.toLowerCase().trim() ?? '';
  const startIndex = firstLine.includes('email') && firstLine.includes('name') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',').map((s) => s.trim());
    const lineNumber = i + 1;

    if (parts.length < 4) {
      errors.push({ lineNumber, message: `Expected 4 columns (email,name,role,password), got ${parts.length}` });
      continue;
    }

    const [email, name, role, password] = parts;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ lineNumber, message: `Invalid email: "${email}"` });
      continue;
    }

    if (!name) {
      errors.push({ lineNumber, message: 'Name is required' });
      continue;
    }

    if (!['admin', 'staff', 'student'].includes(role)) {
      errors.push({ lineNumber, message: `Invalid role: "${role}". Must be admin, staff, or student` });
      continue;
    }

    if (!password || password.length < 6) {
      errors.push({ lineNumber, message: 'Password must be at least 6 characters' });
      continue;
    }

    rows.push({ email, name, role: role as 'admin' | 'staff' | 'student', password, lineNumber });
  }

  return { rows, errors };
}

describe('CSV Parser for Bulk User Import', () => {
  it('parses valid CSV without header', () => {
    const csv = `alice@example.com,Alice,student,pass123
bob@example.com,Bob,staff,pass456`;

    const { rows, errors } = parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ email: 'alice@example.com', name: 'Alice', role: 'student' });
    expect(rows[1]).toMatchObject({ email: 'bob@example.com', name: 'Bob', role: 'staff' });
  });

  it('parses valid CSV with header', () => {
    const csv = `email,name,role,password
alice@example.com,Alice,student,pass123`;

    const { rows, errors } = parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('alice@example.com');
  });

  it('skips empty lines', () => {
    const csv = `alice@example.com,Alice,student,pass123

bob@example.com,Bob,staff,pass456`;

    const { rows, errors } = parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
  });

  it('reports error for missing columns', () => {
    const csv = `alice@example.com,Alice`;

    const { rows, errors } = parseCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Expected 4 columns');
  });

  it('reports error for invalid email', () => {
    const csv = `not-an-email,Alice,student,pass123`;

    const { rows, errors } = parseCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Invalid email');
  });

  it('reports error for invalid role', () => {
    const csv = `alice@example.com,Alice,superuser,pass123`;

    const { rows, errors } = parseCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Invalid role');
  });

  it('reports error for short password', () => {
    const csv = `alice@example.com,Alice,student,abc`;

    const { rows, errors } = parseCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Password must be at least 6 characters');
  });

  it('handles mixed valid and invalid rows', () => {
    const csv = `alice@example.com,Alice,student,pass123
invalid-email,Bob,staff,pass456
charlie@example.com,Charlie,admin,pass789`;

    const { rows, errors } = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].lineNumber).toBe(2);
  });

  it('trims whitespace from fields', () => {
    const csv = ` alice@example.com , Alice , student , pass123 `;

    const { rows, errors } = parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('alice@example.com');
    expect(rows[0].name).toBe('Alice');
  });

  it('reports error for empty name', () => {
    const csv = `alice@example.com,,student,pass123`;

    const { rows, errors } = parseCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Name is required');
  });
});
