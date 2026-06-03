import 'dotenv/config';
import { indianRailwaysMCP } from '../mcp/IndianRailwaysMCPClient';

async function main() {
  const from = process.argv[2] || 'GAYA';
  const to = process.argv[3] || 'BSB';
  console.log(`Testing Indian Railways MCP: ${from} -> ${to}`);
  const trains = await indianRailwaysMCP.getTrainsBetweenStations(from, to);
  console.log(`Found ${trains.length} trains`);
  if (trains[0]) {
    const t = trains[0];
    console.log(
      'Sample:',
      t.trainNumber,
      t.trainName,
      `${t.departureTime} -> ${t.arrivalTime}`
    );
  }
  await indianRailwaysMCP.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
