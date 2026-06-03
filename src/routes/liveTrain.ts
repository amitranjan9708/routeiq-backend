import { Router } from 'express';
import { mcpServer } from '../mcp/LocalMCPServer';
import { RouteEngine } from '../engine/RouteEngine';
import { getGeoNode } from '../engine/GeoDatabase';
import { RouteSegment } from '../models/types';
import { AIRPORT_CONNECTION_BUFFER_MINS } from '../utils/trainConnection';

export const liveTrainRouter = Router();

liveTrainRouter.post('/', async (req, res) => {
  const { originId, destId, flightDepartureTime, cabDuration, date } = req.body;

  try {
    const originNode = getGeoNode(originId);
    const destNode = getGeoNode(destId);

    if (!originNode || !destNode) {
      return res.status(400).json({ error: 'Invalid origin or destination ID' });
    }

    const { scheduled: bestTrain, usedPreviousDay } = await RouteEngine.fetchAndScheduleTrains(
      originNode,
      destNode,
      date,
      flightDepartureTime,
      cabDuration || 0
    );

    bestTrain.originName = originNode.name;
    bestTrain.destinationName = destNode.name;

    const enrich = (t: RouteSegment): RouteSegment => ({
      ...t,
      originName: originNode.name,
      destinationName: destNode.name,
      travelDate: t.travelDate || date,
    });

    if (bestTrain.trainOptions) {
      bestTrain.trainOptions = bestTrain.trainOptions.map(enrich);
    }

    res.json({
      segment: bestTrain,
      trainOptions: bestTrain.trainOptions || [],
      totalTrainCount: bestTrain.totalTrainCount ?? 0,
      travelDate: usedPreviousDay ? bestTrain.travelDate : date,
      usedPreviousDay,
      connectionBufferMins: AIRPORT_CONNECTION_BUFFER_MINS,
      cabToAirportMins: cabDuration || 0,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Failed to fetch live trains' });
  }
});
