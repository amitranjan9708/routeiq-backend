import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  ErailBetweenStationsResult,
  ErailTrainBase,
  fetchTrainsBetweenStations,
  filterTrainRowsByDate,
} from '../services/indianRailways/erailClient';

const MCP_SERVER_PKG = 'indian-railways-mcp';
const nodeRequire = createRequire(__filename);

import { vendorPath } from '../utils/vendorRoot';

const VENDOR_MCP_ENTRY = vendorPath('indian-railways-mcp/build/index.js');

function resolveMcpServerEntry(): string | null {
  const candidates = [
    process.env.INDIAN_RAILWAYS_MCP_SERVER,
    VENDOR_MCP_ENTRY,
  ].filter(Boolean) as string[];

  try {
    const pkgPath = nodeRequire.resolve(`${MCP_SERVER_PKG}/package.json`);
    candidates.push(path.join(path.dirname(pkgPath), 'build', 'index.js'));
  } catch {
    /* optional npm package */
  }

  for (const entry of candidates) {
    if (fs.existsSync(entry)) return entry;
  }
  return null;
}

function parseMcpToolJson(text: string): ErailBetweenStationsResult | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  try {
    return JSON.parse(text.slice(start)) as ErailBetweenStationsResult;
  } catch {
    return null;
  }
}

export class IndianRailwaysMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connected = false;
  private useSubprocess = false;

  async connect(): Promise<boolean> {
    if (this.connected) return true;

    const serverEntry = resolveMcpServerEntry();
    if (serverEntry) {
      try {
        this.transport = new StdioClientTransport({
          command: 'node',
          args: [serverEntry],
          stderr: 'pipe',
        });
        this.client = new Client({ name: 'RouteIQ', version: '1.0.0' }, { capabilities: {} });
        await this.client.connect(this.transport);
        this.connected = true;
        this.useSubprocess = true;
        console.log('[Indian Railways MCP] Connected via stdio to', serverEntry);
        return true;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[Indian Railways MCP] Subprocess failed, using direct erail.in:', msg);
        this.client = null;
        this.transport = null;
      }
    }

    this.connected = true;
    this.useSubprocess = false;
    console.log('[Indian Railways MCP] Using direct erail.in (same source as indian-railways-mcp)');
    return true;
  }

  async getTrainsBetweenStations(
    from: string,
    to: string,
    travelDate?: string
  ): Promise<ErailTrainBase[]> {
    await this.connect();

    const fromCode = from.toUpperCase();
    const toCode = to.toUpperCase();
    const isoDate = travelDate?.trim() || undefined;

    if (isoDate && this.useSubprocess && this.client) {
      try {
        const response = await this.client.callTool({
          name: 'get-trains-on-date',
          arguments: { from: fromCode, to: toCode, date: isoDate },
        });
        const content = response.content as Array<{ type: string; text?: string }>;
        const text = content?.find((c) => c.type === 'text')?.text;
        if (text) {
          const parsed = parseMcpToolJson(text);
          if (parsed?.success && Array.isArray(parsed.data)) {
            const rows = parsed.data as Array<{ trainBase?: ErailTrainBase; train_base?: ErailTrainBase }>;
            const trains = rows
              .map((row) => row.trainBase || row.train_base)
              .filter(Boolean) as ErailTrainBase[];
            if (trains.length > 0) return trains;
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[Indian Railways MCP] get-trains-on-date failed:', msg);
      }
    }

    if (this.useSubprocess && this.client) {
      try {
        const response = await this.client.callTool({
          name: 'get-trains-between-stations',
          arguments: { from: fromCode, to: toCode },
        });
        const content = response.content as Array<{ type: string; text?: string }>;
        const text = content?.find((c) => c.type === 'text')?.text;
        if (text) {
          const parsed = parseMcpToolJson(text);
          if (parsed?.success && Array.isArray(parsed.data)) {
            let rows = parsed.data;
            if (isoDate) rows = filterTrainRowsByDate(rows, isoDate);
            return rows.map((row) => row.trainBase).filter(Boolean);
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[Indian Railways MCP] Tool call failed, falling back to erail:', msg);
      }
    }

    const direct = await fetchTrainsBetweenStations(fromCode, toCode, isoDate);
    if (!direct.success || !Array.isArray(direct.data)) {
      console.warn('[Indian Railways] No trains:', direct.data ?? direct.error);
      return [];
    }
    return direct.data.map((row) => row.trainBase).filter(Boolean);
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
    this.client = null;
    this.transport = null;
    this.connected = false;
  }
}

export const indianRailwaysMCP = new IndianRailwaysMCPClient();
