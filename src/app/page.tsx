"use client";

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Activity, Droplet, Waves, Fish, Map as MapIcon, Database, Terminal, AlertTriangle, ShieldCheck, RefreshCw, Download, MapPin, Search, Globe, Wind, ChevronLeft, ChevronRight } from 'lucide-react';
import dataset from './data.json';

// Process dataset into REGIONS format
const REGIONS: Record<string, any> = {};
dataset.forEach((d: any, index: number) => {
  if (d.latitude !== 0 || d.longitude !== 0) {
    const id = d['Country Code'] || `region_${index}`;
    const statusStr = d['Glacier Melting Status'] || '';
    let salStatus = 'safe';
    if (statusStr.toLowerCase().includes('severe') || statusStr.toLowerCase().includes('rapidly')) salStatus = 'critical';
    else if (statusStr.toLowerCase().includes('accelerating') || statusStr.toLowerCase().includes('declining')) salStatus = 'warning';

    REGIONS[id] = {
      id,
      name: d['Country Name'],
      coords: [d.longitude, d.latitude],
      zoom: 5,
      metrics: {
        mass: (d['Annual Ice Loss Tons'] ? (d['Annual Ice Loss Tons'] / 1e9).toFixed(2) : "N/A"), // in Gt
        vol: d['Total Glacier Area km2'] || "N/A",
        volLabel: "km²",
        sal: d['Average Temperature Increase C'] || "N/A",
        salLabel: "°C",
        salStatus: salStatus,
        flow: d['Flood Risk Level'] || "N/A",
        pop: d['Water Shortage Risk'] || "N/A"
      },
      ragQuery: `Assess climate impact for ${d['Country Name']}?`,
      ragAnalysis: `Major glaciers: ${d['Major Glaciers'] || 'N/A'}. Climate Risk Index: ${d['Climate Risk Index'] || 'N/A'}.`,
      ragAlert: `Projected 2050 glacier area: ${d['Prediction 2050 km2'] || 'N/A'} km². Global Warming Risk Index: ${d['Global Warming Risk Index'] || 'N/A'}`
    };
  }
});

export default function Dashboard() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [logs, setLogs] = useState<Array<{time: string, msg: string, type: 'info'|'warn'|'error'}>>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const defaultRegionId = Object.keys(REGIONS)[0] || '';
  const [activeRegionId, setActiveRegionId] = useState<string>(defaultRegionId);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

  const addLog = (msg: string, type: 'info'|'warn'|'error' = 'info') => {
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 15));
  };

  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const regionId = e.target.value;
    setActiveRegionId(regionId);
    const region = REGIONS[regionId];
    if (!region) return;
    
    addLog(`Focus shifted to ${region.name}. Fetching regional climate data...`, 'info');
    
    if (map.current) {
      map.current.flyTo({
        center: region.coords as [number, number],
        zoom: region.zoom,
        pitch: 45,
        bearing: 0,
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
            },
            'labels': {
              type: 'raster',
              tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
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
            },
            {
              id: 'labels-layer',
              type: 'raster',
              source: 'labels',
              paint: {}
            }
          ]
        },
        center: [0, 20] as [number, number],
        zoom: 2,
        pitch: 0,
        bearing: 0,
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

        const features = Object.values(REGIONS).map((r: any) => ({
          'type': 'Feature',
          'properties': { 
              'name': r.name,
              'type': 'glacier-point', 
              'intensity': r.metrics.salStatus === 'critical' ? 'extreme' : r.metrics.salStatus === 'warning' ? 'high' : 'medium' 
          },
          'geometry': { 'type': 'Point', 'coordinates': r.coords }
        }));

        map.current.addSource('global-zones', {
          'type': 'geojson',
          'data': {
            'type': 'FeatureCollection',
            'features': features as any[]
          }
        });

        // Add Markers
        map.current.addLayer({
          'id': 'glacier-points',
          'type': 'circle',
          'source': 'global-zones',
          'filter': ['==', 'type', 'glacier-point'],
          'paint': {
            'circle-radius': [
              'match', ['get', 'intensity'],
              'extreme', 10,
              'high', 7,
              'medium', 4,
              4
            ],
            'circle-color': [
              'match', ['get', 'intensity'],
              'extreme', '#EF4444',
              'high', '#F59E0B',
              'medium', '#3B82F6',
              '#3B82F6'
            ],
            'circle-opacity': 0.8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF'
          }
        });

        // Add Names on Map
        map.current.addLayer({
          'id': 'glacier-labels',
          'type': 'symbol',
          'source': 'global-zones',
          'layout': {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'text-offset': [0, 1.5],
            'text-anchor': 'top'
          },
          'paint': {
            'text-color': '#FFFFFF',
            'text-halo-color': '#000000',
            'text-halo-width': 2
          }
        });

        addLog("Global telemetry networks and country labels mapped.", "info");
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

  const activeRegion = REGIONS[activeRegionId] || {
    name: 'Loading...', metrics: { mass: '', vol: '', sal: '', flow: '', pop: '' },
    ragQuery: '', ragAnalysis: '', ragAlert: ''
  };

  return (
    <div className="dashboard-container">
      {/* Map takes full screen */}
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
              <span>Stable Extent</span>
            </div>
            <div className="overlay-item">
              <div className="color-box" style={{ background: '#F59E0B' }}></div>
              <span>Declining/Warning</span>
            </div>
            <div className="overlay-item">
              <div className="color-box" style={{ background: '#EF4444' }}></div>
              <span>Severe Risk</span>
            </div>
          </div>
        )}
      </main>

      {/* Floating Header */}
      <header className="header">
        <div className="header-title" style={{ flex: 1 }}>
          <Globe size={24} style={{ marginRight: '12px', color: 'var(--primary-accent)' }} />
          Global Climate Data Hub
        </div>
        
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '350px' }}>
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
              <option value="" disabled>Select a Region</option>
              {Object.values(REGIONS).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--bg-color)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
            <span className="status-indicator"></span>
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>LIVE</span>
          </div>
          <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Download size={16} /> Export</button>
        </div>
      </header>

      {/* Left Sidebar Toggle */}
      <button 
        className={`sidebar-toggle left ${!leftSidebarOpen ? 'collapsed' : ''}`} 
        onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
      >
        {leftSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      {/* Right Sidebar Toggle */}
      <button 
        className={`sidebar-toggle right ${!rightSidebarOpen ? 'collapsed' : ''}`} 
        onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
      >
        {rightSidebarOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      {/* Left Panel: Metrics */}
      <aside className={`panel panel-left ${!leftSidebarOpen ? 'collapsed' : ''}`}>
        <h2 className="panel-title"><Database size={18} color="var(--primary-accent)" /> Dataset Metrics</h2>
        
        <div className="metric-card">
          <div className="metric-label">Annual Ice Loss</div>
          <div className="metric-value" style={{ color: activeRegion.metrics.salStatus === 'critical' ? '#EF4444' : 'inherit' }}>
            {activeRegion.metrics.mass}<span className="metric-unit">Gt</span>
          </div>
          <div className="metric-label">Gravimetric Mass Anomaly</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Total Glacier Area</div>
          <div className="metric-value">{activeRegion.metrics.vol}<span className="metric-unit">{activeRegion.metrics.volLabel}</span></div>
          <div className="metric-label">Current surface extent</div>
        </div>

        <h2 className="panel-title" style={{ marginTop: '8px' }}><Waves size={18} color="var(--primary-accent)" /> Impact & Risks</h2>

        <div className={`metric-card ${activeRegion.metrics.salStatus === 'critical' ? 'alert' : ''}`}>
          <div className="metric-label">Avg. Temp Increase</div>
          <div className="metric-value" style={{ color: activeRegion.metrics.salStatus === 'critical' ? '#EF4444' : 'inherit' }}>
            {activeRegion.metrics.sal}<span className="metric-unit">{activeRegion.metrics.salLabel}</span>
          </div>
          <div className="metric-label">Relative to baseline</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Flood Risk Level</div>
          <div className="metric-value" style={{ fontSize: '1.5rem', marginTop: '10px' }}>{activeRegion.metrics.flow}</div>
          <div className="metric-label" style={{ color: '#10B981', marginTop: '4px' }}>Regional assessment</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-label">Water Shortage Risk</div>
          <div className="metric-value" style={{ fontSize: '1.5rem', marginTop: '10px' }}>{activeRegion.metrics.pop}</div>
          <div className="metric-label">Drought susceptibility</div>
        </div>
      </aside>

      {/* Right Panel: AI & Logs */}
      <aside className={`panel panel-right ${!rightSidebarOpen ? 'collapsed' : ''}`}>
        <h2 className="panel-title"><ShieldCheck size={18} color="var(--primary-accent)" /> DeepTech Analysis</h2>
        <div style={{
          padding: '16px',
          background: 'var(--primary-light)',
          border: '1px solid #BFDBFE',
          borderRadius: '8px',
          fontSize: '0.9rem',
          lineHeight: '1.6',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <p style={{ marginBottom: '12px', color: '#1E3A8A', fontWeight: '700' }}>{activeRegion.ragQuery}</p>
          <p style={{ color: 'var(--text-primary)' }}>{activeRegion.ragAnalysis}</p>
          <div style={{ marginTop: '12px', padding: '12px', background: '#FEF2F2', borderLeft: '3px solid #EF4444', borderRadius: '4px' }}>
            <p style={{ color: '#991B1B', fontSize: '0.85rem', fontWeight: '500' }}>
              <AlertTriangle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} />
              {activeRegion.ragAlert}
            </p>
          </div>
        </div>

        <h2 className="panel-title" style={{ marginTop: 'auto' }}><Terminal size={18} color="var(--primary-accent)" /> Event Logs</h2>
        <div style={{
          flex: 1,
          background: '#1E293B',
          borderRadius: '8px',
          padding: '12px',
          overflowY: 'auto',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
          minHeight: '200px'
        }}>
          {logs.map((log, i) => {
            let logColor = '#E2E8F0';
            if (log.type === 'warn') logColor = '#FBBF24';
            if (log.type === 'error') logColor = '#FCA5A5';
            return (
              <div key={i} className="log-entry" style={{ color: logColor }}>
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
