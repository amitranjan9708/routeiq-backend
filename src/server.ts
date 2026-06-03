import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { searchRouter } from './routes/search';
import { liveTrainRouter } from './routes/liveTrain';
import { calendarPricesRouter } from './routes/calendarPrices';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/search', searchRouter);
app.use('/api/live-trains', liveTrainRouter);
app.use('/api/calendar-prices', calendarPricesRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`RouteIQ Backend listening on port ${PORT}`);
});
