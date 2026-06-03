import { Router } from 'express';
import { RouteEngine } from '../engine/RouteEngine';
import { getSkyscannerStatus } from '../mcp/skyscannerState';
import { skyscannerClient } from '../mcp/SkyscannerClient';

export const searchRouter = Router();

searchRouter.post('/', async (req, res) => {
  const { origin, destination, date, travellers, mode = 'cheapest' } = req.body;

  try {
    const routes = await RouteEngine.searchRoutes(origin, destination, mode, date);
    const skyscanner = getSkyscannerStatus();
    const hasSkyscannerRoutes = routes.some((r) =>
      r.segments.some((s) => s.type === 'FLIGHT' && s.flightSource === 'skyscanner')
    );

    // Simulate some latency for the UI
    setTimeout(() => {
      res.json({
        routes,
        flightProviders: {
          skyscanner: {
            configured: skyscannerClient.isAvailable(),
            ...skyscanner,
            resultsInSearch: hasSkyscannerRoutes,
          },
        },
      });
    }, 1500);

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Failed to compute routes' });
  }
});
