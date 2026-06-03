import { remoteKiwiClient } from '../mcp/RemoteKiwiClient';
import { resolveKiwiEndpoints } from '../mcp/kiwiIata';

export type DatePriceMap = Record<string, number>;

interface CacheEntry {
  prices: DatePriceMap;
  expiresAt: number;
}

const CACHE_TTL_MS = 45 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function cacheKey(origin: string, dest: string, month: string) {
  return `${origin.toLowerCase()}|${dest.toLowerCase()}|${month}`;
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number): string[] {
  const last = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  const out: string[] = [];
  for (let d = 1; d <= last; d++) {
    out.push(`${year}-${mm}-${String(d).padStart(2, '0')}`);
  }
  return out;
}

function pickAnchorDates(dates: string[], step: number): string[] {
  const anchors: string[] = [];
  for (let i = 0; i < dates.length; i += step) {
    anchors.push(dates[i]);
  }
  const last = dates[dates.length - 1];
  if (last && anchors[anchors.length - 1] !== last) {
    anchors.push(last);
  }
  return anchors;
}

function mergePrices(target: DatePriceMap, source: DatePriceMap) {
  for (const [date, price] of Object.entries(source)) {
    if (price > 0) {
      target[date] = target[date] ? Math.min(target[date], price) : price;
    }
  }
}

async function mapPool<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function fetchFlightCalendarPrices(
  origin: string,
  destination: string,
  year: number,
  month: number
): Promise<{ prices: DatePriceMap; source: string; cached?: boolean }> {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const key = cacheKey(origin, destination, monthKey);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return { prices: hit.prices, source: 'kiwi', cached: true };
  }

  const endpoints = resolveKiwiEndpoints(origin, destination);
  if (!endpoints) {
    return { prices: {}, source: 'none' };
  }

  const today = isoToday();
  const allDays = daysInMonth(year, month).filter((d) => d >= today);
  if (allDays.length === 0) {
    return { prices: {}, source: 'kiwi' };
  }

  const prices: DatePriceMap = {};
  const anchors = pickAnchorDates(allDays, 4);

  for (const anchor of anchors) {
    try {
      const flexPrices = await remoteKiwiClient.searchPricesByDate(
        endpoints.flyFrom,
        endpoints.flyTo,
        anchor,
        true
      );
      mergePrices(prices, flexPrices);
    } catch (e) {
      console.warn('[Calendar] flex search failed for', anchor, e);
    }
  }

  const missing = allDays.filter((d) => prices[d] == null).slice(0, 12);
  await mapPool(
    missing,
    async (date) => {
      try {
        const dayPrices = await remoteKiwiClient.searchPricesByDate(
          endpoints.flyFrom,
          endpoints.flyTo,
          date,
          false
        );
        mergePrices(prices, dayPrices);
      } catch (e) {
        console.warn('[Calendar] day search failed for', date, e);
      }
    },
    3
  );

  cache.set(key, { prices, expiresAt: Date.now() + CACHE_TTL_MS });

  return { prices, source: Object.keys(prices).length ? 'kiwi' : 'empty' };
}

/** Default window: current month + prices for next 35 bookable days. */
export async function fetchCalendarPricesWindow(
  origin: string,
  destination: string,
  startYear: number,
  startMonth: number
): Promise<DatePriceMap> {
  const merged: DatePriceMap = {};
  const { prices: m1 } = await fetchFlightCalendarPrices(
    origin,
    destination,
    startYear,
    startMonth
  );
  mergePrices(merged, m1);

  const nextMonth = startMonth === 12 ? 1 : startMonth + 1;
  const nextYear = startMonth === 12 ? startYear + 1 : startYear;
  const { prices: m2 } = await fetchFlightCalendarPrices(
    origin,
    destination,
    nextYear,
    nextMonth
  );
  mergePrices(merged, m2);

  const today = isoToday();
  const horizon = addDays(today, 35);
  const trimmed: DatePriceMap = {};
  for (const [d, p] of Object.entries(merged)) {
    if (d >= today && d <= horizon) trimmed[d] = p;
  }
  return trimmed;
}
