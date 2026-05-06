import { describe, expect, it } from 'vitest';

import type { AssignableUser } from '../api/rooms';

import { autoAssignRooms, type AutoAssignRoom } from './autoAssign';

function user(overrides: Partial<AssignableUser> & { id: string }): AssignableUser {
  const { id, ...rest } = overrides;
  return {
    user_id: id,
    full_name: id.toUpperCase(),
    email: `${id}@x`,
    role: 'employee',
    is_leadership: false,
    has_dependents: false,
    registration_created_at: '2027-01-01T00:00:00Z',
    ...rest,
  };
}

function room(overrides: Partial<AutoAssignRoom> & { id: string }): AutoAssignRoom {
  return {
    capacity: 1,
    is_suite: false,
    room_type: 'standard',
    size_sqm: null,
    occupied: 0,
    ...overrides,
  };
}

describe('autoAssignRooms', () => {
  it('places leadership in suites first', () => {
    const rooms: AutoAssignRoom[] = [
      room({ id: 'r-suite', is_suite: true, capacity: 2 }),
      room({ id: 'r-std' }),
    ];
    const attendees: AssignableUser[] = [
      user({ id: 'u-lead', is_leadership: true }),
      user({ id: 'u-other' }),
    ];
    const { assignments } = autoAssignRooms(rooms, attendees);
    const leaderRoom = assignments.find((a) => a.userId === 'u-lead')?.accommodationId;
    expect(leaderRoom).toBe('r-suite');
  });

  it('routes families to suites or family rooms before standard', () => {
    const rooms: AutoAssignRoom[] = [
      room({ id: 'r-family', room_type: 'family', capacity: 4, size_sqm: 50 }),
      room({ id: 'r-std', size_sqm: 25 }),
    ];
    const attendees: AssignableUser[] = [
      user({ id: 'u-family', has_dependents: true }),
      user({ id: 'u-solo' }),
    ];
    const { assignments } = autoAssignRooms(rooms, attendees);
    expect(assignments.find((a) => a.userId === 'u-family')?.accommodationId).toBe('r-family');
    expect(assignments.find((a) => a.userId === 'u-solo')?.accommodationId).toBe('r-std');
  });

  it('gives the largest standard room to the earliest registration', () => {
    const rooms: AutoAssignRoom[] = [
      room({ id: 'r-big', size_sqm: 40 }),
      room({ id: 'r-small', size_sqm: 20 }),
    ];
    const attendees: AssignableUser[] = [
      user({ id: 'u-late', registration_created_at: '2027-01-10T00:00:00Z' }),
      user({ id: 'u-early', registration_created_at: '2027-01-02T00:00:00Z' }),
    ];
    const { assignments } = autoAssignRooms(rooms, attendees);
    expect(assignments.find((a) => a.userId === 'u-early')?.accommodationId).toBe('r-big');
    expect(assignments.find((a) => a.userId === 'u-late')?.accommodationId).toBe('r-small');
  });

  it('respects capacity and reports unplaced users when out of space', () => {
    const rooms: AutoAssignRoom[] = [room({ id: 'r-only' })];
    const attendees: AssignableUser[] = [user({ id: 'u-1' }), user({ id: 'u-2' })];
    const { assignments, unplaced } = autoAssignRooms(rooms, attendees);
    expect(assignments).toHaveLength(1);
    expect(unplaced.map((u) => u.user_id)).toEqual(['u-2']);
  });

  it('skips already-occupied rooms unless capacity remains', () => {
    const rooms: AutoAssignRoom[] = [
      room({ id: 'r-full', occupied: 1 }),
      room({ id: 'r-pair', is_suite: true, capacity: 2, occupied: 1 }),
      room({ id: 'r-empty' }),
    ];
    const attendees: AssignableUser[] = [
      user({ id: 'u-lead', is_leadership: true }),
      user({ id: 'u-other' }),
    ];
    const { assignments } = autoAssignRooms(rooms, attendees);
    // Leader takes the remaining bed in the partially-filled suite.
    expect(assignments.find((a) => a.userId === 'u-lead')?.accommodationId).toBe('r-pair');
    // The other attendee falls into the empty standard room.
    expect(assignments.find((a) => a.userId === 'u-other')?.accommodationId).toBe('r-empty');
    // r-full remains untouched.
    expect(assignments.some((a) => a.accommodationId === 'r-full')).toBe(false);
  });

  it('marks the first occupant of an empty room as primary', () => {
    const rooms: AutoAssignRoom[] = [room({ id: 'r-pair', is_suite: true, capacity: 2 })];
    const attendees: AssignableUser[] = [
      user({ id: 'u-1', is_leadership: true }),
      user({ id: 'u-2', is_leadership: true }),
    ];
    const { assignments } = autoAssignRooms(rooms, attendees);
    expect(assignments).toEqual([
      { accommodationId: 'r-pair', userId: 'u-1', isPrimary: true },
      { accommodationId: 'r-pair', userId: 'u-2', isPrimary: false },
    ]);
  });

  it('does not double-place a user across rules', () => {
    // A leader who is also a family. They should land in the suite
    // (rule 1 wins over rule 2) and not appear twice.
    const rooms: AutoAssignRoom[] = [
      room({ id: 'r-suite', is_suite: true, capacity: 2 }),
      room({ id: 'r-family', room_type: 'family' }),
    ];
    const attendees: AssignableUser[] = [
      user({ id: 'u-vip', is_leadership: true, has_dependents: true }),
    ];
    const { assignments } = autoAssignRooms(rooms, attendees);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.accommodationId).toBe('r-suite');
  });

  it('returns no assignments when there are no attendees', () => {
    const rooms: AutoAssignRoom[] = [room({ id: 'r-1' })];
    const result = autoAssignRooms(rooms, []);
    expect(result.assignments).toEqual([]);
    expect(result.unplaced).toEqual([]);
  });

  it('returns no assignments when there are no rooms', () => {
    const attendees: AssignableUser[] = [user({ id: 'u-1' })];
    const result = autoAssignRooms([], attendees);
    expect(result.assignments).toEqual([]);
    expect(result.unplaced.map((u) => u.user_id)).toEqual(['u-1']);
  });
});
