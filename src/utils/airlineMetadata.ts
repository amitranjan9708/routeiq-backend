/** Display name → IATA (Indian carriers we show in UI) */
const NAME_TO_IATA: Record<string, string> = {
  IndiGo: '6E',
  'Air India': 'AI',
  'Air India Express': 'IX',
  SpiceJet: 'SG',
  'Akasa Air': 'QP',
  Vistara: 'UK',
  'Go First': 'G8',
  'AirAsia India': 'I5',
  'Alliance Air': '9I',
};

export function airlineCodeForName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return NAME_TO_IATA[name];
}

export const INDIAN_AIRLINE_NAMES = Object.keys(NAME_TO_IATA);
