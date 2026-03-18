import { describe, it, expect } from 'vitest';
import { escapeCsvField, parseCsvLine, parseCsv } from './csv-utils';

describe('escapeCsvField', () => {
  it('returns plain text unchanged', () => {
    expect(escapeCsvField('hello')).toBe('hello');
  });

  it('wraps fields with commas in quotes', () => {
    expect(escapeCsvField('hello, world')).toBe('"hello, world"');
  });

  it('escapes double quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('wraps fields with newlines', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('handles carriage returns', () => {
    expect(escapeCsvField('a\rb')).toBe('"a\rb"');
  });

  it('handles empty string', () => {
    expect(escapeCsvField('')).toBe('');
  });
});

describe('parseCsvLine', () => {
  it('parses simple comma-separated values', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields', () => {
    expect(parseCsvLine('"hello, world",b,c')).toEqual(['hello, world', 'b', 'c']);
  });

  it('handles escaped quotes in quoted fields', () => {
    expect(parseCsvLine('"say ""hi""",b')).toEqual(['say "hi"', 'b']);
  });

  it('handles empty fields', () => {
    expect(parseCsvLine('a,,c')).toEqual(['a', '', 'c']);
  });

  it('handles single field', () => {
    expect(parseCsvLine('only')).toEqual(['only']);
  });

  it('handles quoted field with newline', () => {
    expect(parseCsvLine('"line1\nline2",b')).toEqual(['line1\nline2', 'b']);
  });
});

describe('parseCsv', () => {
  it('parses CSV text into array of objects', () => {
    const csv = 'type,title,points\nmcq,Question 1,10\nwritten,Question 2,20';
    const result = parseCsv(csv);
    expect(result).toEqual([
      { type: 'mcq', title: 'Question 1', points: '10' },
      { type: 'written', title: 'Question 2', points: '20' },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('returns empty array for header-only CSV', () => {
    expect(parseCsv('type,title,points')).toEqual([]);
  });

  it('handles quoted JSON content in fields', () => {
    const csv = 'type,title,content\nmcq,Q1,"{""prompt"":""What is 1+1?""}"';
    const result = parseCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('mcq');
    expect(result[0].content).toBe('{"prompt":"What is 1+1?"}');
  });

  it('handles Windows-style line endings', () => {
    const csv = 'type,title\r\nmcq,Q1\r\nwritten,Q2';
    const result = parseCsv(csv);
    expect(result).toHaveLength(2);
  });

  it('skips empty lines', () => {
    const csv = 'type,title\n\nmcq,Q1\n\nwritten,Q2\n';
    const result = parseCsv(csv);
    expect(result).toHaveLength(2);
  });

  it('round-trips with escapeCsvField', () => {
    // Simulate an export-import cycle
    const contentJson = JSON.stringify({ prompt: 'What is "hello, world"?' });
    const escaped = escapeCsvField(contentJson);
    const csv = `type,title,content\nmcq,Test,${escaped}`;
    const result = parseCsv(csv);
    expect(result[0].content).toBe(contentJson);
  });
});
