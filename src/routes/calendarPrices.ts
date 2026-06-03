import { Router } from 'express';
import { fetchFlightCalendarPrices } from '../services/flightCalendarPrices';

export const calendarPricesRouter = Router();

calendarPricesRouter.get('/', async (req, res) => {
  const origin = String(req.query.origin || '').trim();
  const destination = String(req.query.destination || '').trim();
  const year = parseInt(String(req.query.year || ''), 10);
  const month = parseInt(String(req.query.month || ''), 10);

  if (!origin || !destination) {
    return res.status(400).json({ error: 'origin and destination are required' });
  }
  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ error: 'valid year and month are required' });
  }

  try {
    const { prices, source, cached } = await fetchFlightCalendarPrices(
      origin,
      destination,
      year,
      month
    );

    const values = Object.values(prices).filter((p) => p > 0);
    const minPrice = values.length ? Math.min(...values) : null;

    res.json({
      origin,
      destination,
      year,
      month,
      prices,
      minPrice,
      source,
      cached: !!cached,
      disclaimer:
        'Indicative direct flight fares from Kiwi.com (INR). Full door-to-door route may differ.',
    });
  } catch (error: unknown) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Failed to load calendar prices';
    res.status(500).json({ error: message });
  }
});
