export interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  hobbies: string[];
  hometown_city: string | null;
  hometown_country: string | null;
  current_city: string | null;
  current_country: string | null;
}

export interface RankedMatch extends Profile {
  matched: string[];
}

/**
 * Returns profiles whose hobbies overlap with self, sorted by overlap
 * count descending. Excludes self. Profiles with zero overlap are
 * dropped — they're not matches.
 */
export function rankByHobbyOverlap(self: Profile, all: Profile[]): RankedMatch[] {
  const mine = new Set(self.hobbies);
  if (mine.size === 0) return [];
  const matches: RankedMatch[] = [];
  for (const other of all) {
    if (other.user_id === self.user_id) continue;
    const matched = other.hobbies.filter((h) => mine.has(h));
    if (matched.length === 0) continue;
    matches.push({ ...other, matched });
  }
  matches.sort((a, b) => b.matched.length - a.matched.length);
  return matches;
}

function sameLocation(
  a: { city: string | null; country: string | null },
  b: { city: string | null; country: string | null },
): boolean {
  if (!a.city || !a.country || !b.city || !b.country) return false;
  return (
    a.city.trim().toLowerCase() === b.city.trim().toLowerCase() &&
    a.country.toLowerCase() === b.country.toLowerCase()
  );
}

export function filterByHometown(self: Profile, all: Profile[]): Profile[] {
  const ours = { city: self.hometown_city, country: self.hometown_country };
  if (!ours.city || !ours.country) return [];
  return all.filter(
    (p) =>
      p.user_id !== self.user_id &&
      sameLocation(ours, { city: p.hometown_city, country: p.hometown_country }),
  );
}

export function filterByCurrentTown(self: Profile, all: Profile[]): Profile[] {
  const ours = { city: self.current_city, country: self.current_country };
  if (!ours.city || !ours.country) return [];
  return all.filter(
    (p) =>
      p.user_id !== self.user_id &&
      sameLocation(ours, { city: p.current_city, country: p.current_country }),
  );
}
