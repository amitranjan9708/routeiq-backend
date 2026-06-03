import { RouteSegment } from '../models/types';

const SEAT_CLASS_ORDER = ['1A', '2A', '3A', '3E', 'SL', '2S', 'CC', 'EC', 'FC'];

export function trainIdentity(seg: Pick<RouteSegment, 'trainNumber' | 'trainName' | 'departureTime'>): string {
  const num = (seg.trainNumber || '').replace(/\D/g, '').trim();
  if (num) return num;
  return `${seg.trainName || ''}|${seg.departureTime || ''}`;
}

export function dedupeTrains(trains: RouteSegment[]): RouteSegment[] {
  const seen = new Set<string>();
  const out: RouteSegment[] = [];
  for (const t of trains) {
    const key = trainIdentity(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function normalizeSeatAvailability(raw: unknown): string[] {
  if (!raw) return [];

  const lines: string[] = [];

  const pushLine = (cls: string, status: unknown) => {
    const label = cls.trim();
    const value = String(status ?? '').trim();
    if (!label || !value || /no\s*data/i.test(value)) return;
    lines.push(`${label}: ${value}`);
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') {
        const m = item.match(/^([A-Z0-9]+)\s*:\s*(.+)$/i);
        if (m) pushLine(m[1], m[2]);
        else if (!/no\s*data/i.test(item)) lines.push(item);
      } else if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const cls = String(o.enqClass || o.class || o.classCode || '');
        const status = o.availablityStatus || o.availabilityStatus || o.status || o.availability;
        if (cls) pushLine(cls, status);
      }
    }
    return lines;
  }

  if (typeof raw === 'object') {
    for (const [cls, status] of Object.entries(raw as Record<string, unknown>)) {
      pushLine(cls, status);
    }
    return lines;
  }

  return lines;
}

export function hasUsefulSeatAvailability(seats?: string[]): boolean {
  return !!seats?.some((s) => s && !/no\s*data/i.test(s));
}

/** Parse clock times from erail (07.30), 24h (07:30), or 12h (10:35 AM). */
export function parseTimeMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const normalized = String(timeStr).trim().replace(/\./g, ':');
  const match = normalized.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (match[3]?.toUpperCase() === 'PM' && h < 12) h += 12;
  if (match[3]?.toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

/** Add minutes to a clock string; returns 12h AM/PM when input had AM/PM, else HH:MM. */
export function addMinutesToClock(timeStr: string, minutes: number): string {
  const total = parseTimeMinutes(timeStr) + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const has12h = /AM|PM/i.test(timeStr);
  if (has12h) {
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function segmentDurationFromTimes(departureTime?: string, arrivalTime?: string): number | undefined {
  const dep = parseTimeMinutes(departureTime);
  const arr = parseTimeMinutes(arrivalTime);
  if (!dep && !arr) return undefined;
  if (arr >= dep) return arr - dep;
  return 24 * 60 - dep + arr;
}

export function pickSegmentFare(
  fareByClass?: Record<string, number>,
  classesAvailable?: string[]
): number | undefined {
  const picked = pickSegmentFareClass(fareByClass, classesAvailable);
  return picked?.fare;
}

/** Preferred display class + General quota fare from erail. */
export function pickSegmentFareClass(
  fareByClass?: Record<string, number>,
  classesAvailable?: string[]
): { fare: number; fareClass: string } | undefined {
  if (!fareByClass) return undefined;
  const preferred = ['SL', '3A', '2A', '2S', 'CC', '3E', '1A', 'EC', 'FC'];
  const candidates = classesAvailable?.length
    ? preferred.filter((c) => classesAvailable.includes(c))
    : preferred;
  for (const cls of candidates) {
    const fare = fareByClass[cls];
    if (typeof fare === 'number' && fare > 0) return { fare, fareClass: cls };
  }
  for (const [cls, fare] of Object.entries(fareByClass)) {
    if (typeof fare === 'number' && fare > 0) return { fare, fareClass: cls };
  }
  return undefined;
}

export function legSignature(seg: Pick<RouteSegment, 'departureTime' | 'arrivalTime' | 'cost' | 'duration'>): string {
  return `${seg.departureTime}|${seg.arrivalTime}|${seg.cost}|${seg.duration}`;
}

export function trainsAreDistinctOptions(a: RouteSegment, b: RouteSegment): boolean {
  if (trainIdentity(a) === trainIdentity(b)) return false;
  if (a.fullRouteOrigin !== b.fullRouteOrigin || a.fullRouteDestination !== b.fullRouteDestination) {
    return true;
  }
  if (a.runsOn !== b.runsOn) return true;
  if (legSignature(a) !== legSignature(b)) return true;
  const seatsA = (a.seatAvailability || []).join('|');
  const seatsB = (b.seatAvailability || []).join('|');
  if (seatsA !== seatsB) return true;
  return false;
}

export function sortSeatLines(seats: string[]): string[] {
  const order = (line: string) => {
    const cls = line.split(':')[0]?.trim().toUpperCase();
    const idx = SEAT_CLASS_ORDER.indexOf(cls);
    return idx === -1 ? 99 : idx;
  };
  return [...seats].sort((a, b) => order(a) - order(b));
}

export function parseTravelDuration(durationStr?: string): number | undefined {
  if (!durationStr) return undefined;
  const parts = durationStr.split(':').map((p) => parseInt(p, 10));
  if (parts.length >= 2 && parts.every((n) => !Number.isNaN(n))) {
    return parts[0] * 60 + parts[1];
  }
  return undefined;
}

export function formatOperatingDays(operatingDays?: string): string | undefined {
  if (!operatingDays) return undefined;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (operatingDays.length >= 7 && /^[01]+$/.test(operatingDays)) {
    const active = dayNames.filter((_, i) => operatingDays[i] === '1');
    return active.length ? active.join(', ') : operatingDays;
  }
  return operatingDays;
}

export function mapErailTrain(
  trainBase: {
    trainNumber?: string;
    trainName?: string;
    sourceStationName?: string;
    destinationStationName?: string;
    fromStationName?: string;
    fromStationCode?: string;
    toStationName?: string;
    toStationCode?: string;
    departureTime?: string;
    arrivalTime?: string;
    travelDuration?: string;
    operatingDays?: string;
    fareByClass?: Record<string, number>;
    classesAvailable?: string[];
    trainType?: string;
    erailSeatAvailability?: string[];
  },
  base: Pick<RouteSegment, 'originId' | 'destinationId' | 'cost' | 'duration' | 'risk' | 'provider'>,
  segmentLabels?: { originName?: string; destinationName?: string }
): RouteSegment {
  const normalizeClock = (t: string) => (t ? String(t).trim().replace(/\./g, ':') : '');
  const departureTime = normalizeClock(trainBase.departureTime || '');
  const arrivalTime = normalizeClock(trainBase.arrivalTime || '');
  const legDuration =
    segmentDurationFromTimes(departureTime, arrivalTime) ??
    parseTravelDuration(trainBase.travelDuration) ??
    base.duration;

  const originStationCode = String(trainBase.fromStationCode || '').trim().toUpperCase() || undefined;
  const destinationStationCode = String(trainBase.toStationCode || '').trim().toUpperCase() || undefined;

  const picked = pickSegmentFareClass(trainBase.fareByClass, trainBase.classesAvailable);
  const seatAvailability = sortSeatLines(
    trainBase.erailSeatAvailability?.length
      ? trainBase.erailSeatAvailability
      : normalizeSeatAvailability(undefined)
  );

  return {
    id: `train_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'TRAIN',
    originId: base.originId,
    originName: segmentLabels?.originName || trainBase.fromStationName || 'Station',
    destinationId: base.destinationId,
    destinationName: segmentLabels?.destinationName || trainBase.toStationName || 'Station',
    originStationCode,
    destinationStationCode,
    cost: picked?.fare ?? 0,
    duration: legDuration,
    risk: base.risk,
    provider: base.provider,
    trainName: trainBase.trainName || 'Express',
    trainNumber: String(trainBase.trainNumber || '').trim(),
    trainType: trainBase.trainType,
    fullRouteOrigin: trainBase.sourceStationName,
    fullRouteDestination: trainBase.destinationStationName,
    runsOn: formatOperatingDays(trainBase.operatingDays),
    fareByClass: trainBase.fareByClass,
    fareClass: picked?.fareClass,
    fareIsLive: !!picked,
    seatAvailability,
    departureTime,
    arrivalTime,
  };
}

export function mapApifyTrain(
  t: Record<string, unknown>,
  base: Pick<RouteSegment, 'originId' | 'destinationId' | 'cost' | 'duration' | 'risk' | 'provider'>,
  segmentLabels?: { originName?: string; destinationName?: string }
): RouteSegment {
  const fareByClass = t.fare_by_class as Record<string, number> | undefined;
  const classesAvailable = Array.isArray(t.classes_available)
    ? (t.classes_available as string[])
    : undefined;
  const picked = pickSegmentFareClass(fareByClass, classesAvailable);

  const departureTime = String(t.departure_time || t.departureTime || '');
  const arrivalTime = String(t.arrival_time || t.arrivalTime || '');
  const legDuration = segmentDurationFromTimes(departureTime, arrivalTime) ?? base.duration;

  const runsOn = Array.isArray(t.runs_on) ? (t.runs_on as string[]).join(', ') : undefined;
  const seatAvailability = sortSeatLines(normalizeSeatAvailability(t.seat_availability));

  const fullRouteOrigin = String(t.origin_station || '');
  const fullRouteDestination = String(t.destination_station || '');

  return {
    id: `train_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'TRAIN',
    originId: base.originId,
    originName: segmentLabels?.originName || String(t.from_station || 'Station'),
    destinationId: base.destinationId,
    destinationName: segmentLabels?.destinationName || String(t.to_station || 'Station'),
    cost: picked?.fare ?? base.cost,
    fareByClass,
    fareClass: picked?.fareClass,
    fareIsLive: !!picked,
    duration: legDuration,
    risk: base.risk,
    provider: base.provider,
    trainName: String(t.train_name || t.trainName || 'Express'),
    trainNumber: String(t.train_number || t.trainNo || '').trim(),
    trainType: t.train_type ? String(t.train_type) : undefined,
    fullRouteOrigin: fullRouteOrigin || undefined,
    fullRouteDestination: fullRouteDestination || undefined,
    runsOn,
    distanceKm: typeof t.distance_km === 'number' ? t.distance_km : undefined,
    seatAvailability,
    departureTime,
    arrivalTime,
  };
}
