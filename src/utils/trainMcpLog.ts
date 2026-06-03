import { ErailTrainBase } from '../services/indianRailways/erailClient';
import { RouteSegment } from '../models/types';

/** Set TRAIN_MCP_DEBUG=1 in .env to log train MCP / erail responses (including fares). */
export function trainMcpDebugEnabled(): boolean {
  return process.env.TRAIN_MCP_DEBUG === '1' || process.env.TRAIN_MCP_DEBUG === 'true';
}

function sampleTrains(trains: ErailTrainBase[], limit = 5) {
  return trains.slice(0, limit).map((t) => ({
    trainNumber: t.trainNumber,
    trainName: t.trainName?.slice(0, 40),
    departureTime: t.departureTime,
    arrivalTime: t.arrivalTime,
    fareByClass: t.fareByClass ?? null,
    classesAvailable: t.classesAvailable ?? null,
    hasFares: !!(t.fareByClass && Object.keys(t.fareByClass).length > 0),
  }));
}

function sampleSegments(segments: RouteSegment[], limit = 5) {
  return segments.slice(0, limit).map((s) => ({
    trainNumber: s.trainNumber,
    cost: s.cost,
    fareClass: s.fareClass,
    fareIsLive: s.fareIsLive,
    fareByClass: s.fareByClass ?? null,
  }));
}

export function logTrainSource(
  source: string,
  from: string,
  to: string,
  date: string | undefined,
  trains: ErailTrainBase[]
): void {
  if (!trainMcpDebugEnabled()) return;
  const withFares = trains.filter((t) => t.fareByClass && Object.keys(t.fareByClass).length > 0);
  console.log(
    '[Train MCP]',
    JSON.stringify({
      event: 'trains_fetched',
      source,
      from,
      to,
      date: date ?? null,
      count: trains.length,
      withFares: withFares.length,
      sample: sampleTrains(trains),
    })
  );
}

export function logMcpToolRaw(
  toolName: string,
  from: string,
  to: string,
  text: string | undefined,
  parsed: { success?: boolean; data?: unknown } | null
): void {
  if (!trainMcpDebugEnabled()) return;
  const preview = text ? text.slice(0, 800) : null;
  let parsedSample: unknown = null;
  if (parsed?.success && Array.isArray(parsed.data)) {
    const rows = parsed.data as Array<{ trainBase?: ErailTrainBase; train_base?: ErailTrainBase }>;
    parsedSample = rows.slice(0, 3).map((row) => {
      const tb = row.trainBase || row.train_base;
      return tb
        ? {
            trainNumber: tb.trainNumber,
            keys: Object.keys(tb),
            fareByClass: (tb as ErailTrainBase).fareByClass ?? 'MISSING',
          }
        : row;
    });
  }
  console.log(
    '[Train MCP]',
    JSON.stringify({
      event: 'mcp_tool_response',
      tool: toolName,
      from,
      to,
      parseSuccess: parsed?.success ?? false,
      rowCount: Array.isArray(parsed?.data) ? parsed.data.length : 0,
      rawPreview: preview,
      parsedSample,
    })
  );
}

export function logMappedTrainSegments(
  context: string,
  from: string,
  to: string,
  segments: RouteSegment[]
): void {
  if (!trainMcpDebugEnabled()) return;
  const live = segments.filter((s) => s.fareIsLive);
  console.log(
    '[Train MCP]',
    JSON.stringify({
      event: 'segments_mapped',
      context,
      from,
      to,
      count: segments.length,
      fareIsLive: live.length,
      sample: sampleSegments(segments),
    })
  );
}
