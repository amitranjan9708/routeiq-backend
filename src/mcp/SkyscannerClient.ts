import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { RouteSegment } from '../models/types';
import { Haversine } from '../engine/Haversine';
import { resolveKiwiIata } from './kiwiIata';
import { airlineCodeForName } from '../utils/airlineMetadata';
import { RouteFlightMode } from './googleFlightsTypes';
import { markSkyscannerBlocked } from './skyscannerState';

export interface SkyscannerFlightRow {
  name?: string;
  price?: number;
  priceFormatted?: string;
  duration?: number;
  stops?: number;
  departure?: string;
  arrival?: string;
  flyFrom?: string;
  flyTo?: string;
  itineraryId?: string;
  is_best?: boolean;
}

export interface SkyscannerExport {
  origin?: string;
  destination?: string;
  departureDate?: string;
  tool?: string;
  sessionId?: string;
  currency?: string;
  flights?: SkyscannerFlightRow[];
  error?: string;
  errorCode?: string;
  type?: string;
}

import { vendorPath } from '../utils/vendorRoot';

const DEFAULT_VENDOR = vendorPath('mcp-skyscanner');

const MODE_TO_BUCKET: Record<RouteFlightMode, string> = {
  cheapest: 'Cheapest',
  balanced: 'Best',
  fastest: 'Fastest',
};

function skyscannerBookingUrl(from: string, to: string, isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `https://www.skyscanner.net/transport/flights/${from.toLowerCase()}/${to.toLowerCase()}/${y}${m}${d}/`;
}

export class SkyscannerClient {
  private vendorDir: string;
  private pythonCommand: string;

  constructor() {
    this.vendorDir =
      process.env.SKYSCANNER_MCP_VENDOR_DIR ||
      process.env.MCP_SKYSCANNER_VENDOR_DIR ||
      DEFAULT_VENDOR;
    const venvPy = path.join(this.vendorDir, '.venv', 'bin', 'python');
    const venvPyWin = path.join(this.vendorDir, '.venv', 'Scripts', 'python.exe');
    this.pythonCommand =
      process.env.SKYSCANNER_PYTHON ||
      (fs.existsSync(venvPy) ? venvPy : fs.existsSync(venvPyWin) ? venvPyWin : 'python3');
  }

  isAvailable(): boolean {
    return (
      fs.existsSync(path.join(this.vendorDir, 'routeiq_export.py')) &&
      fs.existsSync(path.join(this.vendorDir, 'mcp_server.py'))
    );
  }

  private runExport(
    origin: string,
    destination: string,
    isoDate: string,
    mode: RouteFlightMode
  ): Promise<SkyscannerExport> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        SKYSCANNER_LOCALE: process.env.SKYSCANNER_LOCALE || 'en-IN',
        SKYSCANNER_CURRENCY: process.env.SKYSCANNER_CURRENCY || 'INR',
        SKYSCANNER_MARKET: process.env.SKYSCANNER_MARKET || 'IN',
      };
      const child = spawn(
        this.pythonCommand,
        [
          'routeiq_export.py',
          origin.toUpperCase(),
          destination.toUpperCase(),
          isoDate,
          mode,
        ],
        { cwd: this.vendorDir, env }
      );

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
          reject(new Error(stderr.trim() || `Skyscanner export exited ${code}`));
          return;
        }
        try {
          const line = stdout.trim().split('\n').pop() || '{}';
          resolve(JSON.parse(line) as SkyscannerExport);
        } catch {
          reject(new Error(`Invalid Skyscanner JSON: ${stdout.slice(0, 200)}`));
        }
      });
    });
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
      return [this.buildFallback(distance, originId, destId, 'Skyscanner (no IATA)')];
    }

    if (!this.isAvailable()) {
      return [this.buildFallback(distance, originId, destId, 'Skyscanner (not installed)')];
    }

    const isoDate =
      date ||
      (() => {
        const t = new Date();
        t.setDate(t.getDate() + 1);
        return t.toISOString().slice(0, 10);
      })();

    const bucket = MODE_TO_BUCKET[routeMode];

    try {
      console.log(
        `[Skyscanner] search_flights ${flyFrom}→${flyTo} ${isoDate} bucket=${bucket} (may take 10–30s)`
      );
      const data = await this.runExport(flyFrom, flyTo, isoDate, routeMode);
      if (data.error) {
        console.warn('[Skyscanner]', data.error);
        if (data.errorCode === 'BannedWithCaptcha' || /captcha|403|banned/i.test(data.error)) {
          markSkyscannerBlocked(data.error, data.errorCode);
        }
        return [];
      }
      const segments = this.mapToSegments(
        data.flights || [],
        originId,
        destId,
        flyFrom,
        flyTo,
        isoDate,
        bucket,
        data.currency
      );
      if (segments.length > 0) return segments.slice(0, 5);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Skyscanner] search failed:', msg);
      if (/captcha|403|banned/i.test(msg)) {
        markSkyscannerBlocked(msg);
      }
    }

    return [];
  }

  private mapToSegments(
    rows: SkyscannerFlightRow[],
    originId: string,
    destId: string,
    flyFrom: string,
    flyTo: string,
    isoDate: string,
    bucket: string,
    currency?: string
  ): RouteSegment[] {
    const bookingUrl = skyscannerBookingUrl(flyFrom, flyTo, isoDate);
    const results: RouteSegment[] = [];

    for (let i = 0; i < rows.length; i++) {
      const f = rows[i];
      const cost = typeof f.price === 'number' ? Math.round(f.price) : 0;
      const duration = f.duration ?? 0;
      if (cost <= 0 || duration <= 0) continue;

      const airline = f.name?.trim() || 'Flight';
      const stopCount = f.stops ?? 0;
      const curr = currency || 'INR';

      results.push({
        id: `sky_${Date.now()}_${i}`,
        type: 'FLIGHT',
        originId,
        originName: 'Airport',
        destinationId: destId,
        destinationName: 'Airport',
        cost,
        duration,
        risk: stopCount > 0 ? 0.3 : 0.1,
        provider:
          stopCount > 0
            ? `Skyscanner · ${bucket} (${stopCount} stop)`
            : `Skyscanner · ${bucket}`,
        departureTime: f.departure,
        arrivalTime: f.arrival,
        bookingUrl,
        airline,
        airlineCode: airlineCodeForName(airline),
        flyFrom,
        flyTo,
        stopCount,
        flightSource: 'skyscanner',
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
      flightSource: 'skyscanner',
    };
  }
}

export const skyscannerClient = new SkyscannerClient();
