"use client";

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Database, Terminal, AlertTriangle, ShieldCheck, RefreshCw, Download, Search, Globe, ChevronLeft, ChevronRight, Sprout, Snowflake, Cpu, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, ComposedChart, Legend } from 'recharts';
import glacierDataset from '../data.json';
import cropDataset from '../crops_data.json';

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
      id, name: d['Country Name'], coords: [d.longitude, d.latitude], zoom: 9,
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const m = searchParams.get('mode');
      if (m === 'crops' || m === 'glaciers') {
        setMode(m);
      }
    }
  }, []);

  const [logs, setLogs] = useState<Array<{ time: string, msg: string, type: 'info' | 'warn' | 'error' }>>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [activeGlacierId, setActiveGlacierId] = useState<string>(Object.keys(GLACIERS)[0] || '');
  const [activeCropId, setActiveCropId] = useState<string>(Object.keys(CROPS)[0] || '');


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
      
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8867';
      const res = await fetch(`${backendUrl}/execute`, {
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
      
      // Fallback in case style.load fails to fire
      setTimeout(() => setMapLoaded(true), 3000);

    } catch (err) { addLog(`Failed to initialize map: ${err}`, 'error'); }
    return () => { if (map.current) { map.current.remove(); map.current = null; } };
  }, []);

  const activeRegion = mode === 'glaciers' ? GLACIERS[activeGlacierId] : CROPS[activeCropId];

  return (
    <div className="dashboard-container">
      
      {/* 1. Navbar: Search Bar Only */}
      <header className="header">
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <select
            value={mode === 'glaciers' ? activeGlacierId : activeCropId}
            onChange={handleDropdownChange}
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '24px', border: '1px solid var(--border-color)', outline: 'none', appearance: 'none', background: 'rgba(255,255,255,0.05)', fontSize: '0.95rem', fontWeight: '500', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            <option value="" disabled>Search / Select Region</option>
            {Object.values(mode === 'glaciers' ? GLACIERS : CROPS).map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </header>

      {/* 2. Map Section */}
      <section className="map-section">
        {!mapLoaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', zIndex: 5 }}>
            <div style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <RefreshCw size={32} className="animate-spin" />
              <span>Linking to Global Satellites...</span>
            </div>
          </div>
        )}
        <div ref={mapContainer} className="map-container-inner" />

        {/* Floating Mode Toggle on Map */}
        <div className="mode-toggle-floating">
          <button
            onClick={() => setMode('glaciers')}
            className="mode-btn"
            style={{ background: mode === 'glaciers' ? 'var(--primary-accent)' : 'transparent', color: mode === 'glaciers' ? '#000' : 'var(--text-secondary)' }}
          >
            <Snowflake size={16} /> Glaciers
          </button>
          <button
            onClick={() => setMode('crops')}
            className="mode-btn"
            style={{ background: mode === 'crops' ? 'var(--primary-accent)' : 'transparent', color: mode === 'crops' ? '#000' : 'var(--text-secondary)' }}
          >
            <Sprout size={16} /> Agriculture
          </button>
        </div>
      </section>

      {/* 3. Prediction Section (Scrollable Below Map) */}
      <section className="prediction-section">
        <div className="prediction-grid">
          
          {/* Left Column: Inputs / Parameters */}
          <div className="prediction-column">
            {mode === 'glaciers' ? (
              <>
                <h2 className="panel-title"><Database size={20} color="var(--primary-accent)" /> Glacier Metrics</h2>
                {activeRegion && (
                  <>
                    <div className="metric-card">
                      <div className="metric-label">Annual Ice Loss</div>
                      <div className="metric-value" style={{ color: activeRegion.metrics.salStatus === 'critical' ? 'var(--alert-warning)' : 'inherit' }}>{activeRegion.metrics.mass}<span className="metric-unit">Gt</span></div>
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
                <h2 className="panel-title"><Cpu size={20} color="var(--primary-accent)" /> AI Model Parameters</h2>
                {activeRegion && (
                  <div style={{ background: 'var(--surface-color)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '24px' }}>
                      <strong>Selected Area:</strong> {activeRegion.name}<br />
                      <strong>Default Rainfall:</strong> {activeRegion.baseline.rainfall} mm
                    </div>

                    <div className="input-group">
                      <label className="input-label">Crop Item</label>
                      <select className="input-field" value={mlInputs.item} onChange={(e) => setMlInputs({ ...mlInputs, item: e.target.value })}>
                        {activeRegion.baseline.crops.split(',').map((c: string) => (
                          <option key={c.trim()} value={c.trim()}>{c.trim()}</option>
                        ))}
                        <option value="Maize">Maize</option>
                        <option value="Wheat">Wheat</option>
                        <option value="Rice">Rice</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label className="input-label">Prediction Year: {mlInputs.year}</label>
                      <input type="range" min="2020" max="2050" step="1" value={mlInputs.year} onChange={(e) => setMlInputs({ ...mlInputs, year: parseInt(e.target.value) })} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Avg Rainfall (mm/yr): {mlInputs.avg_rainfall}</label>
                      <input type="range" min="0" max="3000" step="10" value={mlInputs.avg_rainfall} onChange={(e) => setMlInputs({ ...mlInputs, avg_rainfall: parseInt(e.target.value) })} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Pesticides (Tonnes): {mlInputs.pesticides}</label>
                      <input type="range" min="0" max="100000" step="500" value={mlInputs.pesticides} onChange={(e) => setMlInputs({ ...mlInputs, pesticides: parseInt(e.target.value) })} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Avg Temperature (°C): {mlInputs.avg_temp.toFixed(1)}</label>
                      <input type="range" min="-10" max="45" step="0.5" value={mlInputs.avg_temp} onChange={(e) => setMlInputs({ ...mlInputs, avg_temp: parseFloat(e.target.value) })} />
                    </div>
                    
                    <button
                      className="btn"
                      onClick={handlePredict}
                      disabled={isPredicting}
                      style={{ marginTop: '20px' }}
                    >
                      {isPredicting ? <RefreshCw className="animate-spin" size={18} /> : <Terminal size={18} />}
                      {isPredicting ? 'Running Models...' : 'Run AI Prediction'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Column: Outputs / Analysis */}
          <div className="prediction-column">
            {mode === 'glaciers' ? (
              <>
                <h2 className="panel-title"><ShieldCheck size={20} color="var(--primary-accent)" /> Analysis</h2>
                {activeRegion && (
                  <div style={{ padding: '24px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '16px', fontSize: '0.95rem', lineHeight: '1.7' }}>
                    <p style={{ marginBottom: '16px', color: 'var(--primary-accent)', fontWeight: '700' }}>{activeRegion.ragQuery}</p>
                    <p style={{ color: 'var(--text-primary)' }}>{activeRegion.ragAnalysis}</p>
                    <div className="metric-card alert" style={{ marginTop: '24px' }}>
                      <p style={{ fontSize: '0.9rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={18} />
                        {activeRegion.ragAlert}
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="panel-title"><Activity size={20} color="var(--primary-accent)" /> AI Model Outputs</h2>
                {mlPrediction ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ padding: '20px', background: 'var(--primary-light)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary-accent)', margin: '0 0 8px 0' }}>Model Consensus</h3>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                        Predicted yield (hg/ha) based on 3 parallel ML models for {mlInputs.item} in {mlInputs.year}.
                      </p>
                    </div>
                    
                    {Object.entries(mlPrediction.models).map(([modelName, data]: any) => (
                      <div key={modelName} className={`metric-card`} style={{ borderLeftColor: data.category === 'High' ? 'var(--primary-accent)' : data.category === 'Low' ? 'var(--alert-warning)' : '#F59E0B' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div className="metric-label">{modelName}</div>
                          <div style={{ 
                            fontSize: '0.8rem', 
                            padding: '4px 12px', 
                            borderRadius: '16px', 
                            fontWeight: 'bold',
                            background: data.category === 'High' ? 'var(--primary-light)' : data.category === 'Low' ? 'var(--alert-light)' : 'rgba(245, 158, 11, 0.1)',
                            color: data.category === 'High' ? 'var(--primary-accent)' : data.category === 'Low' ? 'var(--alert-warning)' : '#FBBF24'
                          }}>
                            {data.category} Yield
                          </div>
                        </div>
                        <div className="metric-value">{data.yield.toLocaleString()}<span className="metric-unit"> hg/ha</span></div>
                      </div>
                    ))}
                    
                    <div style={{ height: '300px', width: '100%', marginTop: '16px', background: 'var(--surface-color)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={Object.entries(mlPrediction.models).map(([name, val]: any) => ({ name, yield: val.yield }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="name" tick={{fill: 'var(--text-secondary)', fontSize: 12}} />
                          <YAxis tick={{fill: 'var(--text-secondary)', fontSize: 12}} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px' }} 
                            itemStyle={{ color: 'var(--primary-accent)' }}
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          />
                          <Bar dataKey="yield" fill="var(--primary-accent)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Historical Data Section */}
                    {mlPrediction.historical_stats && mlPrediction.historical_stats.yearly_data && (
                      <div style={{ marginTop: '24px', padding: '24px', background: 'var(--surface-color)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '24px' }}>Historical Impact Analysis</h3>
                        <div style={{ height: '300px', width: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={mlPrediction.historical_stats.yearly_data}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis dataKey="year" tick={{fill: 'var(--text-secondary)', fontSize: 12}} />
                              <YAxis yAxisId="left" tick={{fill: 'var(--primary-accent)', fontSize: 12}} width={45} />
                              <YAxis yAxisId="right" orientation="right" tick={{fill: 'var(--alert-warning)', fontSize: 12}} width={45} />
                              <Tooltip contentStyle={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px' }} />
                              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                              <Area yAxisId="left" type="monotone" dataKey="yield" name="Yield (hg/ha)" fill="var(--primary-light)" stroke="var(--primary-accent)" strokeWidth={2} />
                              <Line yAxisId="right" type="monotone" dataKey="pesticides" name="Pesticides (t)" stroke="var(--alert-warning)" strokeWidth={2} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--surface-color)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
                    Select a country and run the AI prediction to view detailed outputs and analysis.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}
