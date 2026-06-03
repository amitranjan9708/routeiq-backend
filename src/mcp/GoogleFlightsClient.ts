import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { RouteSegment } from '../models/types';
import { Haversine } from '../engine/Haversine';
import { resolveKiwiIata } from './kiwiIata';
import { airlineCodeForName } from '../utils/airlineMetadata';
import { getSharedGoogleFlightsMcp } from './GoogleFlightsMCPClient';
import {
  GoogleFlightRow,
  GoogleFlightsExport,
  GoogleFlightsMcpTool,
  ROUTE_MODE_TO_MCP_TOOL,
  RouteFlightMode,
} from './googleFlightsTypes';

import { vendorPath } from '../utils/vendorRoot';

const DEFAULT_VENDOR = vendorPath('flights-mcp-server');

function parseInrPrice(raw: string | undefined): number {
  if (!raw) return 0;
  const n = raw.replace(/[^\d.]/g, '');
  const v = parseFloat(n);
  return Number.isFinite(v) ? Math.round(v) : 0;
}

function parseClockTime(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const m = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  return m ? m[1].replace(/\s+/g, ' ') : undefined;
}

function parseDurationMins(text: string | undefined): number {
  if (!text) return 0;
  let mins = 0;
  const hoursAnd = text.match(/(\d+)\s*hours?\s+and\s+(\d+)\s*minutes?/i);
  if (hoursAnd) {
    return parseInt(hoursAnd[1], 10) * 60 + parseInt(hoursAnd[2], 10);
  }
  const h = text.match(/(\d+)\s*hr/i) || text.match(/(\d+)\s*hours?/i);
  const m = text.match(/(\d+)\s*min/i) || text.match(/(\d+)\s*minutes?/i);
  if (h) mins += parseInt(h[1], 10) * 60;
  if (m) mins += parseInt(m[1], 10);
  return mins;
}

function googleFlightsBookingUrl(from: string, to: string, date: string): string {
  const q = encodeURIComponent(`Flights from ${from} to ${to} on ${date}`);
  return `https://www.google.com/travel/flights?q=${q}`;
}

function flightKey(f: GoogleFlightRow): string {
  return `${f.name}|${f.departure}|${f.price}|${f.stops}`;
}

function mcpToolLabel(tool: GoogleFlightsMcpTool | undefined): string {
  if (tool === 'get_cheapest_flights') return 'Google Flights · cheapest';
  if (tool === 'get_best_flights') return 'Google Flights · best';
  if (tool === 'get_general_flights_info') return 'Google Flights';
  return 'Google Flights';
}

export class GoogleFlightsClient {
  private vendorDir: string;
  private uvCommand: string;

  constructor() {
    this.vendorDir =
      process.env.GOOGLE_FLIGHTS_VENDOR_DIR ||
      process.env.FLIGHTS_MCP_VENDOR_DIR ||
      DEFAULT_VENDOR;
    this.uvCommand = process.env.UV_BIN || 'uv';
  }

  private scriptPath(): string {
    return path.join(this.vendorDir, 'routeiq_export.py');
  }

  isAvailable(): boolean {
    return (
      fs.existsSync(this.scriptPath()) ||
      fs.existsSync(path.join(this.vendorDir, 'flights.py'))
    );
  }

  /** Prefer vendor .venv (Render build) or GOOGLE_FLIGHTS_PYTHON; else local `uv run`. */
  private exportSpawn(
    origin: string,
    destination: string,
    isoDate: string,
    tool: GoogleFlightsMcpTool
  ): { command: string; args: string[] } {
    const tail = [
      origin.toUpperCase(),
      destination.toUpperCase(),
      isoDate,
      tool,
    ];
    const script = this.scriptPath();
    const fromEnv = process.env.GOOGLE_FLIGHTS_PYTHON;
    if (fromEnv && fs.existsSync(fromEnv)) {
      return { command: fromEnv, args: [script, ...tail] };
    }
    const venvPy = path.join(this.vendorDir, '.venv', 'bin', 'python');
    const venvPyWin = path.join(this.vendorDir, '.venv', 'Scripts', 'python.exe');
    if (fs.existsSync(venvPy)) {
      return { command: venvPy, args: [script, ...tail] };
    }
    if (fs.existsSync(venvPyWin)) {
      return { command: venvPyWin, args: [script, ...tail] };
    }
    return {
      command: this.uvCommand,
      args: ['run', 'python', 'routeiq_export.py', ...tail],
    };
  }

  private runExport(
    origin: string,
    destination: string,
    isoDate: string,
    tool: GoogleFlightsMcpTool
  ): Promise<GoogleFlightsExport> {
    return new Promise((resolve, reject) => {
      const { command, args } = this.exportSpawn(origin, destination, isoDate, tool);
      const child = spawn(command, args, {
        cwd: this.vendorDir,
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => {
        stdout += d.toString();
      });
      child.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      child.on('error', (err) => reject(err));
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr.trim() || `Google Flights export exited ${code}`));
          return;
        }
        try {
          const line = stdout.trim().split('\n').pop() || '{}';
          resolve(JSON.parse(line) as GoogleFlightsExport);
        } catch {
          reject(new Error(`Invalid JSON from Google Flights: ${stdout.slice(0, 200)}`));
        }
      });
    });
  }

  private async fetchFlights(
    flyFrom: string,
    flyTo: string,
    isoDate: string,
    routeMode: RouteFlightMode
  ): Promise<GoogleFlightsExport> {
    const tool = ROUTE_MODE_TO_MCP_TOOL[routeMode];
    const preferMcp = process.env.GOOGLE_FLIGHTS_USE_MCP === '1';

    if (fs.existsSync(this.scriptPath())) {
      const data = await this.runExport(flyFrom, flyTo, isoDate, tool);
      if ((data.flights?.length ?? 0) > 0) {
        return { ...data, tool };
      }
      if (data.error) console.warn('[Google Flights]', data.error);
    }

    if (preferMcp) {
      const mcp = await getSharedGoogleFlightsMcp();
      if (mcp) {
        const data = await mcp.search(flyFrom, flyTo, isoDate, routeMode);
        if ((data.flights?.length ?? 0) > 0) return data;
        if (data.error) console.warn('[Google Flights MCP]', data.error);
      }
    }

    return { error: 'Google Flights not installed', flights: [], tool };
  }

  async searchFlight(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    originId: string,
    destId: string,
    date?: string,
    routeMode: RouteFlightMode = 'cheapest'
  ): Promise<RouteSegment[]> {
    const distance = Haversine.getDistance(originLat, originLng, destLat, destLng);
    const flyFrom = resolveKiwiIata(originId, originLat, originLng);
    const flyTo = resolveKiwiIata(destId, destLat, destLng);

    if (flyFrom.includes('-') || flyTo.includes('-')) {
      console.warn('[Google Flights] Missing IATA for', originId, 'or', destId);
      return [this.buildFallback(distance, originId, destId, 'Google Flights (no IATA)')];
    }

    if (!this.isAvailable()) {
      console.warn('[Google Flights] Vendor not found:', this.vendorDir);
      return [this.buildFallback(distance, originId, destId, 'Google Flights (not installed)')];
    }

    const isoDate =
      date ||
      (() => {
        const t = new Date();
        t.setDate(t.getDate() + 1);
        return t.toISOString().slice(0, 10);
      })();

    const tool = ROUTE_MODE_TO_MCP_TOOL[routeMode];

    try {
      const data = await this.fetchFlights(flyFrom, flyTo, isoDate, routeMode);
      if (data.error) {
        console.warn('[Google Flights]', data.error);
      }
      const segments = this.mapToSegments(
        data.flights || [],
        originId,
        destId,
        flyFrom,
        flyTo,
        isoDate,
        routeMode,
        data.tool || tool
      );
      if (segments.length > 0) return segments.slice(0, 5);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Google Flights] search failed:', msg);
    }

    return [this.buildFallback(distance, originId, destId, 'Google Flights (fallback)')];
  }

  private mapToSegments(
    rows: GoogleFlightRow[],
    originId: string,
    destId: string,
    flyFrom: string,
    flyTo: string,
    isoDate: string,
    routeMode: RouteFlightMode,
    tool: GoogleFlightsMcpTool
  ): RouteSegment[] {
    const seen = new Set<string>();
    const unique: GoogleFlightRow[] = [];
    for (const row of rows) {
      const k = flightKey(row);
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(row);
    }

    let sorted = unique;
    if (routeMode === 'fastest') {
      sorted = [...unique].sort(
        (a, b) => parseDurationMins(a.duration) - parseDurationMins(b.duration)
      );
    } else if (routeMode === 'cheapest') {
      sorted = [...unique].sort((a, b) => parseInrPrice(a.price) - parseInrPrice(b.price));
    }

    const bookingUrl = googleFlightsBookingUrl(flyFrom, flyTo, isoDate);
    const providerBase = mcpToolLabel(tool);
    const results: RouteSegment[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const f = sorted[i];
      const cost = parseInrPrice(f.price);
      const duration = parseDurationMins(f.duration);
      if (cost <= 0 || duration <= 0) continue;

      const airline = f.name?.trim() || 'Flight';
      const stopCount = f.stops ?? 0;

      results.push({
        id: `gflight_${Date.now()}_${i}`,
        type: 'FLIGHT',
        originId,
        originName: 'Airport',
        destinationId: destId,
        destinationName: 'Airport',
        cost,
        duration,
        risk: stopCount > 0 ? 0.3 : 0.1,
        provider: stopCount > 0 ? `${providerBase} (${stopCount} stop)` : providerBase,
        departureTime: parseClockTime(f.departure),
        arrivalTime: parseClockTime(f.arrival),
        bookingUrl,
        airline,
        airlineCode: airlineCodeForName(airline),
        flyFrom,
        flyTo,
        stopCount,
        layoverCities: stopCount > 0 ? [] : undefined,
      });
    }

    return results;
  }

  private buildFallback(
    distance: number,
    originId: string,
    destId: string,
    providerName: string
  ): RouteSegment {
    const variance = Math.random() * 0.4 + 0.8;
    const cost = Math.round((2000 + distance * 6) * variance);
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
      provider: providerName,
    };
  }
}

export const googleFlightsClient = new GoogleFlightsClient();
