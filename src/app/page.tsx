"use client";

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Database, Terminal, AlertTriangle, ShieldCheck, RefreshCw, Download, Search, Globe, ChevronLeft, ChevronRight, Sprout, Snowflake, Cpu, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, ComposedChart, Legend } from 'recharts';
import glacierDataset from './data.json';
import cropDataset from './crops_data.json';

// --- DATA PROCESSING ---
const GLACIERS: Record<string, any> = {};
glacierDataset.forEach((d: any, index: number) => {
  if (typeof d.latitude === 'number' && typeof d.longitude === 'number' && (d.latitude !== 0 || d.longitude !== 0)) {
    const id = d['Country Code'] || `glacier_${index}`;
    let salStatus = 'safe';
    const statusStr = d['Glacier Melting Status'] || '';
    if (statusStr.toLowerCase().includes('severe') || statusStr.toLowerCase().includes('rapidly')) salStatus = 'critical';
    else if (statusStr.toLowerCase().includes('accelerating') || statusStr.toLowerCase().includes('declining')) salStatus = 'warning';

    GLACIERS[id] = {
      id, name: d['Country Name'], coords: [d.longitude, d.latitude], zoom: 5,
      metrics: {
        mass: (d['Annual Ice Loss Tons'] ? (d['Annual Ice Loss Tons'] / 1e9).toFixed(2) : "N/A"),
        vol: d['Total Glacier Area km2'] || "N/A", volLabel: "km²",
        sal: d['Average Temperature Increase C'] || "N/A", salLabel: "°C",
        salStatus: salStatus, flow: d['Flood Risk Level'] || "N/A", pop: d['Water Shortage Risk'] || "N/A"
      },
      ragQuery: `Assess climate impact for ${d['Country Name']}?`,
      ragAnalysis: `Major glaciers: ${d['Major Glaciers'] || 'N/A'}. Climate Risk Index: ${d['Climate Risk Index'] || 'N/A'}.`,
      ragAlert: `Projected 2050 glacier area: ${d['Prediction 2050 km2'] || 'N/A'} km². Global Warming Risk Index: ${d['Global Warming Risk Index'] || 'N/A'}`
    };
  }
});

const CROPS: Record<string, any> = {};
cropDataset.forEach((d: any, index: number) => {
  if (typeof d.latitude === 'number' && typeof d.longitude === 'number' && (d.latitude !== 0 || d.longitude !== 0)) {
    const id = d['Country Code'] || `crop_${index}`;
    CROPS[id] = {
      id, name: d['Country Name'], coords: [d.longitude, d.latitude], zoom: 5,
      baseline: {
        rainfall: d['Rainfall Level mm'] || 500,
        droughtRisk: d['Drought Risk'] || 'Moderate',
        heatwaveRisk: d['Heatwave Risk'] || 'Moderate',
        production: d['Annual Crop Production Tons'] || 0,
        crops: d['Major Crops'] || 'N/A',
        affectedCrops: d['Crop Affected By Global Warming'] || 'N/A',
        baseYieldLoss: parseFloat(d['Crop Yield Loss Percentage']) || 0,
        baseImpact: parseFloat(d['Agricultural Economic Impact USD Billion']) || 0,
      }
    };
  }
});

export default function Dashboard() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  const [mode, setMode] = useState<'glaciers' | 'crops'>('glaciers');
  const modeRef = useRef(mode);

  const [logs, setLogs] = useState<Array<{ time: string, msg: string, type: 'info' | 'warn' | 'error' }>>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [activeGlacierId, setActiveGlacierId] = useState<string>(Object.keys(GLACIERS)[0] || '');
  const [activeCropId, setActiveCropId] = useState<string>(Object.keys(CROPS)[0] || '');

  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

  // ML Form State
  const [mlInputs, setMlInputs] = useState({ item: 'Wheat', year: 2026, avg_rainfall: 500, pesticides: 1000, avg_temp: 22.5 });
  const [mlPrediction, setMlPrediction] = useState<any>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  // Keep refs for map callbacks
  const handleMapClickRef = useRef<((id: string) => void) | null>(null);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  const addLog = (msg: string, type: 'info' | 'warn' | 'error' = 'info') => {
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 15));
  };

  const selectRegion = (id: string, triggerMode?: 'glaciers' | 'crops') => {
    const currentMode = triggerMode || mode;
    let region;
    if (currentMode === 'glaciers') {
      setActiveGlacierId(id);
      region = GLACIERS[id];
    } else {
      setActiveCropId(id);
      region = CROPS[id];
      if (region) {
        setMlInputs({
          item: region.baseline.crops ? region.baseline.crops.split(',')[0].trim() : 'Wheat',
          year: 2026,
          avg_rainfall: region.baseline.rainfall || 500,
          pesticides: 1000,
          avg_temp: 22.5
        });
        setMlPrediction(null);
      }
    }

    if (!region) return;
    addLog(`Focus shifted to ${region.name}.`, 'info');

    if (map.current) {
      map.current.flyTo({ center: region.coords as [number, number], zoom: region.zoom, pitch: 45, duration: 2500 });
    }
  };

  useEffect(() => {
    handleMapClickRef.current = (id: string) => {
      selectRegion(id, modeRef.current);
    };
  }, []);

  const handleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    selectRegion(e.target.value);
  };

  const handlePredict = async () => {
    const activeId = activeCropId || Object.keys(CROPS)[0];
    const region = CROPS[activeId];
    if (mode !== 'crops' || !region) return;
    
    setIsPredicting(true);
    addLog(`Running full AI Yield Prediction for ${region.name}...`, 'info');
    
    try {
      const payload = {
        Area: region.name,
        Item: mlInputs.item,
        Year: mlInputs.year,
        average_rain_fall_mm_per_year: mlInputs.avg_rainfall,
        pesticides_tonnes: mlInputs.pesticides,
        avg_temp: mlInputs.avg_temp
      };
      
      const res = await fetch('http://localhost:8867/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.prediction) {
        setMlPrediction(data.prediction);
        addLog(`AI Models predicted crop yield successfully.`, 'info');
      } else {
        addLog(`Prediction failed: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err: any) {
      addLog(`Failed to connect to AI Engine: ${err.message}`, 'error');
    } finally {
      setIsPredicting(false);
    }
  };

  // Switch between Glaciers and Crops map layer
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    const source: any = map.current.getSource('global-zones');
    if (!source) return;

    const dataObj = mode === 'glaciers' ? GLACIERS : CROPS;
    const features = Object.values(dataObj).map((r: any) => ({
      'type': 'Feature',
      'properties': {
        'id': r.id,
        'name': r.name,
        'type': mode === 'glaciers' ? 'glacier-point' : 'crop-point',
        'intensity': mode === 'glaciers'
          ? (r.metrics.salStatus === 'critical' ? 'extreme' : r.metrics.salStatus === 'warning' ? 'high' : 'medium')
          : (r.baseline.baseYieldLoss > 30 ? 'extreme' : r.baseline.baseYieldLoss > 15 ? 'high' : 'medium')
      },
      'geometry': { 'type': 'Point', 'coordinates': r.coords }
    }));

    source.setData({ 'type': 'FeatureCollection', 'features': features });
    addLog(`Switched view to ${mode.toUpperCase()} dataset. Rendering ${features.length} points.`, 'info');
  }, [mode, mapLoaded]);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'satellite': { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19 },
            'labels': { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19 }
          },
          layers: [{ id: 'satellite-layer', type: 'raster', source: 'satellite' }, { id: 'labels-layer', type: 'raster', source: 'labels' }]
        },
        center: [0, 20] as [number, number], zoom: 2, pitch: 0
      });

      map.current.on('style.load', () => {
        if (!map.current) return;

        map.current.addSource('terrain-source', { 'type': 'raster-dem', 'tiles': ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], 'encoding': 'terrarium', 'tileSize': 256, 'maxzoom': 14 });
        map.current.setTerrain({ 'source': 'terrain-source', 'exaggeration': 1.5 });

        map.current.addSource('global-zones', { 'type': 'geojson', 'data': { 'type': 'FeatureCollection', 'features': [] } });

        map.current.addLayer({
          'id': 'points-layer', 'type': 'circle', 'source': 'global-zones',
          'paint': {
            'circle-radius': ['match', ['get', 'intensity'], 'extreme', 12, 'high', 9, 'medium', 6, 6],
            'circle-color': ['match', ['get', 'intensity'], 'extreme', '#EF4444', 'high', '#F59E0B', 'medium', '#3B82F6', '#3B82F6'],
            'circle-opacity': 0.85, 'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF'
          }
        });

        map.current.addLayer({
          'id': 'labels-layer-text', 'type': 'symbol', 'source': 'global-zones',
          'layout': { 'text-field': ['get', 'name'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 13, 'text-offset': [0, 1.5], 'text-anchor': 'top' },
          'paint': { 'text-color': '#FFFFFF', 'text-halo-color': '#000000', 'text-halo-width': 2 }
        });

        // Add Interactivity for both the circle and the text label
        const onFeatureClick = (e: any) => {
          if (!e.features || e.features.length === 0) return;
          const clickedId = e.features[0].properties.id;
          if (handleMapClickRef.current) handleMapClickRef.current(clickedId);
        };

        map.current.on('click', 'points-layer', onFeatureClick);
        map.current.on('click', 'labels-layer-text', onFeatureClick);

        map.current.on('mouseenter', 'points-layer', () => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'points-layer', () => {
          if (map.current) map.current.getCanvas().style.cursor = '';
        });

        map.current.on('mouseenter', 'labels-layer-text', () => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'labels-layer-text', () => {
          if (map.current) map.current.getCanvas().style.cursor = '';
        });

        // Crucial: Set mapLoaded true AFTER sources and layers are fully registered
        setMapLoaded(true);
      });
    } catch (err) { addLog(`Failed to initialize map: ${err}`, 'error'); }
    return () => { if (map.current) { map.current.remove(); map.current = null; } };
  }, []);

  const activeRegion = mode === 'glaciers' ? GLACIERS[activeGlacierId] : CROPS[activeCropId];

  return (
    <div className="dashboard-container">
      <main className="map-container">
        {!mapLoaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', zIndex: 5 }}>
            <div style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <RefreshCw size={32} className="animate-spin" />
              <span>Linking to Global Satellites...</span>
            </div>
          </div>
        )}
        <div ref={mapContainer} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
      </main>

      <header className="header">
        <div className="header-title" style={{ flex: 1, gap: '10px' }}>
          <Globe size={24} style={{ color: 'var(--primary-accent)' }} />
          Global Climate Data Hub
        </div>
        {/* example */}
        {/* Dataset Toggle */}
        <div style={{ display: 'flex', background: 'var(--bg-color)', borderRadius: '20px', padding: '4px', border: '1px solid var(--border-color)', marginRight: '20px' }}>
          <button
            onClick={() => setMode('glaciers')}
            style={{ padding: '6px 16px', borderRadius: '16px', border: 'none', background: mode === 'glaciers' ? 'var(--primary-accent)' : 'transparent', color: mode === 'glaciers' ? '#FFF' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Snowflake size={16} /> Glaciers
          </button>
          <button
            onClick={() => setMode('crops')}
            style={{ padding: '6px 16px', borderRadius: '16px', border: 'none', background: mode === 'crops' ? '#10B981' : 'transparent', color: mode === 'crops' ? '#FFF' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Sprout size={16} /> Agriculture
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '250px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <select
              value={mode === 'glaciers' ? activeGlacierId : activeCropId}
              onChange={handleDropdownChange}
              style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '24px', border: '1px solid var(--border-color)', outline: 'none', appearance: 'none', background: 'var(--surface-color)', fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}
            >
              <option value="" disabled>Select a Region</option>
              {Object.values(mode === 'glaciers' ? GLACIERS : CROPS).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <button className={`sidebar-toggle left ${!leftSidebarOpen ? 'collapsed' : ''}`} onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}>
        {leftSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      <button className={`sidebar-toggle right ${!rightSidebarOpen ? 'collapsed' : ''}`} onClick={() => setRightSidebarOpen(!rightSidebarOpen)}>
        {rightSidebarOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      {/* LEFT PANEL */}
      <aside className={`panel panel-left ${!leftSidebarOpen ? 'collapsed' : ''}`}>
        {mode === 'glaciers' ? (
          <>
            <h2 className="panel-title"><Database size={18} color="var(--primary-accent)" /> Glacier Metrics</h2>
            {activeRegion && (
              <>
                <div className="metric-card">
                  <div className="metric-label">Annual Ice Loss</div>
                  <div className="metric-value" style={{ color: activeRegion.metrics.salStatus === 'critical' ? '#EF4444' : 'inherit' }}>{activeRegion.metrics.mass}<span className="metric-unit">Gt</span></div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Total Glacier Area</div>
                  <div className="metric-value">{activeRegion.metrics.vol}<span className="metric-unit">{activeRegion.metrics.volLabel}</span></div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Avg. Temp Increase</div>
                  <div className="metric-value">{activeRegion.metrics.sal}<span className="metric-unit">{activeRegion.metrics.salLabel}</span></div>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <h2 className="panel-title"><Cpu size={18} color="#10B981" /> AI Model Parameters</h2>
            {activeRegion && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <strong>Selected Area:</strong> {activeRegion.name}<br />
                  <strong>Default Rainfall:</strong> {activeRegion.baseline.rainfall} mm
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Crop Item</label>
                  <select value={mlInputs.item} onChange={(e) => setMlInputs({ ...mlInputs, item: e.target.value })} style={{ width: '100%', padding: '6px', borderRadius: '4px', background: 'var(--surface-color)', color: 'var(--text-primary)' }}>
                    {activeRegion.baseline.crops.split(',').map((c: string) => (
                      <option key={c.trim()} value={c.trim()}>{c.trim()}</option>
                    ))}
                    <option value="Maize">Maize</option>
                    <option value="Wheat">Wheat</option>
                    <option value="Rice">Rice</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Prediction Year: {mlInputs.year}</label>
                  <input type="range" min="2020" max="2050" step="1" value={mlInputs.year} onChange={(e) => setMlInputs({ ...mlInputs, year: parseInt(e.target.value) })} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Avg Rainfall (mm/yr): {mlInputs.avg_rainfall}</label>
                  <input type="range" min="0" max="3000" step="10" value={mlInputs.avg_rainfall} onChange={(e) => setMlInputs({ ...mlInputs, avg_rainfall: parseInt(e.target.value) })} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Pesticides (Tonnes): {mlInputs.pesticides}</label>
                  <input type="range" min="0" max="100000" step="500" value={mlInputs.pesticides} onChange={(e) => setMlInputs({ ...mlInputs, pesticides: parseInt(e.target.value) })} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Avg Temperature (°C): {mlInputs.avg_temp.toFixed(1)}</label>
                  <input type="range" min="-10" max="45" step="0.5" value={mlInputs.avg_temp} onChange={(e) => setMlInputs({ ...mlInputs, avg_temp: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                </div>
                
                <button
                  onClick={handlePredict}
                  disabled={isPredicting}
                  style={{ marginTop: '10px', padding: '10px', background: isPredicting ? '#374151' : '#10B981', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: isPredicting ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                >
                  {isPredicting ? <RefreshCw className="animate-spin" size={16} /> : <Terminal size={16} />}
                  {isPredicting ? 'Running Models...' : 'Run AI Prediction'}
                </button>
              </div>
            )}
          </>
        )}
      </aside>

      {/* RIGHT PANEL */}
      <aside className={`panel panel-right ${!rightSidebarOpen ? 'collapsed' : ''}`}>
        {mode === 'glaciers' ? (
          <>
            <h2 className="panel-title"><ShieldCheck size={18} color="var(--primary-accent)" /> DeepTech Analysis</h2>
            {activeRegion && (
              <div style={{ padding: '16px', background: 'var(--primary-light)', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '0.9rem', lineHeight: '1.6' }}>
                <p style={{ marginBottom: '12px', color: '#1E3A8A', fontWeight: '700' }}>{activeRegion.ragQuery}</p>
                <p style={{ color: 'var(--text-primary)' }}>{activeRegion.ragAnalysis}</p>
                <div style={{ marginTop: '12px', padding: '12px', background: '#FEF2F2', borderLeft: '3px solid #EF4444', borderRadius: '4px' }}>
                  <p style={{ color: '#991B1B', fontSize: '0.85rem', fontWeight: '500' }}>
                    <AlertTriangle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} />
                    {activeRegion.ragAlert}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="panel-title"><Terminal size={18} color="#10B981" /> AI Model Outputs</h2>
            {mlPrediction ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                <div style={{ padding: '10px', background: 'var(--primary-light)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#10B981', margin: 0 }}>Model Consensus</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                    Predicted yield (hg/ha) based on 3 parallel ML models for {mlInputs.item} in {mlInputs.year}.
                  </p>
                </div>
                
                {Object.entries(mlPrediction.models).map(([modelName, data]: any) => (
                  <div key={modelName} className={`metric-card`} style={{ padding: '10px 14px', borderLeftColor: data.category === 'High' ? '#10B981' : data.category === 'Low' ? '#EF4444' : '#F59E0B' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="metric-label">{modelName}</div>
                      <div style={{ 
                        fontSize: '0.75rem', 
                        padding: '2px 8px', 
                        borderRadius: '12px', 
                        fontWeight: 'bold',
                        background: data.category === 'High' ? 'rgba(16, 185, 129, 0.2)' : data.category === 'Low' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: data.category === 'High' ? '#34D399' : data.category === 'Low' ? '#F87171' : '#FBBF24'
                      }}>
                        {data.category} Yield
                      </div>
                    </div>
                    <div className="metric-value">{data.yield.toLocaleString()}<span className="metric-unit"> hg/ha</span></div>
                  </div>
                ))}
                
                <div style={{ height: '220px', width: '100%', marginTop: '10px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(mlPrediction.models).map(([name, val]: any) => ({ name, yield: val.yield }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="name" tick={{fill: 'var(--text-secondary)', fontSize: 12}} />
                      <YAxis tick={{fill: 'var(--text-secondary)', fontSize: 12}} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} 
                        itemStyle={{ color: '#10B981' }}
                      />
                      <Bar dataKey="yield" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Risk/Opportunity Matrix */}
                {mlPrediction.risk_matrix && (
                  <div style={{ marginTop: '14px', padding: '14px', borderRadius: '8px', border: `1px solid ${mlPrediction.risk_matrix.status === 'Opportunity' ? '#10B981' : '#EF4444'}`, background: mlPrediction.risk_matrix.status === 'Opportunity' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      {mlPrediction.risk_matrix.status === 'Opportunity' ? <Activity size={18} color="#10B981" /> : <AlertTriangle size={18} color="#EF4444" />}
                      <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: mlPrediction.risk_matrix.status === 'Opportunity' ? '#10B981' : '#EF4444', margin: 0 }}>
                        {mlPrediction.risk_matrix.action}
                      </h3>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0 0 8px 0', lineHeight: '1.4' }}>
                      {mlPrediction.risk_matrix.message}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                      <span>Baseline: {mlPrediction.risk_matrix.baseline.toLocaleString()} hg/ha</span>
                      <span style={{ fontWeight: 'bold', color: mlPrediction.risk_matrix.status === 'Opportunity' ? '#10B981' : '#EF4444' }}>
                        {mlPrediction.risk_matrix.impact_usd > 0 ? '+' : ''}${mlPrediction.risk_matrix.impact_usd.toFixed(2)}/ha
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Historical Data & Impacts */}
                {mlPrediction.historical_stats && mlPrediction.historical_stats.yearly_data && mlPrediction.historical_stats.yearly_data.length > 0 && (
                  <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '20px' }}>
                    <div style={{ padding: '10px', background: 'var(--primary-light)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#10B981', margin: 0 }}>Historical Impact Analysis</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                        Total Unique Crops Grown in {mlInputs.item} Region: <strong style={{ color: '#10B981' }}>{mlPrediction.historical_stats.total_crops}</strong>
                      </p>
                    </div>

                    {/* Yield vs Pesticides over Time */}
                    <div style={{ padding: '10px', background: 'var(--surface-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>Area vs Pesticides & Yield Impact</h4>
                      <div style={{ height: '180px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={mlPrediction.historical_stats.yearly_data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="year" tick={{fill: 'var(--text-secondary)', fontSize: 10}} />
                            <YAxis yAxisId="left" tick={{fill: '#10B981', fontSize: 10}} width={40} />
                            <YAxis yAxisId="right" orientation="right" tick={{fill: '#EF4444', fontSize: 10}} width={40} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                            <Area yAxisId="left" type="monotone" dataKey="yield" name="Yield (hg/ha)" fill="#10B981" stroke="#10B981" fillOpacity={0.2} />
                            <Line yAxisId="right" type="monotone" dataKey="pesticides" name="Pesticides (t)" stroke="#EF4444" strokeWidth={2} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Area Average Pesticides */}
                    <div style={{ padding: '10px', background: 'var(--surface-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>Area & Average Pesticides Usage</h4>
                      <div style={{ height: '150px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={mlPrediction.historical_stats.yearly_data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="year" tick={{fill: 'var(--text-secondary)', fontSize: 10}} />
                            <YAxis tick={{fill: '#F59E0B', fontSize: 10}} width={40} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                            <Bar dataKey="pesticides" name="Avg Pesticides (Tonnes)" fill="#F59E0B" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Rainfall Histogram */}
                    <div style={{ padding: '10px', background: 'var(--surface-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>Histogram of Average Rainfall</h4>
                      <div style={{ height: '150px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={mlPrediction.historical_stats.yearly_data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="year" tick={{fill: 'var(--text-secondary)', fontSize: 10}} />
                            <YAxis tick={{fill: '#3B82F6', fontSize: 10}} width={40} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                            <Bar dataKey="rainfall" name="Avg Rainfall (mm)" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Select a country and run the AI prediction to view crop yield forecasts.
              </div>
            )}
          </>
        )}


      </aside>
    </div>
  );
}
