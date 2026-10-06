export type NodeType = 
  | 'tower' 
  | 'olt' 
  | 'nap' 
  | 'switch' 
  | 'antenna' 
  | 'customer' 
  | 'server' 
  | 'pole' 
  | 'custom';

export type LineType = 
  | 'trunk' 
  | 'distribution' 
  | 'drop' 
  | 'wireless_ptp' 
  | 'copper';

export interface MapNode {
  id: string;
  name: string;
  type: NodeType;
  icon: string; // Key or URL
  color: string;
  lat: number;
  lng: number;
  address?: string;
  capacity?: string;
  status: 'active' | 'maintenance' | 'offline';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MapLine {
  id: string;
  name: string;
  type: LineType;
  fromNodeId?: string;
  toNodeId?: string;
  coordinates: [number, number][]; // [lng, lat]
  color: string;
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
  distanceMeters: number;
  cores?: number;
  status: 'active' | 'attenuated' | 'broken';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MapArea {
  id: string;
  name: string;
  coordinates: [number, number][]; // [lng, lat]
  fillColor: string;
  strokeColor: string;
  fillOpacity: number;
  surfaceAreaKm2?: number;
  status: 'active' | 'expansion' | 'planned';
  targetCustomers?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MapboxSettings {
  enabled: boolean;
  accessToken: string;
  defaultStyle: string;
  defaultCenter: [number, number]; // [lng, lat]
  defaultZoom: number;
}

export interface MapTenantData {
  tenantId: string;
  center: [number, number];
  zoom: number;
  style: string;
  nodes: MapNode[];
  lines: MapLine[];
  areas: MapArea[];
  updatedAt: string;
}

export interface MapStats {
  totalNodes: number;
  totalLines: number;
  totalAreas: number;
  totalDistanceKm: number;
  totalSurfaceKm2: number;
  nodesByType: Record<string, number>;
  linesByType: Record<string, number>;
}
