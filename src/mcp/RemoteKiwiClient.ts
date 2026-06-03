import EventSource from 'eventsource';
// @ts-ignore
global.EventSource = EventSource;

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { RouteSegment } from '../models/types';
import { Haversine } from '../engine/Haversine';
import { resolveKiwiIata, toKiwiDate } from './kiwiIata';

export class RemoteKiwiClient {
  private client: Client | null = null;
  private isConnected = false;

  async connect() {
    if (this.isConnected) return;

    console.log('[Kiwi MCP] Attempting to connect to official Kiwi.com MCP server...');
    const targetUrl = "https://mcp.kiwi.com";

    try {
      // Apify uses the ?token= query parameter for auth in Standby mode,
      // so we don't need to pass the Authorization header.
      const transport = new StreamableHTTPClientTransport(new URL(targetUrl));

      this.client = new Client({ name: "RouteIQ", version: "1.0.0" }, { capabilities: {} });
      await this.client.connect(transport);
      this.isConnected = true;
      console.log("[Kiwi MCP] Successfully connected to Remote Kiwi MCP on Apify!");
    } catch (e: any) {
      console.error(`[Kiwi MCP] Failed to connect. URL: ${targetUrl}`);
      console.error("[Kiwi MCP] Error Details:", e.message);
    }
  }

  async searchFlight(originLat: number, originLng: number, destLat: number, destLng: number, originId: string, destId: string, date?: string): Promise<RouteSegment[]> {
    const distance = Haversine.getDistance(originLat, originLng, destLat, destLng);

    if (!this.isConnected) {
      await this.connect();
    }

    if (this.isConnected && this.client) {
      try {
        const o = resolveKiwiIata(originId, originLat, originLng);
        const d = resolveKiwiIata(destId, destLat, destLng);

        let depDate: string;
        if (date) {
          depDate = toKiwiDate(date);
        } else {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          depDate = toKiwiDate(tomorrow.toISOString().slice(0, 10));
        }

        const response = await this.callSearchFlightTool(o, d, depDate, false);

        let realCost = -1;
        let realDuration = -1;

        try {
          const flightDataArr = this.parseFlightListFromResponse(response).slice(0, 3);
          const results = this.mapFlightsToSegments(
            flightDataArr,
            originId,
            destId,
            o,
            d
          );
          if (results.length > 0) return results;
        } catch (err) {
          console.error('[Kiwi MCP] Failed to parse live data:', err);
        }

        return [this.buildFallback(distance, originId, destId, "Kiwi Live (via MCP) [Parse Fallback]")];
      } catch (e: any) {
        console.error("Kiwi MCP Tool Call failed, using fallback:", e.message);
      }
    }

    return [this.buildFallback(distance, originId, destId, "Kiwi MCP (Math Fallback)")];
  }

  /** Min flight price per departure date (ISO). Uses Kiwi ±3 day flex when flexibility=true. */
  async searchPricesByDate(
    flyFrom: string,
    flyTo: string,
    isoDate: string,
    flexibility = false
  ): Promise<Record<string, number>> {
    if (!this.isConnected) await this.connect();
    if (!this.client) return {};

    try {
      const response = await this.callSearchFlightTool(
        flyFrom,
        flyTo,
        isoDate,
        flexibility
      );
      const flights = this.parseFlightListFromResponse(response);
      return this.minPricesByDepartureDate(flights);
    } catch (e: any) {
      console.warn(`[Kiwi MCP] calendar search failed ${flyFrom}->${flyTo} ${isoDate}:`, e.message);
      return {};
    }
  }

  private async callSearchFlightTool(
    flyFrom: string,
    flyTo: string,
    isoOrKiwiDate: string,
    flexibility: boolean
  ) {
    const depDate = isoOrKiwiDate.includes('/')
      ? isoOrKiwiDate
      : toKiwiDate(isoOrKiwiDate);

    const args: Record<string, unknown> = {
      flyFrom,
      flyTo,
      departureDate: depDate,
      curr: 'INR',
      locale: 'en',
      sort: 'price',
      passengers: { adults: 1, children: 0, infants: 0 },
    };
    if (flexibility) {
      args.flexibility = true;
    }

    return this.client!.callTool({
      name: 'search-flight',
      arguments: args,
    });
  }

  private parseFlightListFromResponse(response: unknown): any[] {
    const res = response as { content?: { text?: string }[] };
    const contentArr = res.content;
    if (!contentArr?.length || !contentArr[0].text) return [];

    const parsed = JSON.parse(contentArr[0].text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
    if (parsed.flights && Array.isArray(parsed.flights)) return parsed.flights;
    if (typeof parsed === 'object') return [parsed];
    return [];
  }

  private extractPriceInr(flightData: Record<string, unknown>): number {
    let price = -1;
    if (flightData.price != null) {
      const currency = String(flightData.currency || 'EUR');
      const raw = Number(flightData.price);
      price = currency === 'INR' ? Math.round(raw) : Math.round(raw * 90);
    }
    if (flightData.fare != null) price = Math.round(Number(flightData.fare));
    return price;
  }

  private extractDepartureIso(flightData: Record<string, unknown>): string | null {
    const dep = flightData.departure as { local?: string } | undefined;
    if (!dep?.local) return null;
    const d = new Date(dep.local);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  minPricesByDepartureDate(flights: Record<string, unknown>[]): Record<string, number> {
    const prices: Record<string, number> = {};
    for (const flight of flights) {
      const price = this.extractPriceInr(flight);
      const dateKey = this.extractDepartureIso(flight);
      if (price > 0 && dateKey) {
        prices[dateKey] = prices[dateKey] ? Math.min(prices[dateKey], price) : price;
      }
    }
    return prices;
  }

  private mapFlightsToSegments(
    flightDataArr: Record<string, unknown>[],
    originId: string,
    destId: string,
    expectedFlyFrom: string,
    expectedFlyTo: string
  ): RouteSegment[] {
    const results: RouteSegment[] = [];

    for (let i = 0; i < flightDataArr.length; i++) {
      const flightData = flightDataArr[i];
      const flyFrom = String(flightData.flyFrom || '').toUpperCase();
      const flyTo = String(flightData.flyTo || '').toUpperCase();

      if (flyFrom.includes('-') || flyTo.includes('-')) continue;
      if (expectedFlyFrom && !expectedFlyFrom.includes('-') && flyFrom !== expectedFlyFrom) {
        continue;
      }
      if (expectedFlyTo && !expectedFlyTo.includes('-') && flyTo !== expectedFlyTo) {
        continue;
      }

      const realCost = this.extractPriceInr(flightData);
      let realDuration = -1;
      let layoverStr = '';

      if (flightData.durationInSeconds) {
        realDuration = Math.round(Number(flightData.durationInSeconds) / 60);
      } else if (flightData.totalDurationInSeconds) {
        realDuration = Math.round(Number(flightData.totalDurationInSeconds) / 60);
      } else {
        const durStr = String(flightData.fly_duration || flightData.duration || '');
        let mins = 0;
        const hMatch = durStr.match(/(\d+)\s*h/);
        const mMatch = durStr.match(/(\d+)\s*m/);
        if (hMatch) mins += parseInt(hMatch[1], 10) * 60;
        if (mMatch) mins += parseInt(mMatch[1], 10);
        if (mins > 0) realDuration = mins;
      }

      const layovers = flightData.layovers as { city?: string; at?: string }[] | undefined;
      const stopCount = layovers?.length ?? 0;
      const layoverCities =
        layovers?.map((l) => l.city || l.at).filter((c): c is string => Boolean(c)) ?? [];
      if (layoverCities.length) {
        layoverStr = ' (via ' + layoverCities.join(', ') + ')';
      }

      let depTime = '';
      let arrTime = '';
      const dep = flightData.departure as { local?: string } | undefined;
      const arr = flightData.arrival as { local?: string } | undefined;
      if (dep?.local) {
        depTime = new Date(dep.local).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      if (arr?.local) {
        arrTime = new Date(arr.local).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      if (realCost > 0 && realDuration > 0) {
        results.push({
          id: `flight_${Date.now()}_${i}`,
          type: 'FLIGHT',
          originId,
          originName: 'Airport',
          destinationId: destId,
          destinationName: 'Airport',
          cost: realCost,
          duration: realDuration,
          risk: stopCount > 0 ? 0.3 : 0.1,
          provider: `Kiwi${layoverStr}`,
          departureTime: depTime || undefined,
          arrivalTime: arrTime || undefined,
          bookingUrl: (flightData.deepLink as string) || undefined,
          flyFrom,
          flyTo,
          cityFrom: (flightData.cityFrom as string) || undefined,
          cityTo: (flightData.cityTo as string) || undefined,
          stopCount,
          layoverCities: layoverCities.length ? layoverCities : undefined,
        });
      }
    }
    return results;
  }

  private buildFallback(distance: number, originId: string, destId: string, providerName: string): RouteSegment {
    const variance = (Math.random() * 0.4) + 0.8;
    const cost = Math.round((2000 + (distance * 6)) * variance);
    const duration = Math.round((distance / 700) * 60) + 60;

    return {
      id: `flight_${Date.now()}`,
      type: 'FLIGHT',
      originId,
      originName: 'Airport',
      destinationId: destId,
      destinationName: 'Airport',
      cost,
      duration,
      risk: 0.1,
      provider: providerName
    };
  }
}

export const remoteKiwiClient = new RemoteKiwiClient();
