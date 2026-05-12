"use client";

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Activity, Droplet, Waves, Fish, Map as MapIcon, Database, Terminal, AlertTriangle, ShieldCheck, RefreshCw, Download, MapPin, Search, Globe, Wind } from 'lucide-react';

const REGIONS = {
  biafo: {
    id: 'biafo',
    name: "Biafo Glacier, Pakistan (Indus Basin)",
    coords: [75.9167, 35.6833],
    zoom: 10,
    metrics: { mass: "-12.4", vol: "628", volLabel: "km³", sal: "9.8", salStatus: "warning", flow: "420", pop: "1,987 indv." },
    ragQuery: "Impact of 10% melt decrease on Sukkur-Guddu?",
    ragAnalysis: "According to the LSTM mass balance forecasting model, a 10% decrease in Biafo meltwater output will elevate salinity levels in the Sukkur-Guddu segment to 10.4 PSU within 45 days.",
    ragAlert: "This exceeds the functional threshold of 10 PSU, precipitating corneal edema and electrolyte abnormalities in Platanista gangetica minor (Indus River Dolphin)."
  },
  thwaites: {
    id: 'thwaites',
    name: "Thwaites Glacier, Antarctica",
    coords: [-106.75, -75.5],
    zoom: 8,
    metrics: { mass: "-50.0", vol: "192k", volLabel: "km³", sal: "34.5", salStatus: "critical", flow: "1,200", pop: "N/A" },
    ragQuery: "Grounding line retreat velocity and oceanic thermal forcing?",
    ragAnalysis: "Recent basal melt observations indicate an accelerated retreat of 1.2 km/yr due to Circumpolar Deep Water (CDW) intrusion. Ice shelf disintegration is destabilizing the broader West Antarctic Ice Sheet.",
    ragAlert: "Imminent catastrophic calving event detected. Expected global mean sea level (GMSL) contribution: +0.65m upon complete structural collapse."
  },
  aletsch: {
    id: 'aletsch',
    name: "Aletsch Glacier, Switzerland (Alps)",
    coords: [8.0167, 46.4333],
    zoom: 11,
    metrics: { mass: "-2.1", vol: "11.5", volLabel: "km³", sal: "0.1", salStatus: "safe", flow: "18", pop: "Critical" },
    ragQuery: "Hydrological shift and Alpine biodiversity collapse?",
    ragAnalysis: "Summer meltwater buffering capacity for the Rhone basin will be reduced by 60% by 2050. This thermal shift drastically disrupts the spawning cycles of cold-water adapted endemic species.",
    ragAlert: "Severe downstream agricultural water shortages projected for the European Rhone basin during late summer peaks, exacerbating local drought conditions."
  }
};

export default function Dashboard() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [logs, setLogs] = useState<Array<{time: string, msg: string, type: 'info'|'warn'|'error'}>>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeRegionId, setActiveRegionId] = useState<keyof typeof REGIONS>('biafo');

  const addLog = (msg: string, type: 'info'|'warn'|'error' = 'info') => {
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 15));
  };

  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const regionId = e.target.value as keyof typeof REGIONS;
    setActiveRegionId(regionId);
    const region = REGIONS[regionId];
    
    addLog(`Focus shifted to ${region.name}. Fetching real-time sensor data...`, 'info');
    
    if (map.current) {
      map.current.flyTo({
        center: region.coords as [number, number],
        zoom: region.zoom,
        pitch: 65,
        bearing: -30,
        duration: 3000
      });
    }
  };

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    addLog("Initializing Global Geospatial Intelligence Pipeline...");
    
    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        // Using ESRI World Imagery (free high-res satellite) wrapped in a MapLibre style object
        style: {
          version: 8,
          sources: {
            'satellite': {
              type: 'raster',
              tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
              ],
              tileSize: 256,
              maxzoom: 19
            }
          },
          layers: [
            {
              id: 'satellite-layer',
              type: 'raster',
              source: 'satellite',
              paint: {}
            }
          ]
        },
        center: REGIONS.biafo.coords as [number, number],
        zoom: REGIONS.biafo.zoom,
        pitch: 65,
        bearing: -30,
        antialias: true
      });

      map.current.on('style.load', () => {
        if (!map.current) return;
        setMapLoaded(true);
        addLog("Global satellite imagery loaded successfully.");
        
        map.current.addSource('terrain-source', {
          'type': 'raster-dem',
          'tiles': ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          'encoding': 'terrarium',
          'tileSize': 256,
          'maxzoom': 14
        });
        map.current.setTerrain({ 'source': 'terrain-source', 'exaggeration': 1.5 });

        // Add Global GeoJSON data for Glaciers, Salinity Zones, Deep Pools
        map.current.addSource('global-zones', {
          'type': 'geojson',
          'data': {
            'type': 'FeatureCollection',
            'features': [
              // BIAFO
              { 'type': 'Feature', 'properties': { 'type': 'glacier', 'height': 800, 'color': '#3B82F6' }, 'geometry': { 'type': 'Polygon', 'coordinates': [[[75.8, 35.7], [76.0, 35.7], [76.0, 35.6], [75.8, 35.6], [75.8, 35.7]]] } },
              { 'type': 'Feature', 'properties': { 'type': 'salinity', 'height': 50, 'color': '#EF4444' }, 'geometry': { 'type': 'Polygon', 'coordinates': [[[75.85, 35.65], [75.95, 35.65], [75.95, 35.55], [75.85, 35.55], [75.85, 35.65]]] } },
              { 'type': 'Feature', 'properties': { 'type': 'pool', 'height': 10, 'color': '#E2E8F0' }, 'geometry': { 'type': 'Polygon', 'coordinates': [[[75.9, 35.68], [75.92, 35.68], [75.92, 35.66], [75.9, 35.66], [75.9, 35.68]]] } },
              { 'type': 'Feature', 'properties': { 'type': 'melt-point', 'intensity': 'high' }, 'geometry': { 'type': 'Point', 'coordinates': [75.91, 35.67] } },
              
              // THWAITES
              { 'type': 'Feature', 'properties': { 'type': 'glacier', 'height': 400, 'color': '#3B82F6' }, 'geometry': { 'type': 'Polygon', 'coordinates': [[[-107.0, -75.0], [-106.0, -75.0], [-106.0, -76.0], [-107.0, -76.0], [-107.0, -75.0]]] } },
              { 'type': 'Feature', 'properties': { 'type': 'salinity', 'height': 20, 'color': '#EF4444' }, 'geometry': { 'type': 'Polygon', 'coordinates': [[[-106.5, -75.2], [-105.5, -75.2], [-105.5, -75.8], [-106.5, -75.8], [-106.5, -75.2]]] } },
              { 'type': 'Feature', 'properties': { 'type': 'melt-point', 'intensity': 'extreme' }, 'geometry': { 'type': 'Point', 'coordinates': [-106.75, -75.5] } },

              // ALETSCH
              { 'type': 'Feature', 'properties': { 'type': 'glacier', 'height': 1200, 'color': '#3B82F6' }, 'geometry': { 'type': 'Polygon', 'coordinates': [[[8.0, 46.5], [8.1, 46.5], [8.1, 46.4], [8.0, 46.4], [8.0, 46.5]]] } },
              { 'type': 'Feature', 'properties': { 'type': 'pool', 'height': 5, 'color': '#E2E8F0' }, 'geometry': { 'type': 'Polygon', 'coordinates': [[[8.02, 46.45], [8.04, 46.45], [8.04, 46.43], [8.02, 46.43], [8.02, 46.45]]] } },
              { 'type': 'Feature', 'properties': { 'type': 'melt-point', 'intensity': 'medium' }, 'geometry': { 'type': 'Point', 'coordinates': [8.0167, 46.4333] } }
            ]
          }
        });

        // 3D Extrusions for Zones
        map.current.addLayer({
          'id': 'zone-extrusions',
          'type': 'fill-extrusion',
          'source': 'global-zones',
          'filter': ['!=', 'type', 'melt-point'],
          'paint': {
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.6
          }
        });

        // Melt Point Markers (Pulsing Circles)
        map.current.addLayer({
          'id': 'melt-points',
          'type': 'circle',
          'source': 'global-zones',
          'filter': ['==', 'type', 'melt-point'],
          'paint': {
            'circle-radius': [
              'match', ['get', 'intensity'],
              'extreme', 12,
              'high', 8,
              'medium', 5,
              4
            ],
            'circle-color': '#F59E0B',
            'circle-opacity': 0.8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF'
          }
        });

        addLog("Global telemetry networks mapped.", "info");
      });

    } catch (err) {
      addLog(`Failed to initialize map: ${err}`, 'error');
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  const activeRegion = REGIONS[activeRegionId];

  return (
    <div className="dashboard-container">
      <header className="header" style={{ justifyContent: 'space-between' }}>
        <div className="header-title" style={{ flex: 1 }}>
          <Globe size={24} style={{ marginRight: '12px', color: 'var(--primary-accent)' }} />
          Global Environmental Command
        </div>
        
        {/* Global Region Selector */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <select 
              value={activeRegionId}
              onChange={handleRegionChange}
              style={{ 
                width: '100%', padding: '8px 12px 8px 36px', borderRadius: '24px', 
                border: '1px solid var(--border-color)', outline: 'none', 
                appearance: 'none', background: 'var(--surface-color)',
                fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)',
                boxShadow: 'var(--shadow-sm)', cursor: 'pointer'
              }}
            >
              {Object.values(REGIONS).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--bg-color)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
            <span className="status-indicator"></span>
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>REAL-TIME</span>
          </div>
          <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Download size={16} /> Export Report</button>
        </div>
      </header>

      {/* Left Panel: Metrics */}
      <aside className="panel">
        <h2 className="panel-title"><Database size={18} color="var(--primary-accent)" /> Regional Telemetry</h2>
        
        <div className="metric-card">
          <div className="metric-label">Gravimetric Mass Anomaly (GRACE)</div>
          <div className="metric-value" style={{ color: '#EF4444' }}>{activeRegion.metrics.mass}<span className="metric-unit">Gt/yr</span></div>
          <div className="metric-label">Accelerated critical mass loss</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Segmented Ice Volume</div>
          <div className="metric-value">{activeRegion.metrics.vol}<span className="metric-unit">{activeRegion.metrics.volLabel}</span></div>
          <div className="metric-label">Updated via U-Net Satellite Imagery</div>
        </div>

        <h2 className="panel-title" style={{ marginTop: '16px' }}><Waves size={18} color="var(--primary-accent)" /> Hydro-Ecological Impact</h2>

        <div className={`metric-card ${activeRegion.metrics.salStatus === 'critical' ? 'alert' : ''}`} style={activeRegion.metrics.salStatus === 'critical' ? { borderColor: '#EF4444', background: '#FEF2F2' } : {}}>
          <div className="metric-label">Basin Salinity / Toxicity Level</div>
          <div className="metric-value" style={{ color: activeRegion.metrics.salStatus === 'critical' ? '#EF4444' : 'inherit' }}>{activeRegion.metrics.sal}<span className="metric-unit">PSU</span></div>
          <div className="metric-label">Real-time downstream monitoring</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Meltwater Flow Rate</div>
          <div className="metric-value">{activeRegion.metrics.flow}<span className="metric-unit">m³/s</span></div>
          <div className="metric-label" style={{ color: '#10B981' }}>Hydrological stress indicator</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-label">Local Biome Vitality</div>
          <div className="metric-value">{activeRegion.metrics.pop}</div>
          <div className="metric-label">Habitat fragmentation risk</div>
        </div>
      </aside>

      {/* Center Panel: Map */}
      <main className="map-container">
        {!mapLoaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', zIndex: 5 }}>
            <div style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <RefreshCw size={32} className="animate-spin" style={{ animation: 'spin 2s linear infinite' }} />
              <span>Linking to Global Satellites...</span>
            </div>
          </div>
        )}

        <div ref={mapContainer} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
        
        {mapLoaded && (
          <div className="map-overlay">
            <div className="overlay-item">
              <div className="color-box" style={{ background: '#3B82F6' }}></div>
              <span>Glacier Extent (Tier 1)</span>
            </div>
            <div className="overlay-item">
              <div className="color-box" style={{ background: '#EF4444' }}></div>
              <span>High Risk Salinity Zone</span>
            </div>
            <div className="overlay-item">
              <div className="color-box" style={{ background: '#E2E8F0', border: '1px solid #94A3B8' }}></div>
              <span>Deep Pools (&gt; 3m)</span>
            </div>
            <div className="overlay-item">
              <div className="color-box" style={{ background: '#F59E0B', borderRadius: '50%' }}></div>
              <span>Active Melting Point</span>
            </div>
          </div>
        )}
      </main>

      {/* Right Panel: AI & Logs */}
      <aside className="panel">
        <h2 className="panel-title"><ShieldCheck size={18} color="var(--primary-accent)" /> Gemini DeepTech Analysis</h2>
        <div style={{
          padding: '16px',
          background: 'var(--primary-light)',
          border: '1px solid #BFDBFE',
          borderRadius: '8px',
          fontSize: '0.9rem',
          lineHeight: '1.6',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <p style={{ marginBottom: '12px', color: '#1E3A8A', fontWeight: '700' }}>Query: {activeRegion.ragQuery}</p>
          <p style={{ color: 'var(--text-primary)' }}>{activeRegion.ragAnalysis}</p>
          <div style={{ marginTop: '12px', padding: '12px', background: '#FEF2F2', borderLeft: '3px solid #EF4444', borderRadius: '4px' }}>
            <p style={{ color: '#991B1B', fontSize: '0.85rem', fontWeight: '500' }}>
              <AlertTriangle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} />
              {activeRegion.ragAlert}
            </p>
          </div>
        </div>

        <h2 className="panel-title" style={{ marginTop: 'auto' }}><Terminal size={18} color="var(--primary-accent)" /> Global Event Logs</h2>
        <div style={{
          flex: 1,
          background: '#1E293B',
          borderRadius: '8px',
          padding: '12px',
          overflowY: 'auto',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
        }}>
          {logs.map((log, i) => {
            let logColor = '#E2E8F0';
            if (log.type === 'warn') logColor = '#FBBF24';
            if (log.type === 'error') logColor = '#FCA5A5';
            return (
              <div key={i} className="log-entry" style={{ background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)', color: logColor }}>
                <span style={{ color: '#60A5FA', marginRight: '10px', fontWeight: '600' }}>[{log.time}]</span>
                {log.msg}
              </div>
            );
          })}
          {logs.length === 0 && <div style={{ color: '#94A3B8', fontSize: '0.8rem' }}>Awaiting telemetry...</div>}
        </div>
      </aside>
    </div>
  );
}
