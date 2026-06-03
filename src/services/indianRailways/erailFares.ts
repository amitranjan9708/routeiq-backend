/**
 * Parse fare & availability blocks from erail.in between-stations responses.
 * Each train row is followed by a metadata section (see erail getTrains.aspx).
 */

/** Fare groups after TYPE:trainId in erail fare lines (7 buckets × 6 quota fares; we use General = first non-zero). */
export const ERAIL_FARE_CLASS_ORDER = ['1A', '2A', '3A', 'SL', '2S', 'CC', 'FC'] as const;

export type ErailFareByClass = Partial<Record<(typeof ERAIL_FARE_CLASS_ORDER)[number] | '3E', number>>;

const FARE_LINE_RE =
  /^(MAIL_EXPRESS|SUPERFAST|RAJDHANI|RAIL_MOTOR|PASSENGER|EXPRESS|DURONTO|SHATABDI|JANSADHARAN|GARIB|SPECIAL|SUVidha|HUMSAFAR|TEJAS|VANDE|MEMU|DMU|PASS|RAJ|SF)[^:]*:\d+/i;

export function isErailFareSection(section: string): boolean {
  const parts = section.split('~');
  return parts.some((p) => FARE_LINE_RE.test(p.trim()));
}

/** First non-zero value in a comma-separated quota list = General fare for that class. */
export function generalFareFromQuotaList(raw: string): number | undefined {
  if (!raw || !raw.trim()) return undefined;
  for (const piece of raw.split(',')) {
    const n = parseInt(piece.trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

export function parseErailFareLine(line: string): ErailFareByClass {
  const fareByClass: ErailFareByClass = {};
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return fareByClass;

  const afterType = line.slice(colonIdx + 1);
  const firstColon = afterType.indexOf(':');
  if (firstColon === -1) return fareByClass;

  const groups = afterType.slice(firstColon + 1).split(':');
  for (let i = 0; i < groups.length && i < ERAIL_FARE_CLASS_ORDER.length; i++) {
    const fare = generalFareFromQuotaList(groups[i]);
    if (fare != null) {
      fareByClass[ERAIL_FARE_CLASS_ORDER[i]] = fare;
    }
  }
  return fareByClass;
}

/** `2A:12:7::3:::::::|SL:36:121::77::6:::::4|` → human-readable availability lines */
export function parseErailAvailabilityLine(line: string): string[] {
  const out: string[] = [];
  for (const chunk of line.split('|')) {
    const trimmed = chunk.trim();
    if (!trimmed || !trimmed.includes(':')) continue;
    const colon = trimmed.indexOf(':');
    const cls = trimmed.slice(0, colon).trim().toUpperCase();
    if (!/^[12]?[AES]?[ACL]?$|^SL$|^CC$|^FC$|^3E$|^EC$|^2S$|^1A$|^2A$|^3A$/.test(cls)) continue;
    const nums = trimmed
      .slice(colon + 1)
      .split(':')
      .map((s) => s.trim())
      .filter((s) => s && s !== '0');
    if (nums.length === 0) continue;
    const label = nums.length === 1 ? nums[0] : nums.join(' / ');
    out.push(`${cls}: ${label}`);
  }
  return out;
}

export function parseErailFareSection(section: string): {
  fareByClass: ErailFareByClass;
  seatAvailability: string[];
  trainType?: string;
} {
  const parts = section.split('~').map((p) => p.trim()).filter(Boolean);
  let fareByClass: ErailFareByClass = {};
  let seatAvailability: string[] = [];
  let trainType: string | undefined;

  for (const part of parts) {
    if (FARE_LINE_RE.test(part)) {
      trainType = part.split(':')[0];
      fareByClass = { ...fareByClass, ...parseErailFareLine(part) };
      continue;
    }
    if (part.includes('|') && /[12]?A:|SL:|3A:|2S:|CC:/.test(part)) {
      seatAvailability = parseErailAvailabilityLine(part);
      continue;
    }
    if (part.includes(',,') && /SL|2A|3A|1A|CC|2S/.test(part)) {
      const classes = part
        .split(',')
        .map((s) => s.trim())
        .filter((s) => /^[A-Z0-9]{1,3}$/.test(s) && s !== 'En' && s !== 'GN' && s !== 'GC' && s !== 'PC');
      for (const cls of classes) {
        if (!fareByClass[cls as keyof ErailFareByClass] && !seatAvailability.some((l) => l.startsWith(`${cls}:`))) {
          seatAvailability.push(`${cls}: listed`);
        }
      }
    }
  }

  return { fareByClass, seatAvailability, trainType };
}

export function classesFromFares(fareByClass: ErailFareByClass): string[] {
  return ERAIL_FARE_CLASS_ORDER.filter((c) => (fareByClass[c] ?? 0) > 0);
}
