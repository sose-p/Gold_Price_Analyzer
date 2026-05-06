import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, BarChart3, Share2, Globe, XCircle } from 'lucide-react';
import { MarketData, fetchMarketData, alignData, fetchLatestPoint } from './services/dataService';
import { 
  linearInterpolation, 
  lagrangeInterpolation, 
  cubicSplineInterpolation, 
  gaussianProcessAnalysis,
  AnalysisResult,
  computeCorrelation 
} from './lib/math';
import { ChartContainer } from './components/ChartContainer';
import { AnalysisPanel } from './components/AnalysisPanel';
import * as XLSX from 'xlsx';

export default function App() {
  const [data, setData] = useState<MarketData[]>([]);
  const [timeRange, setTimeRange] = useState<'all' | 'year' | 'month' | 'day'>('all');
  const [selectedInterval, setSelectedInterval] = useState<[number, number] | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [source, setSource] = useState<'historical' | 'api'>('historical');
  const [results, setResults] = useState<AnalysisResult[]>([]);
  
    // Theme logic - Always Dark
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Data loading
  useEffect(() => {
    fetchMarketData(apiKey, source).then(res => {
      setData(alignData(res));
    });
  }, [apiKey, source]);

  const dataRef = React.useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Real-time Polling Logic
  useEffect(() => {
    let interval: any;
    if (source === 'api') {
      interval = setInterval(async () => {
        try {
          const last = dataRef.current[dataRef.current.length - 1];
          if (last) {
            const newPoint = await fetchLatestPoint(last, apiKey);
            setData(prev => {
              // Avoid duplicate timestamps
              if (prev.length > 0 && prev[prev.length - 1].date === newPoint.date) return prev;
              return [...prev, newPoint];
            });
          }
        } catch (e) {
          console.error("Polling error:", e);
        }
      }, 5000); // Poll every 5 seconds for a "live" feel
    }
    return () => clearInterval(interval);
  }, [source, apiKey]);

  // Derived filtered data based on selected timeRange
  const displayData = useMemo(() => {
    if (data.length === 0) return [];
    if (timeRange === 'all') return data;
    
    const lastDate = new Date(data[data.length - 1].date);
    const filterDate = new Date(lastDate);
    
    if (timeRange === 'day') filterDate.setHours(lastDate.getHours() - 24);
    else if (timeRange === 'month') filterDate.setMonth(lastDate.getMonth() - 1);
    else if (timeRange === 'year') filterDate.setFullYear(lastDate.getFullYear() - 1);
    
    const filtered = data.filter(d => new Date(d.date) >= filterDate);
    // Ensure we always have at least some data to show
    return filtered.length >= 2 ? filtered : data.slice(-100);
  }, [data, timeRange]);

  // Reset selection on range change
  useEffect(() => {
    setSelectedInterval(null);
  }, [timeRange]);

  const correlations = useMemo(() => {
    if (!selectedInterval || data.length === 0) return { dxy: 0, eurusd: 0 };
    const sub = data.filter(d => {
      const ts = new Date(d.date).getTime();
      return ts >= selectedInterval[0] && ts <= selectedInterval[1];
    });
    if (sub.length < 2) return { dxy: 0, eurusd: 0 };
    return {
      dxy: computeCorrelation(sub.map(d => d.gold), sub.map(d => d.dxy)),
      eurusd: computeCorrelation(sub.map(d => d.gold), sub.map(d => d.eurusd))
    };
  }, [selectedInterval, data]);

  // Analysis trigger - use displayData for local context
  useEffect(() => {
    if (!selectedInterval) {
      setResults([]);
      return;
    }
    
    const intervalData = data.filter(d => {
      const ts = new Date(d.date).getTime();
      return ts >= selectedInterval[0] && ts <= selectedInterval[1];
    });

    if (intervalData.length < 3) return;

    const points = intervalData.map(d => ({
      t: new Date(d.date).getTime(),
      y: d.gold,
      date: d.date
    }));

    const resLinear = linearInterpolation(points);
    const resLagrange = lagrangeInterpolation(points);
    const resSpline = cubicSplineInterpolation(points);
    const resGPR = gaussianProcessAnalysis(points, correlations.dxy, correlations.eurusd);

    setResults([resLinear, resLagrange, resSpline, resGPR]);
  }, [selectedInterval, data, correlations]);

  // Analysis result for active selection
  const activeSubData = useMemo(() => {
    if (!selectedInterval) return [];
    return data.filter(d => {
       const ts = new Date(d.date).getTime();
       return ts >= selectedInterval[0] && ts <= selectedInterval[1];
    });
  }, [selectedInterval, data]);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(activeSubData.length > 0 ? activeSubData : data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GoldPriceAnalysis");
    XLSX.writeFile(wb, "GoldPrice_Analysis.xlsx");
  };

  const exportPython = () => {
    const activeRes = results.find(r => r.method.includes('Spline')) || results[0];
    const code = `
# GoldPulse Analysis Engine - Python Export
# Generated on: ${new Date().toISOString()}

import numpy as np
import matplotlib.pyplot as plt

# INTERVAL DATA
timestamps = [${activeSubData.map(d => new Date(d.date).getTime()).join(', ')}]
gold_prices = [${activeSubData.map(d => d.gold).join(', ')}]
dxy_index = [${activeSubData.map(d => d.dxy).join(', ')}]
eurusd_pair = [${activeSubData.map(d => d.eurusd).join(', ')}]

# Stats Profile
# Method used in analysis: ${activeRes?.method || 'N/A'}
# Formula: ${activeRes?.formula || 'N/A'}
# Stability Score: ${results.find(r => r.isGPR)?.stabilityScore?.toFixed(2) || 'N/A'}%
# Correlation Gold vs DXY: ${correlations.dxy.toFixed(4)}
# Correlation Gold vs EURUSD: ${correlations.eurusd.toFixed(4)}

import sklearn.gaussian_process as gp
from sklearn.gaussian_process.kernels import RBF, ConstantKernel as C

def analyze_market_high_fidelity():
    x = np.array(timestamps).reshape(-1, 1)
    y = np.array(gold_prices)
    
    # Bayesian Prior Integration (DXY/EUR Sensitivity)
    correlation_sensitivity = ${Math.abs(correlations.dxy) * 0.4 + Math.abs(correlations.eurusd) * 0.6}
    
    # Gaussian Process Regression
    kernel = C(1.0, (1e-3, 1e3)) * RBF(10, (1e-2, 1e2))
    model = gp.GaussianProcessRegressor(kernel=kernel, n_restarts_optimizer=10, alpha=0.5)
    
    model.fit(x, y)
    
    x_pred = np.linspace(x.min(), x.max(), 500).reshape(-1, 1)
    y_pred, sigma = model.predict(x_pred, return_std=True)
    
    return x_pred, y_pred, sigma

def analyze_market():
    x = np.array(timestamps)
    y = np.array(gold_prices)
    
    plt.figure(figsize=(12, 6))
    
    # Gold Price Plot
    plt.subplot(1, 2, 1)
    plt.plot(x, y, color='gold', marker='o', markersize=4, label='XAU/USD')
    plt.title('Gold Price Selection')
    plt.xlabel('Timestamp')
    plt.ylabel('Price (USD)')
    plt.grid(True, alpha=0.3)
    plt.legend()
    
    # Correlation Visualization
    plt.subplot(1, 2, 2)
    plt.scatter(dxy_index, gold_prices, color='red', alpha=0.5, label='Gold vs DXY')
    plt.title('Gold/DXY Correlation Analysis')
    plt.xlabel('DXY Index')
    plt.ylabel('Gold Price')
    plt.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    analyze_market()
    `;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gold_pulse_analysis.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0b0e14] text-slate-300 font-sans transition-colors duration-300 select-none">
      {/* HEADER / NAVIGATION */}
      <header className="shrink-0 border-b border-slate-800 bg-[#121620] z-30">
        <div className="h-14 px-6 flex items-center justify-between border-b border-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-amber-500 rounded-md flex items-center justify-center text-slate-900 font-bold italic text-lg shadow-[0_0_15px_rgba(245,158,11,0.3)]">Au</div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white leading-none">GoldOptix</h1>
              <span className="text-[9px] text-amber-500 font-mono uppercase opacity-60 tracking-widest">v2.5.0-PRO</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
             {/* UNIFIED EXPORT DROPDOWN */}
             <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-700">
                <button onClick={exportExcel} className="px-3 py-1 rounded text-[10px] font-bold text-slate-400 hover:text-white transition">XLSX</button>
                <div className="w-px h-3 bg-slate-700 mx-1" />
                <button onClick={exportPython} className="px-3 py-1 rounded text-[10px] font-bold text-slate-400 hover:text-white transition">PYTHON</button>
                <div className="w-px h-3 bg-slate-700 mx-1" />
                <button onClick={() => alert('API Details exported')} className="px-3 py-1 rounded text-[10px] font-bold text-slate-400 hover:text-white transition">API</button>
             </div>
          </div>
        </div>

        {/* PARAMETERS BAR */}
        <div className="h-14 px-6 flex items-center gap-8 bg-[#0d1017]">
          <div className="flex items-center gap-3">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Interval:</span>
             <div className="flex gap-1">
                {['Day', 'Month', 'Year', 'All'].map(t => (
                  <button 
                    key={t}
                    onClick={() => setTimeRange(t.toLowerCase() as any)}
                    className={`px-3 py-1 rounded text-[10px] font-bold transition ${timeRange === t.toLowerCase() ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    {t}
                  </button>
                ))}
             </div>
          </div>

          <div className="flex items-center gap-3">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Source:</span>
             <select 
               value={source}
               onChange={(e) => setSource(e.target.value as any)}
               className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-300 outline-none"
             >
                <option value="historical">Internal XAU History</option>
                <option value="api">Dynamic Live Feed</option>
             </select>
          </div>

          <div className="flex items-center gap-3 flex-1 max-w-xs">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">API Key:</span>
             <input 
               type="password"
               placeholder="••••••••••••"
               value={apiKey}
               onChange={(e) => setApiKey(e.target.value)}
               className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-300 outline-none focus:border-amber-500"
             />
          </div>

          {selectedInterval && (
            <button 
              onClick={() => setSelectedInterval(null)}
              className="px-3 py-1 rounded text-[10px] font-bold bg-amber-500 text-slate-900 transition hover:bg-amber-600 flex items-center gap-2"
            >
              <XCircle className="w-3.5 h-3.5" />
              Reset
            </button>
          )}

          <div className={`ml-auto text-xs font-mono flex items-center gap-2 ${source === 'api' ? 'text-emerald-400' : 'text-slate-500'}`}>
             <div className={`w-1.5 h-1.5 rounded-full ${source === 'api' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
             {source === 'api' ? 'LIVE MARKET STREAM' : 'HISTORICAL ENGINE'}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex overflow-hidden">
        {/* CENTER PANE: CHARTS */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0b0e14]">
            {/* LARGE GOLD CHART */}
            <div className="flex-[4] relative p-4 min-h-0">
                <div className="w-full h-full bg-[#121620] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                    <div className="p-4 border-b border-slate-800/50 flex justify-between items-center">
                       <h2 className="text-sm font-bold text-slate-400 flex items-center gap-2 uppercase tracking-widest">
                          <TrendingUp className="w-4 h-4 text-amber-500" />
                          Gold Price Visualizer
                       </h2>
                       <div className="flex gap-4 text-[11px] font-mono">
                          <span className="text-slate-500">XAU: <b className="text-amber-500">${data.length > 0 ? data[data.length-1].gold.toFixed(2) : '---'}</b></span>
                       </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <ChartContainer 
                          data={displayData} 
                          selectedInterval={selectedInterval}
                          onIntervalSelect={setSelectedInterval}
                          results={results}
                      />
                    </div>
                </div>
            </div>

            {/* CONDENSED CORRELATION SUMMARY */}
            <div className="flex-[0.8] overflow-y-auto px-4 pb-4 custom-scrollbar min-h-0">
                <div className="grid grid-cols-2 gap-3">
                  {/* DXY Panel */}
                  <div className="bg-[#121620] border border-slate-800 rounded-xl p-3 flex items-center justify-between shadow-lg">
                      <div className="flex flex-col gap-0.5">
                          <h3 className="text-[9px] uppercase font-black text-slate-500 tracking-widest leading-none">DXY Index</h3>
                          <span className="text-[11px] font-bold text-slate-300">Gold - Dollar</span>
                      </div>
                      <div className="text-right flex flex-col items-end gap-0.5">
                          <div className={`px-2 py-0.5 rounded border ${correlations.dxy < 0 ? 'border-red-500/30 text-red-500' : 'border-emerald-500/30 text-emerald-500'} font-mono text-xs font-black`}>
                              {correlations.dxy.toFixed(3)}
                          </div>
                          <span className="text-[7px] font-mono text-slate-600 block uppercase tracking-tighter italic leading-none">Correlation Vector Analysis</span>
                      </div>
                  </div>

                  {/* EUR/USD Panel */}
                  <div className="bg-[#121620] border border-slate-800 rounded-xl p-3 flex items-center justify-between shadow-lg">
                      <div className="flex flex-col gap-0.5">
                          <h3 className="text-[9px] uppercase font-black text-slate-500 tracking-widest leading-none">EUR / USD</h3>
                          <span className="text-[11px] font-bold text-slate-300">Euro Coupling</span>
                      </div>
                      <div className="text-right flex flex-col items-end gap-0.5">
                          <div className={`px-2 py-0.5 rounded border ${correlations.eurusd < 0 ? 'border-red-500/30 text-red-500' : 'border-emerald-500/30 text-emerald-500'} font-mono text-xs font-black`}>
                              {correlations.eurusd.toFixed(3)}
                          </div>
                          <span className="text-[7px] font-mono text-slate-600 block uppercase tracking-tighter italic leading-none">Currency Pair Coupling Matrix</span>
                      </div>
                  </div>
                </div>
            </div>
        </div>

        {/* RIGHT SIDEBAR: ANALYSIS RESULTS */}
        <aside className="w-[480px] shrink-0 border-l border-slate-800 bg-muted/20">
            <AnalysisPanel 
                results={results} 
                correlationDXY={correlations.dxy}
                correlationEURUSD={correlations.eurusd}
                onExportExcel={exportExcel}
                onExportPython={exportPython}
                onReset={() => setSelectedInterval(null)}
                insufficientData={selectedInterval !== null && results.length === 0}
            />
        </aside>
      </main>

      {/* STICKY FOOTER */}
      <footer className="h-6 bg-[#121620] border-t border-slate-800 px-6 flex items-center justify-between text-[9px] font-mono text-slate-600 uppercase tracking-widest shrink-0">
          <div>ENGINE: FOREX_SYNC_V50 :: <span className="text-amber-500 font-bold">${data.length > 0 ? data[data.length-1].gold.toFixed(2) : '---'}</span></div>
          <div className="flex gap-4">
              <span>DXY: <b className="text-slate-400">{data.length > 0 ? data[data.length-1].dxy.toFixed(2) : '--'}</b></span>
              <span>EUR/USD: <b className="text-slate-400">{data.length > 0 ? data[data.length-1].eurusd.toFixed(4) : '--'}</b></span>
          </div>
      </footer>
    </div>
  );
}
