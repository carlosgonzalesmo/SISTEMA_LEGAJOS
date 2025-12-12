import { normalizeCodigo, normalizeDniCe } from '../src/services/import.service';

describe('normalizeCodigo', () => {
  it('pads numeric part to 4 digits', () => {
    expect(normalizeCodigo('L-1')).toBe('L-0001');
    expect(normalizeCodigo('l 12')).toBe('L-0012');
    expect(normalizeCodigo('A-1234')).toBe('A-1234');
  });
  it('rejects invalid formats', () => {
    expect(normalizeCodigo('LL-1')).toBeNull();
    expect(normalizeCodigo('1-1')).toBeNull();
    expect(normalizeCodigo('')).toBeNull();
  });
});

describe('normalizeDniCe', () => {
  it('accepts 8 or 12 digits and strips non-digits', () => {
    expect(normalizeDniCe('12345678')).toBe('12345678');
    expect(normalizeDniCe('12.345.678')).toBe('12345678');
    expect(normalizeDniCe('AB-123456789012')).toBe('123456789012');
  });
  it('returns null for other lengths or empty', () => {
    expect(normalizeDniCe('123')).toBeNull();
    expect(normalizeDniCe('')).toBeNull();
    expect(normalizeDniCe(undefined)).toBeNull();
  });
});
