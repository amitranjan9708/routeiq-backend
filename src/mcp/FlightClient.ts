import { RouteSegment } from '../models/types';
import { googleFlightsClient } from './GoogleFlightsClient';
import { remoteKiwiClient } from './RemoteKiwiClient';
import { skyscannerClient } from './SkyscannerClient';
import { getSkyscannerStatus, shouldSkipSkyscanner } from './skyscannerState';

export type FlightProvider = 'google' | 'kiwi' | 'skyscanner' | 'both' | 'auto';

const MAX_FLIGHTS_PER_SOURCE = 3;

function resolveProvider(): FlightProvider {
  const raw = (process.env.FLIGHT_PROVIDER || 'both').toLowerCase();
  if (raw === 'google' || raw === 'kiwi' || raw === 'skyscanner' || raw === 'both' || raw === 'all') {
    return raw === 'all' ? 'both' : (raw as FlightProvider);
  }
  if (googleFlightsClient.isAvailable()) return 'both';
  return 'kiwi';
}

function isGoogleLive(seg: RouteSegment): boolean {
  return !!(
    seg.airline ||
    (seg.provider && /google flights/i.test(seg.provider) && !/fallback|not installed/i.test(seg.provider))
  );
}

function isKiwiLive(seg: RouteSegment): boolean {
  return !!(
    (seg.bookingUrl && seg.bookingUrl.includes('kiwi')) ||
    (seg.provider && /kiwi/i.test(seg.provider) && !/fallback|math/i.test(seg.provider))
  );
}

function isSkyscannerLive(seg: RouteSegment): boolean {
  return !!(
    seg.flightSource === 'skyscanner' &&
    seg.provider &&
    /skyscanner/i.test(seg.provider) &&
    !/fallback|not installed/i.test(seg.provider) &&
    seg.cost > 0
  );
}

function tagSource(segments: RouteSegment[], source: 'google' | 'kiwi'): RouteSegment[] {
  return segments.map((s) => ({
    ...s,
    flightSource: source,
    id: `${s.id}_${source}`,
  }));
}

function dedupeKey(seg: RouteSegment): string {
  return `${seg.flyFrom}|${seg.flyTo}|${seg.cost}|${seg.departureTime}|${seg.flightSource}`;
}

export class FlightClient {
  get activeProvider(): FlightProvider {
    return resolveProvider();
  }

  get usesGoogle(): boolean {
    const p = resolveProvider();
    return p === 'google' || p === 'both' || p === 'auto';
  }

  get usesKiwi(): boolean {
    const p = resolveProvider();
    return p === 'kiwi' || p === 'both' || p === 'auto';
  }

  get usesSkyscanner(): boolean {
    const p = resolveProvider();
    return p === 'skyscanner' || p === 'both' || p === 'auto';
  }

  async searchFlight(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    originId: string,
    destId: string,
    date?: string,
    mode: 'cheapest' | 'balanced' | 'fastest' = 'cheapest'
  ): Promise<RouteSegment[]> {
    const provider = resolveProvider();

    if (provider === 'google') {
      return this.searchGoogleOnly(originLat, originLng, destLat, destLng, originId, destId, date, mode);
    }

    if (provider === 'kiwi') {
      return tagSource(
        await remoteKiwiClient.searchFlight(
          originLat,
          originLng,
          destLat,
          destLng,
          originId,
          destId,
          date
        ),
        'kiwi'
      );
    }

    if (provider === 'skyscanner') {
      return skyscannerClient.searchFlight(
        originLat,
        originLng,
        destLat,
        destLng,
        originId,
        destId,
        date,
        mode
      );
    }

    return this.searchAllProviders(
      originLat,
      originLng,
      destLat,
      destLng,
      originId,
      destId,
      date,
      mode
    );
  }

  private async searchGoogleOnly(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    originId: string,
    destId: string,
    date?: string,
    mode: 'cheapest' | 'balanced' | 'fastest' = 'cheapest'
  ): Promise<RouteSegment[]> {
    const segments = await googleFlightsClient.searchFlight(
      originLat,
      originLng,
      destLat,
      destLng,
      originId,
      destId,
      date,
      mode
    );
    const live = segments.filter(isGoogleLive);
    if (live.length > 0) return tagSource(live, 'google');
    if (process.env.FLIGHT_PROVIDER === 'google') return tagSource(segments, 'google');
    console.warn('[Flights] Google returned no live fares; falling back to Kiwi');
    return tagSource(
      await remoteKiwiClient.searchFlight(
        originLat,
        originLng,
        destLat,
        destLng,
        originId,
        destId,
        date
      ),
      'kiwi'
    );
  }

  /** Google + Kiwi + Skyscanner in parallel (up to MAX_FLIGHTS_PER_SOURCE each). */
  private async searchAllProviders(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    originId: string,
    destId: string,
    date?: string,
    mode: 'cheapest' | 'balanced' | 'fastest' = 'cheapest'
  ): Promise<RouteSegment[]> {
    const googlePromise = googleFlightsClient.isAvailable()
      ? googleFlightsClient
          .searchFlight(originLat, originLng, destLat, destLng, originId, destId, date, mode)
          .then((s) => tagSource(s.filter(isGoogleLive).slice(0, MAX_FLIGHTS_PER_SOURCE), 'google'))
          .catch((e) => {
            console.warn('[Flights] Google search failed:', e?.message ?? e);
            return [] as RouteSegment[];
          })
      : Promise.resolve([] as RouteSegment[]);

    const kiwiPromise = remoteKiwiClient
      .searchFlight(originLat, originLng, destLat, destLng, originId, destId, date)
      .then((s) => tagSource(s.filter(isKiwiLive).slice(0, MAX_FLIGHTS_PER_SOURCE), 'kiwi'))
      .catch((e) => {
        console.warn('[Flights] Kiwi search failed:', e?.message ?? e);
        return [] as RouteSegment[];
      });

    const skyPromise =
      skyscannerClient.isAvailable() && !shouldSkipSkyscanner()
        ? skyscannerClient
            .searchFlight(originLat, originLng, destLat, destLng, originId, destId, date, mode)
            .then((s) => s.filter(isSkyscannerLive).slice(0, MAX_FLIGHTS_PER_SOURCE))
            .catch((e) => {
              console.warn('[Flights] Skyscanner search failed:', e?.message ?? e);
              return [] as RouteSegment[];
            })
        : Promise.resolve([] as RouteSegment[]);

    const [googleFlights, kiwiFlights, skyFlights] = await Promise.all([
      googlePromise,
      kiwiPromise,
      skyPromise,
    ]);

    const merged = [...googleFlights, ...kiwiFlights, ...skyFlights];

    if (merged.length > 0) {
      const seen = new Set<string>();
      return merged.filter((seg) => {
        const key = dedupeKey(seg);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    const [googleAny, kiwiAny, skyAny] = await Promise.all([
      googleFlightsClient.isAvailable()
        ? googleFlightsClient
            .searchFlight(originLat, originLng, destLat, destLng, originId, destId, date, mode)
            .then((s) => tagSource(s.slice(0, 1), 'google'))
            .catch(() => [] as RouteSegment[])
        : [],
      remoteKiwiClient
        .searchFlight(originLat, originLng, destLat, destLng, originId, destId, date)
        .then((s) => tagSource(s.slice(0, 1), 'kiwi'))
        .catch(() => [] as RouteSegment[]),
      skyscannerClient.isAvailable()
        ? skyscannerClient
            .searchFlight(originLat, originLng, destLat, destLng, originId, destId, date, mode)
            .then((s) => s.slice(0, 1))
            .catch(() => [] as RouteSegment[])
        : [],
    ]);

    return [...googleAny, ...kiwiAny, ...skyAny];
  }
}

export const flightClient = new FlightClient();
