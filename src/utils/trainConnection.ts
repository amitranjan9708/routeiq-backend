import { RouteSegment } from '../models/types';
import { parseTimeMinutes } from './trainUtils';

/** Minimum time at hub station before flight after train arrival and cab to airport */
export const AIRPORT_CONNECTION_BUFFER_MINS = 120;

/**
 * Minutes between train arrival at hub station and flight departure,
 * minus cab time. Must be >= AIRPORT_CONNECTION_BUFFER_MINS to be valid.
 */
export function bufferMinutesAtHub(
  trainArrivalTime: string | undefined,
  flightDepartureTime: string | undefined,
  cabToAirportMins: number,
  arrivalIsPreviousCalendarDay = false
): number {
  if (!trainArrivalTime || !flightDepartureTime) return -1;
  const flightMins = parseTimeMinutes(flightDepartureTime);
  let arrMins = parseTimeMinutes(trainArrivalTime);
  if (!flightMins && !/\d/.test(flightDepartureTime)) return -1;
  if (!arrMins && !/\d/.test(trainArrivalTime)) return -1;

  if (arrivalIsPreviousCalendarDay) {
    arrMins -= 24 * 60;
  } else if (arrMins > flightMins) {
    // Same day: arrives after flight — missed connection
    return -1;
  }

  return flightMins - arrMins - cabToAirportMins;
}

export function trainFitsFlightConnection(
  train: Pick<RouteSegment, 'arrivalTime' | 'isPreviousDayTrain'>,
  flightDepartureTime: string | undefined,
  cabToAirportMins: number
): boolean {
  if (!flightDepartureTime) return true;
  return (
    bufferMinutesAtHub(
      train.arrivalTime,
      flightDepartureTime,
      cabToAirportMins,
      !!train.isPreviousDayTrain
    ) >= AIRPORT_CONNECTION_BUFFER_MINS
  );
}

export function filterTrainsForFlight(
  trains: RouteSegment[],
  flightDepartureTime: string | undefined,
  cabToAirportMins: number
): RouteSegment[] {
  if (!flightDepartureTime) return trains;
  return trains.filter((t) => trainFitsFlightConnection(t, flightDepartureTime, cabToAirportMins));
}

export function annotateTrainConnection(
  train: RouteSegment,
  flightDepartureTime: string | undefined,
  cabToAirportMins: number
): RouteSegment {
  const buffer = bufferMinutesAtHub(
    train.arrivalTime,
    flightDepartureTime,
    cabToAirportMins,
    !!train.isPreviousDayTrain
  );
  return {
    ...train,
    bufferBeforeFlightMins: buffer,
    connectsToFlight: buffer >= AIRPORT_CONNECTION_BUFFER_MINS,
  };
}

export function subtractIsoDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
