import { getGeoNode } from '../engine/GeoDatabase';
import { getGeoNodeById } from '../engine/geoCoords';

/** City / airport node id → IATA (Kiwi flyFrom / flyTo). */
export const KIWI_IATA_MAP: Record<string, string> = {
  city_delhi: 'DEL',
  city_mumbai: 'BOM',
  city_kolkata: 'CCU',
  city_bangalore: 'BLR',
  city_chennai: 'MAA',
  city_hyderabad: 'HYD',
  city_pune: 'PNQ',
  city_ahmedabad: 'AMD',
  city_jaipur: 'JAI',
  city_patna: 'PAT',
  city_lucknow: 'LKO',
  city_chandigarh: 'IXC',
  city_kochi: 'COK',
  city_goa: 'GOI',
  city_indore: 'IDR',
  city_guwahati: 'GAU',
  city_bhubaneswar: 'BBI',
  city_bhopal: 'BHO',
  city_surat: 'STV',
  city_gaya: 'GAY',
  city_varanasi: 'VNS',
  city_ranchi: 'IXR',
  city_nagpur: 'NAG',
  city_vadodara: 'BDQ',
  city_visakhapatnam: 'VTZ',
  city_coimbatore: 'CJB',
  city_madurai: 'IXM',
  city_amritsar: 'ATQ',
  city_dehradun: 'DED',
  city_mangalore: 'IXE',
  city_agra: 'AGR',
  city_kanpur: 'KNU',
  city_thiruvananthapuram: 'TRV',
  city_jodhpur: 'JDH',
  city_udaipur: 'UDR',
  city_vijayawada: 'VGA',
  city_tirupati: 'TIR',
  city_rajkot: 'RAJ',
  city_aurangabad: 'IXU',
  city_nashik: 'ISK',
  city_gwalior: 'GWL',
  city_jabalpur: 'JLR',
  city_siliguri: 'IXB',
  city_gorakhpur: 'GOP',
  city_durgapur: 'RDP',
  city_asansol: 'RDP',
  city_darbhanga: 'DBR',
  city_prayagraj: 'IXD',
  city_jammu: 'IXJ',
  city_srinagar: 'SXR',
  city_leh: 'IXL',
  city_shillong: 'SHL',
  city_agartala: 'IXA',
  city_dibrugarh: 'DIB',
  city_silchar: 'IXS',
  city_tiruchirappalli: 'TRZ',
};

/** Resolve Kiwi search endpoint from a geo node id (apt_*, stn_*, city_*). */
export function resolveKiwiIata(geoId: string, lat: number, lng: number): string {
  const cityKey = geoId.replace(/^(apt_|stn_)/, 'city_');
  if (KIWI_IATA_MAP[cityKey]) return KIWI_IATA_MAP[cityKey];
  if (KIWI_IATA_MAP[geoId]) return KIWI_IATA_MAP[geoId];

  const node = getGeoNodeById(geoId);
  if (node?.cityId && KIWI_IATA_MAP[node.cityId]) {
    return KIWI_IATA_MAP[node.cityId];
  }

  return `${lat.toFixed(4)}-${lng.toFixed(4)}-20km`;
}

export function resolveKiwiEndpoints(
  originQuery: string,
  destQuery: string
): { flyFrom: string; flyTo: string } | null {
  const originCity = getGeoNode(originQuery);
  const destCity = getGeoNode(destQuery);
  if (!originCity || !destCity) return null;

  const flyFrom =
    KIWI_IATA_MAP[originCity.id] ||
    `${originCity.lat}-${originCity.lng}-50km`;
  const flyTo =
    KIWI_IATA_MAP[destCity.id] ||
    `${destCity.lat}-${destCity.lng}-50km`;

  return { flyFrom, flyTo };
}

export function toKiwiDate(isoDate: string): string {
  const parsed = new Date(isoDate + 'T00:00:00');
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
