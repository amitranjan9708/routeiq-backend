export interface Location {
  id: string;
  name: string;
  type: 'CITY' | 'AIRPORT' | 'STATION' | 'BUS_TERMINAL';
  lat: number;
  lng: number;
  cityId?: string;
}

export interface RouteSegment {
  id: string;
  type: 'FLIGHT' | 'TRAIN' | 'BUS' | 'CAB' | 'METRO' | 'WALKING';
  originId: string;
  originName: string;
  destinationId: string;
  destinationName: string;
  cost: number; // in INR
  duration: number; // in minutes
  risk: number; // 0 to 1
  provider: string;
  departureTime?: string;
  arrivalTime?: string;
  bookingUrl?: string;
  /** Fare source when multiple flight APIs are enabled */
  flightSource?: 'google' | 'kiwi' | 'skyscanner';
  airline?: string;
  airlineCode?: string;
  flightNumber?: string;
  /** Kiwi flight leg airports (IATA) */
  flyFrom?: string;
  flyTo?: string;
  cityFrom?: string;
  cityTo?: string;
  stopCount?: number;
  layoverCities?: string[];
  /** IRCTC codes for ConfirmTkt / IRCTC booking links */
  originStationCode?: string;
  destinationStationCode?: string;
  trainName?: string;
  trainNumber?: string;
  trainType?: string;
  fullRouteOrigin?: string;
  fullRouteDestination?: string;
  runsOn?: string;
  distanceKm?: number;
  /** Straight-line km (cab legs); road distance is in distanceKm */
  straightLineKm?: number;
  avgSpeedKmph?: number;
  /** INR General quota per class from erail.in */
  fareByClass?: Record<string, number>;
  /** Class used for segment `cost` (e.g. SL, 3A) */
  fareClass?: string;
  /** True when `cost` came from erail/MCP, not a distance estimate */
  fareIsLive?: boolean;
  seatAvailability?: string[];
  alternativeTrains?: RouteSegment[];
  /** Top train choices (recommended first) with full segment fields */
  trainOptions?: RouteSegment[];
  totalTrainCount?: number;
  travelDate?: string;
  isPreviousDayTrain?: boolean;
  bufferBeforeFlightMins?: number;
  connectsToFlight?: boolean;
  isRecommended?: boolean;
}

export interface TravelRoute {
  id: string;
  segments: RouteSegment[];
  totalCost: number;
  totalDuration: number;
  totalRisk: number;
  worthItScore?: number;
  savingsReason?: string;
  hubName?: string;
  hubLat?: number;
  hubLng?: number;
  originName?: string;
  originLat?: number;
  originLng?: number;
  travelDate?: string;
}
