import { describe, expect, it } from 'vitest';

import { parseRoomCsv } from './csv';

describe('parseRoomCsv', () => {
  it('parses a minimal valid CSV', () => {
    const csv = [
      'room_number,description',
      '101,Mountain-view king',
      '102,Two-queen standard',
    ].join('\n');
    const result = parseRoomCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        room_number: '101',
        description: 'Mountain-view king',
        size_sqm: null,
        is_suite: false,
        capacity: 1,
      },
      {
        room_number: '102',
        description: 'Two-queen standard',
        size_sqm: null,
        is_suite: false,
        capacity: 1,
      },
    ]);
  });

  it('accepts header variations (case-insensitive, dashes, spaces)', () => {
    const csv = ['Room Number,Description,Is-Suite', '201,Honeymoon,yes'].join('\n');
    const result = parseRoomCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows[0]?.is_suite).toBe(true);
    expect(result.rows[0]?.capacity).toBe(2);
  });

  it('converts size_sqft to sqm when sqm column is absent', () => {
    const csv = ['room_number,description,size_sqft', '301,Spacious,300'].join('\n');
    const result = parseRoomCsv(csv);
    expect(result.errors).toEqual([]);
    // 300 sqft = 27.87 sqm, rounded to 1 decimal.
    expect(result.rows[0]?.size_sqm).toBe(27.9);
  });

  it('uses size_sqm directly when both columns are present', () => {
    const csv = ['room_number,size_sqm,size_sqft', '401,30,1000'].join('\n');
    const result = parseRoomCsv(csv);
    expect(result.rows[0]?.size_sqm).toBe(30);
  });

  it('parses true/false/yes/no/1/0 for is_suite', () => {
    const csv = [
      'room_number,is_suite',
      '501,true',
      '502,false',
      '503,Yes',
      '504,no',
      '505,1',
      '506,0',
    ].join('\n');
    const result = parseRoomCsv(csv);
    expect(result.rows.map((r) => r.is_suite)).toEqual([true, false, true, false, true, false]);
  });

  it('handles quoted fields with embedded commas', () => {
    const csv = ['room_number,description', '601,"Penthouse, ocean view"'].join('\n');
    const result = parseRoomCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows[0]?.description).toBe('Penthouse, ocean view');
  });

  it('records soft errors for malformed numeric cells without aborting the batch', () => {
    const csv = ['room_number,size_sqm', '701,42', '702,not-a-number', '703,55'].join('\n');
    const result = parseRoomCsv(csv);
    expect(result.rows.map((r) => r.room_number)).toEqual(['701', '702', '703']);
    expect(result.rows[1]?.size_sqm).toBeNull();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.line).toBe(3);
  });

  it('flags missing room_number column as a hard error', () => {
    const csv = ['description', 'Something'].join('\n');
    const result = parseRoomCsv(csv);
    expect(result.rows).toEqual([]);
    expect(result.errors[0]?.message).toMatch(/Missing required column/);
  });

  it('skips rows with empty room_number but keeps the rest', () => {
    const csv = ['room_number,description', '801,Good', ',Empty', '803,Also good'].join('\n');
    const result = parseRoomCsv(csv);
    expect(result.rows.map((r) => r.room_number)).toEqual(['801', '803']);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.line).toBe(3);
  });

  it('returns a hard error for completely empty input', () => {
    expect(parseRoomCsv('   \n\n').errors[0]?.message).toBe('Empty input');
  });

  it('defaults capacity from is_suite when capacity column is absent', () => {
    const csv = ['room_number,is_suite', '901,yes', '902,no'].join('\n');
    const result = parseRoomCsv(csv);
    expect(result.rows[0]?.capacity).toBe(2);
    expect(result.rows[1]?.capacity).toBe(1);
  });

  it('respects an explicit capacity column', () => {
    const csv = ['room_number,capacity', '1001,4'].join('\n');
    const result = parseRoomCsv(csv);
    expect(result.rows[0]?.capacity).toBe(4);
  });
});
