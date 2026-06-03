import { GEO_DB } from '../engine/GeoDatabase';
import { getGeoNodeById, getNodeCoords } from '../engine/geoCoords';
import { Haversine } from '../engine/Haversine';
import { RouteSegment } from '../models/types';
import { estimateCab } from '../utils/cabEstimation';
import { mapErailTrain } from '../utils/trainUtils';
import { indianRailwaysMCP } from './IndianRailwaysMCPClient';

const TRAIN_PROVIDER = 'Indian Railways (via MCP)';

export class LocalMCPServer {
  private async fetchLiveTrains(
    originCode: string,
    destCode: string,
    travelDate?: string
  ): Promise<RouteSegment[]> {
    try {
      const trains = await indianRailwaysMCP.getTrainsBetweenStations(
        originCode,
        destCode,
        travelDate
      );
      return trains as unknown as RouteSegment[];
    } catch (e) {
      console.error(`Failed to fetch trains for ${originCode}->${destCode}`, e);
      return [];
    }
  }

  /**
   * Tool: search_trains
   * MCP Tool implementation to search trains dynamically based on distance.
   */
  async callTool(name: string, args: any): Promise<any> {
    if (name === 'search_trains') {
      const { originLat, originLng, destLat, destLng, originId, destId, live, date } = args;
      const distance = Haversine.getDistance(originLat, originLng, destLat, destLng);

      const duration = Math.round((distance / 60) * 60);

      const originNode = GEO_DB.find((n) => n.id === originId);
      const destNode = GEO_DB.find((n) => n.id === destId);
      const originIrctc = originNode?.irctcCode;
      const destIrctc = destNode?.irctcCode;

      let rawTrains: Awaited<ReturnType<typeof indianRailwaysMCP.getTrainsBetweenStations>> = [];
      if (live && originIrctc && destIrctc) {
        rawTrains = await indianRailwaysMCP.getTrainsBetweenStations(
          originIrctc,
          destIrctc,
          date
        );
      }

      let parsedTrains: RouteSegment[] = [];

      if (rawTrains.length > 0) {
        const base = {
          originId,
          destinationId: destId,
          cost: 0,
          duration,
          risk: 0.2,
          provider: TRAIN_PROVIDER,
        };
        parsedTrains = rawTrains.map((t) => {
          const seg = mapErailTrain(t, base, {
            originName: originNode?.name,
            destinationName: destNode?.name,
          });
          if (date) seg.travelDate = date;
          return seg;
        });
      } else {
        parsedTrains.push({
          id: `train_${Date.now()}_${Math.random()}`,
          type: 'TRAIN',
          originId,
          originName: originNode?.name || 'Station',
          destinationId: destId,
          destinationName: destNode?.name || 'Station',
          cost: 0,
          duration,
          risk: 0.2,
          provider: TRAIN_PROVIDER,
          fareIsLive: false,
          trainName: `${originNode?.name || 'Station'} to ${destNode?.name || 'Station'} Express`,
          trainNumber: '',
          seatAvailability: [],
          departureTime: undefined,
          arrivalTime: undefined,
          originStationCode: originIrctc,
          destinationStationCode: destIrctc,
        });
      }

      return { content: [{ type: 'text', text: JSON.stringify(parsedTrains) }] };
    }

    if (name === 'estimate_cab_fare') {
      const { originLat, originLng, destLat, destLng, originId, destId } = args;
      const originNode = getGeoNodeById(originId);
      const destNode = getGeoNodeById(destId);
      const o = originNode ? getNodeCoords(originNode) : { lat: originLat, lng: originLng };
      const d = destNode ? getNodeCoords(destNode) : { lat: destLat, lng: destLng };

      const sameCity = !!(
        originNode?.cityId &&
        destNode?.cityId &&
        originNode.cityId === destNode.cityId
      );
      const est = estimateCab(
        o.lat,
        o.lng,
        d.lat,
        d.lng,
        originNode?.type,
        destNode?.type,
        sameCity
      );

      const segment: RouteSegment = {
        id: `cab_${Date.now()}_${Math.random()}`,
        type: 'CAB',
        originId,
        originName: originNode?.name || 'Location',
        destinationId: destId,
        destinationName: destNode?.name || 'Location',
        cost: est.costInr,
        duration: est.durationMins,
        distanceKm: est.distanceKm,
        straightLineKm: est.straightLineKm,
        avgSpeedKmph: est.avgSpeedKmph,
        risk: 0.05,
        provider: 'Uber / Ola estimate',
      };

      return { content: [{ type: 'text', text: JSON.stringify(segment) }] };
    }

    throw new Error(`Tool ${name} not found on local MCP server.`);
  }
}

export const mcpServer = new LocalMCPServer();
