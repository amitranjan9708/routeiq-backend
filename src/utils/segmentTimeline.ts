import { RouteSegment } from '../models/types';
import { addMinutesToClock, parseTimeMinutes } from './trainUtils';

/** Chain departure/arrival times across segments when prior leg has arrival time. */
export function applySegmentTimeline(segments: RouteSegment[]): RouteSegment[] {
  const out: RouteSegment[] = [];
  let prevArrival: string | undefined;

  for (const seg of segments) {
    const next = { ...seg };

    if (prevArrival && parseTimeMinutes(prevArrival) > 0) {
      if (!next.departureTime) {
        next.departureTime = prevArrival;
      }
      if (next.departureTime && next.duration && !next.arrivalTime) {
        next.arrivalTime = addMinutesToClock(next.departureTime, next.duration);
      }
    }

    if (next.arrivalTime && parseTimeMinutes(next.arrivalTime) > 0) {
      prevArrival = next.arrivalTime;
    } else if (next.departureTime && next.duration) {
      prevArrival = addMinutesToClock(next.departureTime, next.duration);
      if (!next.arrivalTime) next.arrivalTime = prevArrival;
    } else {
      prevArrival = undefined;
    }

    out.push(next);
  }

  return out;
}
