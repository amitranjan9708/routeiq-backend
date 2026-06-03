import { flightClient } from '../mcp/FlightClient';

async function main() {
  console.log('Provider:', flightClient.activeProvider, 'google:', flightClient.usesGoogle, 'kiwi:', flightClient.usesKiwi);
  for (const mode of ['cheapest', 'balanced', 'fastest'] as const) {
    console.log('\n--- mode:', mode, '---');
    const segs = await flightClient.searchFlight(
      25.5913,
      85.087,
      13.1986,
      77.7066,
      'apt_patna',
      'apt_bangalore',
      '2026-08-02',
      mode
    );
    console.log(
      segs[0]?.provider,
      segs[0]?.airline,
      '₹' + segs[0]?.cost,
      segs[0]?.departureTime
    );
  }
}

main().catch(console.error);
