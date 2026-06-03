const CONFIRMTKT_BASE = 'https://www.confirmtkt.com/rbooking/trains';

export function toConfirmTktDate(isoDate: string): string | null {
  const m = String(isoDate).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function buildConfirmTktTrainUrl(
  fromCode: string,
  toCode: string,
  isoDate?: string
): string | null {
  const from = String(fromCode || '').trim().toUpperCase();
  const to = String(toCode || '').trim().toUpperCase();
  const pathDate = isoDate ? toConfirmTktDate(isoDate) : null;
  if (!from || !to || !pathDate) return null;
  return `${CONFIRMTKT_BASE}/from/${from}/to/${to}/${pathDate}`;
}
