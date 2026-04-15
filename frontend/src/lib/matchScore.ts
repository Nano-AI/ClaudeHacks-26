export interface SharedGroup {
  label: string;
  items: string[];
}

export interface MatchScore {
  score: number;
  shared: SharedGroup[];
}

type SocialValue = unknown;

interface Socials {
  [key: string]: SocialValue;
}

function toStringArray(v: SocialValue): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function toStringOrNull(v: SocialValue): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

function intersect(a: string[], b: string[], caseInsensitive: boolean): string[] {
  const norm = (s: string): string => (caseInsensitive ? s.toLowerCase().trim() : s.trim());
  const setB = new Set(b.map(norm));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of a) {
    const key = norm(item);
    if (setB.has(key) && !seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

export function computeMatchScore(
  selfSocials: Socials | null | undefined,
  otherSocials: Socials | null | undefined
): MatchScore {
  const self = selfSocials ?? {};
  const other = otherSocials ?? {};
  const shared: SharedGroup[] = [];
  let score = 0;

  const artists = intersect(
    toStringArray(self.spotify_top_artists),
    toStringArray(other.spotify_top_artists),
    true
  );
  if (artists.length > 0) {
    score += Math.min(50, artists.length * 25);
    shared.push({ label: 'Both love on Spotify', items: artists });
  }

  const films = intersect(
    toStringArray(self.letterboxd_favs),
    toStringArray(other.letterboxd_favs),
    true
  );
  if (films.length > 0) {
    score += Math.min(40, films.length * 20);
    shared.push({ label: 'Shared Letterboxd favorites', items: films });
  }

  const interests = intersect(
    toStringArray(self.interests),
    toStringArray(other.interests),
    true
  );
  if (interests.length > 0) {
    score += Math.min(45, interests.length * 15);
    shared.push({ label: 'Shared interests', items: interests });
  }

  const selfHome = toStringOrNull(self.hometown);
  const otherHome = toStringOrNull(other.hometown);
  if (selfHome && otherHome && selfHome.toLowerCase() === otherHome.toLowerCase()) {
    score += 10;
    shared.push({ label: 'Same hometown', items: [selfHome] });
  }

  const selfMajor = toStringOrNull(self.major);
  const otherMajor = toStringOrNull(other.major);
  if (selfMajor && otherMajor && selfMajor.toLowerCase() === otherMajor.toLowerCase()) {
    score += 10;
    shared.push({ label: 'Same major', items: [selfMajor] });
  }

  return { score: Math.max(0, Math.min(100, score)), shared };
}
