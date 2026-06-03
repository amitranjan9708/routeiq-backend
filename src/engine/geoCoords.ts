import { LOCATION_OVERRIDES } from '../data/locationOverrides';
import { GEO_DB, GeoNode } from './GeoDatabase';

export function getGeoNodeById(id: string): GeoNode | undefined {
  return GEO_DB.find((n) => n.id === id);
}

export function getNodeCoords(node: Pick<GeoNode, 'id' | 'lat' | 'lng'>): { lat: number; lng: number } {
  const override = LOCATION_OVERRIDES[node.id];
  if (override) return { ...override };
  return { lat: node.lat, lng: node.lng };
}
