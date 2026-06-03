/** MCP tool names from flights-mcp-server (flights.py). */
export type GoogleFlightsMcpTool =
  | 'get_cheapest_flights'
  | 'get_best_flights'
  | 'get_general_flights_info';

export type RouteFlightMode = 'cheapest' | 'balanced' | 'fastest';

export const ROUTE_MODE_TO_MCP_TOOL: Record<RouteFlightMode, GoogleFlightsMcpTool> = {
  cheapest: 'get_cheapest_flights',
  balanced: 'get_best_flights',
  fastest: 'get_general_flights_info',
};

export interface GoogleFlightRow {
  is_best?: boolean;
  name?: string;
  departure?: string;
  arrival?: string;
  duration?: string;
  stops?: number;
  price?: string;
}

export interface GoogleFlightsExport {
  origin?: string;
  destination?: string;
  departureDate?: string;
  currentPrice?: string;
  tool?: GoogleFlightsMcpTool;
  flights?: GoogleFlightRow[];
  error?: string;
}
