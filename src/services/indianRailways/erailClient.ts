/**
 * Free erail.in train search — same data source as
 * https://github.com/rajprem4214/indian-railways-mcp
 */

import {
  ErailFareByClass,
  isErailFareSection,
  parseErailFareSection,
} from './erailFares';

export interface ErailTrainBase {
  trainNumber: string;
  trainName: string;
  sourceStationName: string;
  sourceStationCode: string;
  destinationStationName: string;
  destinationStationCode: string;
  fromStationName: string;
  fromStationCode: string;
  toStationName: string;
  toStationCode: string;
  departureTime: string;
  arrivalTime: string;
  travelDuration: string;
  operatingDays: string;
  /** INR General quota fares from erail (per class) */
  fareByClass?: ErailFareByClass;
  classesAvailable?: string[];
  trainType?: string;
  /** Parsed availability lines from erail (e.g. "2A: 12 / 7") */
  erailSeatAvailability?: string[];
}

export interface ErailBetweenStationsResult {
  success: boolean;
  time_stamp?: number;
  data?: Array<{ trainBase: ErailTrainBase }> | string;
  error?: string;
}

/** Port of indian-railways-mcp parseBetweenStationsData (string protocol, no browser). */
export function parseBetweenStationsData(rawData: string): ErailBetweenStationsResult {
  try {
    let trainInfo: Partial<ErailTrainBase> = {};
    const result: ErailBetweenStationsResult = { success: false };
    const trainList: Array<{ trainBase: ErailTrainBase }> = [];
    let sections = rawData.split('~~~~~~~~');
    let noRoute = sections[0].split('~');
    noRoute = noRoute[5]?.split('<') ?? noRoute;

    if (noRoute[0] === 'No direct trains found') {
      return { success: false, time_stamp: Date.now(), data: noRoute[0] };
    }

    if (
      sections[0] === '~~~~~Please try again after some time.' ||
      sections[0] === '~~~~~From station not found' ||
      sections[0] === '~~~~~To station not found'
    ) {
      return { success: false, time_stamp: Date.now(), data: sections[0].replaceAll('~', '') };
    }

    sections = sections.filter((el) => el !== '');
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      if (!section.includes('~^')) continue;

      const trainData = section.split('~^');
      if (trainData.length < 2) continue;

      const fields = trainData[1].split('~').filter((el) => el !== '');
      trainInfo = {
        trainNumber: fields[0],
        trainName: fields[1],
        sourceStationName: fields[2],
        sourceStationCode: fields[3],
        destinationStationName: fields[4],
        destinationStationCode: fields[5],
        fromStationName: fields[6],
        fromStationCode: fields[7],
        toStationName: fields[8],
        toStationCode: fields[9],
        departureTime: fields[10],
        arrivalTime: fields[11],
        travelDuration: fields[12],
        operatingDays: fields[13],
      };

      const next = sections[i + 1];
      if (next && isErailFareSection(next)) {
        const extras = parseErailFareSection(next);
        trainInfo.fareByClass = extras.fareByClass;
        trainInfo.classesAvailable = Object.keys(extras.fareByClass).filter(
          (k) => (extras.fareByClass[k as keyof typeof extras.fareByClass] ?? 0) > 0
        );
        if (extras.trainType) trainInfo.trainType = extras.trainType;
        if (extras.seatAvailability.length) {
          trainInfo.erailSeatAvailability = extras.seatAvailability;
        }
        i += 1;
      }

      trainList.push({ trainBase: trainInfo as ErailTrainBase });
      trainInfo = {};
    }

    return { success: true, time_stamp: Date.now(), data: trainList };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/** ISO date YYYY-MM-DD → day index 0=Sun … 6=Sat for erail operatingDays bitmask */
export function dayIndexFromIsoDate(isoDate: string): number {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.getDay();
}

export function trainRunsOnDate(operatingDays: string | undefined, isoDate: string): boolean {
  if (!operatingDays || operatingDays.length < 7) return true;
  const day = dayIndexFromIsoDate(isoDate);
  return operatingDays[day] === '1';
}

export function filterTrainRowsByDate(
  rows: Array<{ trainBase: ErailTrainBase }>,
  isoDate?: string
): Array<{ trainBase: ErailTrainBase }> {
  if (!isoDate) return rows;
  return rows.filter(({ trainBase }) => trainRunsOnDate(trainBase.operatingDays, isoDate));
}

export async function fetchTrainsBetweenStations(
  from: string,
  to: string,
  isoDate?: string
): Promise<ErailBetweenStationsResult> {
  const url = `https://erail.in/rail/getTrains.aspx?Station_From=${from.toUpperCase()}&Station_To=${to.toUpperCase()}&DataSource=0&Language=0&Cache=true`;
  const response = await fetch(url);
  const data = await response.text();
  const parsed = parseBetweenStationsData(data);
  if (!isoDate || !parsed.success || !Array.isArray(parsed.data)) return parsed;
  return {
    ...parsed,
    data: filterTrainRowsByDate(parsed.data, isoDate),
  };
}
