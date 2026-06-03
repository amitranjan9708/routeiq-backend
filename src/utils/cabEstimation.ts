import { Haversine } from '../engine/Haversine';
import { GeoNode } from '../engine/GeoDatabase';
import { getNodeCoords } from '../engine/geoCoords';

export interface CabEstimate {
  straightLineKm: number;
  distanceKm: number;
  durationMins: number;
  costInr: number;
  avgSpeedKmph: number;
}

function involvesAirport(originType?: string, destType?: string): boolean {
  return originType === 'AIRPORT' || destType === 'AIRPORT';
}

function involvesStation(originType?: string, destType?: string): boolean {
  return originType === 'STATION' || destType === 'STATION';
}

/** Road distance from straight-line (Indian urban / highway mix). */
export function roadDistanceKm(
  straightKm: number,
  originType?: string,
  destType?: string,
  sameCity?: boolean
): number {
  const airport = involvesAirport(originType, destType);
  const cityToStation =
    sameCity ||
    (originType === 'CITY' && destType === 'STATION') ||
    (originType === 'STATION' && destType === 'CITY');

  let factor = 1.32;
  if (airport && involvesStation(originType, destType)) factor = 1.48;
  else if (airport) factor = 1.42;
  else if (cityToStation) factor = 1.22;
  else if (involvesStation(originType, destType)) factor = 1.35;

  const road = straightKm * factor;
  const rounded = Math.round(road * 10) / 10;

  if (airport && involvesStation(originType, destType)) return Math.max(8, rounded);
  if (airport) return Math.max(5, rounded);
  if (cityToStation || straightKm < 4) return Math.max(straightKm, rounded);
  return Math.max(2, rounded);
}

export function estimateCabDurationMins(
  roadKm: number,
  originType?: string,
  destType?: string,
  sameCity?: boolean
): number {
  const airport = involvesAirport(originType, destType);
  const shortHop =
    sameCity ||
    (!airport &&
      roadKm < 5 &&
      ((originType === 'CITY' && destType === 'STATION') ||
        (originType === 'STATION' && destType === 'CITY')));

  if (shortHop) {
    const speed = 22;
    return Math.max(5, Math.round((roadKm / speed) * 60 + 4));
  }

  let speedKmph: number;
  if (roadKm <= 6) speedKmph = 20;
  else if (roadKm <= 15) speedKmph = 26;
  else if (roadKm <= 35) speedKmph = 32;
  else speedKmph = 38;

  const driveMins = (roadKm / speedKmph) * 60;
  const fixedBuffer = airport ? 18 : 8;
  const trafficBuffer = roadKm > 20 ? 12 : roadKm > 10 ? 8 : 4;

  return Math.max(airport ? 15 : 6, Math.round(driveMins + fixedBuffer + trafficBuffer));
}

export function estimateCabFareInr(
  roadKm: number,
  originType?: string,
  destType?: string,
  sameCity?: boolean
): number {
  const airport = involvesAirport(originType, destType);
  const shortHop =
    sameCity &&
    !airport &&
    roadKm < 5 &&
    ((originType === 'CITY' && destType === 'STATION') ||
      (originType === 'STATION' && destType === 'CITY'));

  if (shortHop) {
    return Math.max(89, Math.round(49 + roadKm * 12));
  }

  const base = airport ? 149 : 79;
  const perKm = airport ? 21 : 15;
  const minFare = airport ? 299 : 149;
  return Math.max(minFare, Math.round(base + roadKm * perKm));
}

export function estimateCab(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  originType?: GeoNode['type'],
  destType?: GeoNode['type'],
  sameCity?: boolean
): CabEstimate {
  const straightLineKm =
    Math.round(
      Haversine.getDistance(originLat, originLng, destLat, destLng) * 10
    ) / 10;
  const distanceKm = roadDistanceKm(straightLineKm, originType, destType, sameCity);
  const durationMins = estimateCabDurationMins(
    distanceKm,
    originType,
    destType,
    sameCity
  );
  const costInr = estimateCabFareInr(distanceKm, originType, destType, sameCity);
  const avgSpeedKmph =
    durationMins > 0 ? Math.round((distanceKm / (durationMins / 60)) * 10) / 10 : 0;

  return {
    straightLineKm: Math.round(straightLineKm * 10) / 10,
    distanceKm,
    durationMins,
    costInr,
    avgSpeedKmph,
  };
}

export function estimateCabBetweenNodes(
  origin: Pick<GeoNode, 'id' | 'lat' | 'lng' | 'type' | 'cityId'>,
  dest: Pick<GeoNode, 'id' | 'lat' | 'lng' | 'type' | 'cityId'>
): CabEstimate {
  const o = getNodeCoords(origin);
  const d = getNodeCoords(dest);
  const sameCity = !!(
    origin.cityId &&
    dest.cityId &&
    origin.cityId === dest.cityId
  );
  return estimateCab(o.lat, o.lng, d.lat, d.lng, origin.type, dest.type, sameCity);
}
