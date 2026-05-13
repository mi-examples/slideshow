import { describe, expect, it } from 'vitest';
import { parseFolderIds, parseSeconds } from './config';

describe('parseSeconds', () => {
  it('accepts positive integers', () => {
    expect(parseSeconds(30)).toBe(30);
    expect(parseSeconds(1)).toBe(1);
    expect(parseSeconds(3600)).toBe(3600);
  });

  it('accepts numeric strings', () => {
    expect(parseSeconds('45')).toBe(45);
    expect(parseSeconds(' 60 ')).toBe(60);
  });

  it('rejects values below 1 second', () => {
    expect(parseSeconds(0)).toBeNull();
    expect(parseSeconds(0.5)).toBeNull();
    expect(parseSeconds(-5)).toBeNull();
  });

  it('rejects non-finite numbers', () => {
    expect(parseSeconds(NaN)).toBeNull();
    expect(parseSeconds(Infinity)).toBeNull();
  });

  it('rejects non-numeric strings', () => {
    expect(parseSeconds('thirty')).toBeNull();
    expect(parseSeconds('')).toBeNull();
  });

  it('ignores unsubstituted template literals', () => {
    expect(parseSeconds('[Slide Duration]')).toBeNull();
    expect(parseSeconds('[anything]')).toBeNull();
  });

  it('rejects non-string/non-number inputs', () => {
    expect(parseSeconds(null)).toBeNull();
    expect(parseSeconds(undefined)).toBeNull();
    expect(parseSeconds({})).toBeNull();
    expect(parseSeconds([30])).toBeNull();
  });
});

describe('parseFolderIds', () => {
  it('accepts a single number', () => {
    expect(parseFolderIds(42)).toEqual(['42']);
  });

  it('accepts a single-id string', () => {
    expect(parseFolderIds('171')).toEqual(['171']);
  });

  it('accepts a CSV string', () => {
    expect(parseFolderIds('1,2,3')).toEqual(['1', '2', '3']);
  });

  it('trims whitespace inside CSV', () => {
    expect(parseFolderIds('1, 2 , 3')).toEqual(['1', '2', '3']);
  });

  it('drops empty CSV entries', () => {
    expect(parseFolderIds(',1,,2,')).toEqual(['1', '2']);
  });

  it('accepts an array of ids (mixed types)', () => {
    expect(parseFolderIds([1, '2', 3])).toEqual(['1', '2', '3']);
  });

  it('returns null for unsubstituted templates', () => {
    expect(parseFolderIds('[Folders]')).toBeNull();
  });

  it('returns null for missing or empty input', () => {
    expect(parseFolderIds(undefined)).toBeNull();
    expect(parseFolderIds(null)).toBeNull();
    expect(parseFolderIds('')).toBeNull();
    expect(parseFolderIds([])).toBeNull();
    expect(parseFolderIds(',,,')).toBeNull();
  });

  it('returns null for unexpected shapes', () => {
    expect(parseFolderIds({ id: 1 })).toBeNull();
    expect(parseFolderIds(true)).toBeNull();
  });
});
