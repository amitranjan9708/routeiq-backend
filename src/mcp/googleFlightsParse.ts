import { GoogleFlightRow } from './googleFlightsTypes';

/** Parse human-readable strings from flights-mcp-server format_flight_info(). */
export function parseMcpFlightDescription(text: string): GoogleFlightRow | null {
  if (!text.startsWith('This flight')) return null;

  const name = text.match(/operated by (.+?) and has a duration/i)?.[1]?.trim();
  const price = text.match(/price is ([^]+?)(?:\s+and is|\s*$)/i)?.[1]?.trim();
  const dep = text.match(/departs at (.+?) from/i)?.[1]?.trim();
  const arr = text.match(/arrives at (.+?) in [A-Z]{3},/i)?.[1]?.trim();
  const duration = text.match(/duration of (.+?) with/i)?.[1]?.trim();

  let stops = 0;
  const stopsMatch = text.match(/with (non-stop|\d+ stops?)/i);
  if (stopsMatch) {
    if (stopsMatch[1].toLowerCase() !== 'non-stop') {
      stops = parseInt(stopsMatch[1], 10) || 0;
    }
  }

  const is_best = text.includes('considered one of the best');

  if (!name || !price) return null;

  return {
    name,
    price,
    departure: dep,
    arrival: arr,
    duration,
    stops,
    is_best,
  };
}

export function flightLinesFromMcpContent(lines: string[]): GoogleFlightRow[] {
  const rows: GoogleFlightRow[] = [];
  for (const line of lines) {
    const row = parseMcpFlightDescription(line);
    if (row) rows.push(row);
  }
  return rows;
}
