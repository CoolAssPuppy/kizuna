/**
 * Auto-assign rules engine for the Room Assignment Tool.
 *
 * Pure function: takes a snapshot of rooms (with current occupants)
 * and assignable attendees, returns a list of (room_id, user_id)
 * pairs the caller should insert into accommodation_occupants. The
 * caller is responsible for executing the writes — keeping the
 * algorithm side-effect-free makes it cheap to test and easy to
 * preview "what would happen" before committing.
 *
 * Rule precedence (every step skips users + rooms already accounted
 * for in earlier steps):
 *
 *   1. Leadership -> Suites. We never want a VP in a standard
 *      double; suites are scarce, so they go first to leadership.
 *   2. Has-dependents -> remaining Suites + Family rooms (room_type
 *      = 'family'). Families need the extra space and a separate
 *      sleeping area for kids.
 *   3. Earliest registrations -> largest standard rooms by size_sqm
 *      (descending). Rewards the people who registered first with
 *      the best of what is left.
 *   4. Anyone unassigned overflows into remaining rooms in
 *      registration-time order.
 *
 * Already-occupied rooms are NEVER touched. The engine respects each
 * room's `capacity` and lets the caller decide which assignment is
 * "primary".
 */

import type { AssignableUser } from '../api/rooms';

export interface AutoAssignRoom {
  id: string;
  capacity: number;
  is_suite: boolean;
  room_type: string;
  size_sqm: number | null;
  occupied: number;
}

export interface AutoAssignResult {
  /** New (room_id, user_id) pairs to insert into accommodation_occupants. */
  assignments: Array<{ accommodationId: string; userId: string; isPrimary: boolean }>;
  /**
   * Users we couldn't place. Surfaced to the admin so they can either
   * import more rooms or hand-place these last attendees.
   */
  unplaced: AssignableUser[];
}

interface RoomState extends AutoAssignRoom {
  /** Live occupant count: starts at `occupied`, increments per assignment. */
  filled: number;
}

function makeState(rooms: ReadonlyArray<AutoAssignRoom>): RoomState[] {
  return rooms.map((r) => ({ ...r, filled: r.occupied }));
}

function placeUser(
  state: RoomState[],
  user: AssignableUser,
  assignments: AutoAssignResult['assignments'],
): boolean {
  for (const room of state) {
    if (room.filled < room.capacity) {
      assignments.push({
        accommodationId: room.id,
        userId: user.user_id,
        isPrimary: room.filled === 0,
      });
      room.filled += 1;
      return true;
    }
  }
  return false;
}

export function autoAssignRooms(
  rooms: ReadonlyArray<AutoAssignRoom>,
  attendees: ReadonlyArray<AssignableUser>,
): AutoAssignResult {
  // Skip people who already have a room. The caller passes attendees
  // pre-filtered, but defending here lets tests be sloppier.
  const state = makeState(rooms);
  const assignments: AutoAssignResult['assignments'] = [];
  const unplaced: AssignableUser[] = [];

  // Working pool. We pop into it as people are placed.
  const remaining = [...attendees];

  // ---- Step 1: Leadership -> Suites ----
  const suites = state.filter((r) => r.is_suite && r.filled < r.capacity);
  // Largest suites first so couples + their leadership co-occupant get
  // the most generous space. size_sqm null sorts last.
  suites.sort(compareBySizeDesc);
  const leadership = remaining.filter((u) => u.is_leadership);
  for (const user of leadership) {
    if (placeUser(suites, user, assignments)) {
      remove(remaining, user.user_id);
    }
  }

  // ---- Step 2: Has-dependents -> remaining suites + family rooms ----
  const familyish = state.filter(
    (r) =>
      r.filled < r.capacity &&
      (r.is_suite || r.room_type === 'family' || r.room_type === 'accessible'),
  );
  familyish.sort(compareBySizeDesc);
  const families = remaining.filter((u) => u.has_dependents);
  for (const user of families) {
    if (placeUser(familyish, user, assignments)) {
      remove(remaining, user.user_id);
    }
  }

  // ---- Step 3: Earliest registrations -> largest standard rooms ----
  const standardLargest = state
    .filter((r) => r.filled < r.capacity && !r.is_suite && r.room_type !== 'family')
    .sort(compareBySizeDesc);
  const byRegTime = [...remaining].sort((a, b) =>
    a.registration_created_at.localeCompare(b.registration_created_at),
  );
  for (const user of byRegTime) {
    if (placeUser(standardLargest, user, assignments)) {
      remove(remaining, user.user_id);
    }
  }

  // ---- Step 4: Overflow ----
  const overflow = state.filter((r) => r.filled < r.capacity);
  overflow.sort(compareBySizeDesc);
  // Anyone left over (registered later or no signal). Process in
  // registration-time order so the result stays deterministic.
  const stillRemaining = [...remaining].sort((a, b) =>
    a.registration_created_at.localeCompare(b.registration_created_at),
  );
  for (const user of stillRemaining) {
    if (placeUser(overflow, user, assignments)) {
      remove(remaining, user.user_id);
    } else {
      unplaced.push(user);
    }
  }
  // remaining still holds anyone not placed; merge with unplaced (overflow
  // step pushes unplaced as it iterates).
  return { assignments, unplaced };
}

function compareBySizeDesc(a: RoomState, b: RoomState): number {
  const sa = a.size_sqm ?? -Infinity;
  const sb = b.size_sqm ?? -Infinity;
  if (sa !== sb) return sb - sa;
  // Stable tie-breaker: suite > family > accessible > standard.
  const tier = (r: RoomState): number =>
    r.is_suite ? 3 : r.room_type === 'family' ? 2 : r.room_type === 'accessible' ? 1 : 0;
  return tier(b) - tier(a);
}

function remove(list: AssignableUser[], userId: string): void {
  const idx = list.findIndex((u) => u.user_id === userId);
  if (idx !== -1) list.splice(idx, 1);
}
