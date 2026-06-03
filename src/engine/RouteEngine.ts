import { TravelRoute, RouteSegment } from '../models/types';
import { getGeoNode, GeoNode } from './GeoDatabase';
import { getGeoNodeById } from './geoCoords';
import { Haversine } from './Haversine';
import { mcpServer } from '../mcp/LocalMCPServer';
import { flightClient } from '../mcp/FlightClient';
import { GeminiAPI } from '../providers/GeminiAPI';
import { dedupeTrains, parseTimeMinutes, trainIdentity } from '../utils/trainUtils';
import {
  AIRPORT_CONNECTION_BUFFER_MINS,
  annotateTrainConnection,
  filterTrainsForFlight,
  subtractIsoDays,
} from '../utils/trainConnection';
import { applySegmentTimeline } from '../utils/segmentTimeline';

export const MAX_TRAIN_OPTIONS = 10;

export class RouteEngine {

  static async searchRoutes(originQuery: string, destQuery: string, mode: 'cheapest' | 'balanced' | 'fastest', date?: string): Promise<TravelRoute[]> {
    const originCity = getGeoNode(originQuery);
    const destCity = getGeoNode(destQuery);

    if (!originCity || !destCity) {
      throw new Error('City not found in GeoDatabase');
    }

    const destAirport = getGeoNode('apt_' + destCity.id.split('_')[1]);
    if (!destAirport) throw new Error('Destination airport not found');

    const cabToDestRes = await mcpServer.callTool('estimate_cab_fare', { originLat: destAirport.lat, originLng: destAirport.lng, destLat: destCity.lat, destLng: destCity.lng, originId: destAirport.id, destId: destCity.id });
    const cabToDest = JSON.parse(cabToDestRes.content[0].text);
    cabToDest.originName = destAirport.name;
    cabToDest.destinationName = `${destCity.name} Destination`;

    const { findNearbyAirports } = require('./GeoDatabase');
    const nearbyHubs = findNearbyAirports(originCity.lat, originCity.lng, 500);
    const originStation = getGeoNodeById('stn_' + originCity.id.split('_')[1]);

    const routes: TravelRoute[] = [];

    const hubPromises = nearbyHubs.map(async (hub: any) => {
      try {
        const flights = await flightClient.searchFlight(hub.lat, hub.lng, destAirport.lat, destAirport.lng, hub.id, destAirport.id, date, mode);
        if (flights.length === 0) return [];

        const hubRoutes: TravelRoute[] = [];
        const isDirect = hub.cityId === originCity.id;

        if (isDirect) {
          const cabToAptRes = await mcpServer.callTool('estimate_cab_fare', { originLat: originCity.lat, originLng: originCity.lng, destLat: hub.lat, destLng: hub.lng, originId: originCity.id, destId: hub.id });
          const cabToApt = JSON.parse(cabToAptRes.content[0].text);
          cabToApt.originName = `${originCity.name} Home`;
          cabToApt.destinationName = hub.name;

          flights.forEach((flight, idx) => {
            flight.originName = hub.name;
            flight.destinationName = destAirport.name;
            const src = flight.flightSource || 'flight';
            const r = this.buildRoute(`r_${hub.id}_direct_${src}_${idx}`, [cabToApt, flight, cabToDest]);
            r.hubName = originCity.name;
            r.hubLat = hub.lat;
            r.hubLng = hub.lng;
            r.originName = originCity.name;
            r.originLat = originCity.lat;
            r.originLng = originCity.lng;
            if (date) r.travelDate = date;
            hubRoutes.push(r);
          });
        } else {
          const hubCityId = hub.cityId;
          const hubStation = getGeoNodeById('stn_' + hubCityId.split('_')[1]);
          if (!originStation || !hubStation) return [];

          const cabToStnRes = await mcpServer.callTool('estimate_cab_fare', { originLat: originCity.lat, originLng: originCity.lng, destLat: originStation.lat, destLng: originStation.lng, originId: originCity.id, destId: originStation.id });
          const cabToStn = JSON.parse(cabToStnRes.content[0].text);
          cabToStn.originName = `${originCity.name} Home`;
          cabToStn.destinationName = originStation.name;

          const cabToHubAptRes = await mcpServer.callTool('estimate_cab_fare', { originLat: hubStation.lat, originLng: hubStation.lng, destLat: hub.lat, destLng: hub.lng, originId: hubStation.id, destId: hub.id });
          const cabToHubApt = JSON.parse(cabToHubAptRes.content[0].text);
          cabToHubApt.originName = hubStation.name;
          cabToHubApt.destinationName = hub.name;

          const hubCityNode = getGeoNode(hubCityId);
          const hubCityName = hubCityNode ? hubCityNode.name : 'Nearby City';

          for (const [idx, flight] of flights.entries()) {
            flight.originName = hub.name;
            flight.destinationName = destAirport.name;

            const trainPlaceholder = RouteEngine.placeholderTrainSegment(originStation, hubStation);

            const src = flight.flightSource || 'flight';
            const r = this.buildRoute(`r_${hub.id}_indirect_${src}_${idx}`, [cabToStn, trainPlaceholder, cabToHubApt, flight, cabToDest]);
            if (date) r.travelDate = date;
            r.hubName = hubCityName;
            r.hubLat = hub.lat;
            r.hubLng = hub.lng;
            r.originName = originCity.name;
            r.originLat = originCity.lat;
            r.originLng = originCity.lng;
            hubRoutes.push(r);
          }
        }
        return hubRoutes;
      } catch (e) {
        console.error(`Failed to process hub ${hub.name}:`, e);
        return [];
      }
    });

    const resultsArray = await Promise.all(hubPromises);
    resultsArray.forEach(res => routes.push(...res));

    const baselineCost = routes[0]?.totalCost || 10000;

    for (let r of routes) {
      const savings = baselineCost - r.totalCost;
      r.worthItScore = savings > 2000 ? 100 : (savings > 0 ? 50 : 0);
      r.savingsReason = await GeminiAPI.explain(r);
    }

    if (mode === 'cheapest') {
      routes.sort((a, b) => a.totalCost - b.totalCost);
    } else if (mode === 'fastest') {
      routes.sort((a, b) => a.totalDuration - b.totalDuration);
    } else {
      routes.sort((a, b) => {
        const scoreA = (a.totalCost * 0.6) + (a.totalDuration * 10 * 0.4);
        const scoreB = (b.totalCost * 0.6) + (b.totalDuration * 10 * 0.4);
        return scoreA - scoreB;
      });
    }

    return routes;
  }

  /** Estimate-only train segment for search results; live options load on route detail. */
  static placeholderTrainSegment(originStation: GeoNode, hubStation: GeoNode): RouteSegment {
    const distance = Haversine.getDistance(
      originStation.lat,
      originStation.lng,
      hubStation.lat,
      hubStation.lng
    );
    const duration = Math.round((distance / 60) * 60);

    return {
      id: `train_ph_${originStation.id}_${hubStation.id}`,
      type: 'TRAIN',
      originId: originStation.id,
      originName: originStation.name,
      destinationId: hubStation.id,
      destinationName: hubStation.name,
      cost: 0,
      duration,
      risk: 0.2,
      provider: 'Indian Railways (fare in details)',
      fareIsLive: false,
      trainName: `${originStation.name} → ${hubStation.name}`,
      trainNumber: '',
      seatAvailability: [],
      originStationCode: originStation.irctcCode,
      destinationStationCode: hubStation.irctcCode,
    };
  }

  /** Fetch trains for travel date; if none connect to flight, try previous day. */
  static async fetchAndScheduleTrains(
    originStation: GeoNode,
    hubStation: GeoNode,
    travelDate: string | undefined,
    flightDepartureTime: string | undefined,
    cabToAirportMins: number
  ): Promise<{ scheduled: RouteSegment; usedPreviousDay: boolean }> {
    const parseTrains = async (d?: string) => {
      const trainRes = await mcpServer.callTool('search_trains', {
        originLat: originStation.lat,
        originLng: originStation.lng,
        destLat: hubStation.lat,
        destLng: hubStation.lng,
        originId: originStation.id,
        destId: hubStation.id,
        live: true,
        date: d,
      });
      return JSON.parse(trainRes.content[0].text) as RouteSegment[];
    };

    let usedPreviousDay = false;
    let allTrains = await parseTrains(travelDate);
    let scheduled = RouteEngine.scheduleBestTrain(allTrains, flightDepartureTime, cabToAirportMins);

    const validCount = scheduled.trainOptions?.length ?? 0;
    if (validCount === 0 && travelDate && flightDepartureTime) {
      const prevDate = subtractIsoDays(travelDate, 1);
      const prevTrains = await parseTrains(prevDate);
      scheduled = RouteEngine.scheduleBestTrain(prevTrains, flightDepartureTime, cabToAirportMins);
      if (scheduled.trainOptions?.length) {
        usedPreviousDay = true;
        scheduled.trainOptions = scheduled.trainOptions.map((t) => ({
          ...t,
          travelDate: prevDate,
          isPreviousDayTrain: true,
        }));
        if (scheduled.isRecommended !== undefined) {
          scheduled = {
            ...scheduled,
            travelDate: prevDate,
            isPreviousDayTrain: true,
          };
        }
      }
    } else if (travelDate) {
      scheduled.trainOptions = scheduled.trainOptions?.map((t) => ({
        ...t,
        travelDate: t.travelDate || travelDate,
      }));
    }

    return { scheduled, usedPreviousDay };
  }

  /**
   * Pick trains that reach the hub with cab + 2h buffer before flight.
   * Recommended = latest valid arrival (maximizes time at origin).
   */
  public static scheduleBestTrain(
    allTrains: RouteSegment[],
    flightDepartureTime: string | undefined,
    cabToAirportMins: number
  ): RouteSegment {
    if (!allTrains || allTrains.length === 0) return {} as RouteSegment;

    const uniqueTrains = dedupeTrains(allTrains);
    const validTrains = filterTrainsForFlight(uniqueTrains, flightDepartureTime, cabToAirportMins)
      .map((t) => annotateTrainConnection(t, flightDepartureTime, cabToAirportMins));

    if (validTrains.length === 0) {
      return {
        id: 'train_none',
        type: 'TRAIN',
        originId: '',
        originName: '',
        destinationId: '',
        destinationName: '',
        cost: 0,
        duration: 0,
        risk: 0,
        provider: '',
        trainOptions: [],
        totalTrainCount: uniqueTrains.length,
      };
    }

    const byArrival = [...validTrains].sort(
      (a, b) => parseTimeMinutes(a.arrivalTime) - parseTimeMinutes(b.arrivalTime)
    );

    const bestTrain = { ...byArrival[byArrival.length - 1], isRecommended: true };

    const trainOptions: RouteSegment[] = [];
    const bestKey = trainIdentity(bestTrain);
    trainOptions.push(bestTrain);

    for (const t of byArrival) {
      if (trainOptions.length >= MAX_TRAIN_OPTIONS) break;
      if (trainIdentity(t) === bestKey) continue;
      trainOptions.push({ ...t, isRecommended: false });
    }

    return {
      ...bestTrain,
      isRecommended: true,
      alternativeTrains: trainOptions.filter((t) => !t.isRecommended),
      trainOptions,
      totalTrainCount: uniqueTrains.length,
      connectionBufferMins: AIRPORT_CONNECTION_BUFFER_MINS,
    } as RouteSegment & { connectionBufferMins?: number };
  }

  private static buildRoute(id: string, segments: RouteSegment[]): TravelRoute {
    const timed = applySegmentTimeline(segments);
    const totalCost = timed.reduce((sum, s) => sum + s.cost, 0);
    const totalDuration = timed.reduce((sum, s) => sum + s.duration, 0);
    const totalRisk = timed.reduce((sum, s) => sum + s.risk, 0);

    return {
      id,
      segments: timed,
      totalCost,
      totalDuration,
      totalRisk,
    };
  }
}
