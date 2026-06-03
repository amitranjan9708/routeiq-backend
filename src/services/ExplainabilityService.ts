import { TravelRoute } from '../models/types';

export class ExplainabilityService {
  static explain(route: TravelRoute): string {
    // In a real implementation, we would call an LLM (e.g. Gemini/OpenAI) here
    // with the route details to generate a natural language explanation.
    
    const hasFlight = route.segments.some(s => s.type === 'FLIGHT');
    const hasTrain = route.segments.some(s => s.type === 'TRAIN');

    if (hasFlight && hasTrain) {
      return "Kolkata has 5x more daily flights than Patna which creates airline competition and lowers fares. Taking the train to Kolkata saves you significantly.";
    } else if (hasFlight) {
      return "This is a direct flight. While faster, it comes at a premium due to limited regional competition.";
    } else {
      return "Ground travel is highly cost-effective, but takes significantly longer.";
    }
  }
}
