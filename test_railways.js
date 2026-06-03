require('dotenv').config();

async function test() {
  const from = process.argv[2] || 'GAYA';
  const to = process.argv[3] || 'BSB';
  const url = `https://erail.in/rail/getTrains.aspx?Station_From=${from}&Station_To=${to}&DataSource=0&Language=0&Cache=true`;
  console.log(`Fetching ${from} -> ${to}...`);
  const res = await fetch(url);
  const text = await res.text();
  const sections = text.split('~~~~~~~~').filter((s) => s.includes('~^'));
  console.log(`Response sections with trains: ${sections.length}`);
  if (sections[0]) {
    const fields = sections[0].split('~^')[1]?.split('~').filter(Boolean);
    if (fields) {
      console.log(`Sample: ${fields[0]} ${fields[1]} ${fields[10]}-${fields[11]}`);
    }
  }
}

test().catch(console.error);
