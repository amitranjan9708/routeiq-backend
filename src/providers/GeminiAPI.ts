import { TravelRoute } from '../models/types';

export class GeminiAPI {
  static async explain(route: TravelRoute): Promise<string> {
    const geminiKey = process.env.GEMINI_API_KEY;

    const hasFlight = route.segments.some(s => s.type === 'FLIGHT');
    const hasTrain = route.segments.some(s => s.type === 'TRAIN');
    const hasCab = route.segments.some(s => s.type === 'CAB');

    if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
      // In a real scenario, we'd make a request to generative language API:
      // const res = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', ...)
      console.log('Using REAL Gemini API (simulated network request)');
    } else {
      console.log('Gemini API Key missing. Using dynamic fallback engine.');
    }

    // Dynamic Rule-Based AI Fallback
    if (hasFlight && hasTrain) {
      return `By combining a train to the nearest hub and a flight, you saved significantly compared to a direct flight. The ground segment took ${route.totalDuration} mins, but brought the total cost down to ₹${route.totalCost}.`;
    } else if (hasFlight && hasCab && route.segments.length > 2) {
      return `Taking a cab to a nearby major airport offered much cheaper airline fares due to higher competition, saving you money overall.`;
    } else if (hasFlight) {
      return `This is a premium direct flight route. You maximize time savings, arriving in just ${Math.round(route.totalDuration / 60)} hours, but it comes at a higher fare of ₹${route.totalCost}.`;
    } else {
      return `This ground-only route is highly economical. It is much slower than flying but offers the lowest possible door-to-door cost at ₹${route.totalCost}.`;
    }
  }
}
