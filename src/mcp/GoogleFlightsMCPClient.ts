import * as fs from 'fs';
import * as path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  GoogleFlightsExport,
  GoogleFlightsMcpTool,
  ROUTE_MODE_TO_MCP_TOOL,
  RouteFlightMode,
} from './googleFlightsTypes';
import { flightLinesFromMcpContent } from './googleFlightsParse';

import { vendorPath } from '../utils/vendorRoot';

const DEFAULT_VENDOR = vendorPath('flights-mcp-server');

let connectPromise: Promise<GoogleFlightsMCPClient | null> | null = null;
let activeClient: GoogleFlightsMCPClient | null = null;

export class GoogleFlightsMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;

  get isConnected(): boolean {
    return this.connected;
  }
  private readonly vendorDir: string;
  private readonly uvCommand: string;
  private callChain: Promise<unknown> = Promise.resolve();

  constructor(vendorDir: string, uvCommand: string) {
    this.vendorDir = vendorDir;
    this.uvCommand = uvCommand;
  }

  static resolveVendorDir(): string {
    return (
      process.env.GOOGLE_FLIGHTS_VENDOR_DIR ||
      process.env.FLIGHTS_MCP_VENDOR_DIR ||
      DEFAULT_VENDOR
    );
  }

  static isMcpAvailable(): boolean {
    const dir = GoogleFlightsMCPClient.resolveVendorDir();
    return fs.existsSync(path.join(dir, 'flights.py'));
  }

  async connect(): Promise<boolean> {
    if (this.connected) return true;

    try {
      this.transport = new StdioClientTransport({
        command: this.uvCommand,
        args: ['--directory', this.vendorDir, 'run', 'flights.py'],
        stderr: 'pipe',
      });
      this.client = new Client({ name: 'RouteIQ', version: '1.0.0' }, { capabilities: {} });
      await this.client.connect(this.transport);
      this.connected = true;
      console.log('[Google Flights MCP] Connected via stdio');
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[Google Flights MCP] stdio connect failed:', msg);
      this.client = null;
      this.transport = null;
      return false;
    }
  }

  /** Serialize MCP calls — stdio server handles one request at a time. */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.callChain.then(fn, fn);
    this.callChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async search(
    origin: string,
    destination: string,
    isoDate: string,
    routeMode: RouteFlightMode
  ): Promise<GoogleFlightsExport> {
    const tool = ROUTE_MODE_TO_MCP_TOOL[routeMode];

    return this.enqueue(async () => {
      if (!(await this.connect()) || !this.client) {
        return { error: 'MCP not connected', flights: [], tool };
      }

      const args: Record<string, string | number> = {
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        departure_date: isoDate,
      };
      if (tool === 'get_general_flights_info') {
        args.n_flights = 25;
      }

      try {
        console.log(`[Google Flights MCP] ${tool} ${args.origin}→${args.destination} ${isoDate}`);
        const response = await this.client.callTool({ name: tool, arguments: args });
        const content = response.content as Array<{ type: string; text?: string }>;
        const texts = content
          ?.filter((c) => c.type === 'text' && c.text)
          .map((c) => c.text as string) ?? [];

        if (texts.length === 1 && typeof texts[0] === 'string' && texts[0].length < 120 && !texts[0].startsWith('This flight')) {
          return { error: texts[0], flights: [], tool, origin, destination, departureDate: isoDate };
        }

        const flights = flightLinesFromMcpContent(texts);
        return {
          origin: origin.toUpperCase(),
          destination: destination.toUpperCase(),
          departureDate: isoDate,
          tool,
          flights,
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { error: msg, flights: [], tool };
      }
    });
  }

  async close(): Promise<void> {
    if (this.client) await this.client.close();
    this.client = null;
    this.transport = null;
    this.connected = false;
  }
}

export async function getSharedGoogleFlightsMcp(): Promise<GoogleFlightsMCPClient | null> {
  if (!GoogleFlightsMCPClient.isMcpAvailable()) return null;

  if (activeClient?.isConnected) return activeClient;

  if (!connectPromise) {
    const vendorDir = GoogleFlightsMCPClient.resolveVendorDir();
    const uv = process.env.UV_BIN || 'uv';
    connectPromise = (async () => {
      const c = new GoogleFlightsMCPClient(vendorDir, uv);
      const ok = await c.connect();
      if (ok) {
        activeClient = c;
        return c;
      }
      return null;
    })();
  }

  return connectPromise;
}
