import React from 'react';
import { AnalysisResult } from '../lib/math';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { CheckCircle, XCircle, Info, Calculator, FileJson, FileCode, Share2 } from 'lucide-react';

interface AnalysisPanelProps {
  results: AnalysisResult[];
  correlationDXY: number;
  correlationEURUSD: number;
  onExportExcel: () => void;
  onExportPython: () => void;
  onReset?: () => void;
  insufficientData?: boolean;
}

export function AnalysisPanel({ 
  results, 
  correlationDXY, 
  correlationEURUSD,
  onExportExcel,
  onExportPython,
  onReset,
  insufficientData
}: AnalysisPanelProps) {
  
  const bestMethod = results.length > 0 ? [...results].sort((a, b) => a.meanSquaredError - b.meanSquaredError)[0] : null;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-muted/20">
      <div className="p-4 border-b border-border bg-card flex justify-between items-center">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <Calculator className="w-4 h-4 text-amber-500" />
          Comparative Metrics
        </h3>
        {(results.length > 0 || insufficientData) && onReset && (
          <button 
            onClick={onReset}
            className="text-[9px] font-black text-amber-500 hover:text-amber-400 uppercase tracking-tighter flex items-center gap-1 transition-colors group"
          >
            <XCircle className="w-3 h-3 transition-transform group-hover:scale-110" />
            Clear Selection
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 custom-scrollbar">
        {insufficientData ? (
           <div className="flex flex-col items-center justify-center p-8 bg-amber-500/5 border border-amber-500/20 rounded-xl text-center">
              <Info className="w-8 h-8 text-amber-500 mb-3" />
              <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2">Insufficient Data</h4>
              <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                Select at least 3 data points to perform polynomial interpolation and uncertainty quantification.
              </p>
           </div>
        ) : results.length > 0 && bestMethod ? (
          <>
            <div className="space-y-4">
              {results.map((res, i) => (
                <div 
                  key={i} 
                  className={`relative p-4 rounded-xl border border-border transition-all ${
                    res.method === bestMethod.method 
                      ? 'bg-card border-amber-500/30' 
                      : 'bg-card/50'
                  }`}
                >
                    <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-6 rounded-full ${
                        res.isGPR ? 'bg-amber-400' :
                        res.method.includes('Spline') ? 'bg-emerald-500' : 
                        res.method.includes('Lagrange') ? 'bg-blue-500' : 'bg-slate-500'
                      }`} />
                      <h3 className="font-mono text-sm font-bold text-foreground">{res.method}</h3>
                    </div>
                    <div className="text-right">
                       <span className="text-[9px] text-muted-foreground uppercase font-black block">
                        {res.isGPR ? 'Stability Score' : 'Std. Error (se)'}
                       </span>
                       <span className={`text-xs font-mono font-bold ${res.method === bestMethod.method ? 'text-amber-500' : 'text-muted-foreground'}`}>
                        {res.isGPR ? `${res.stabilityScore?.toFixed(1)}%` : res.standardError.toFixed(4)}
                       </span>
                    </div>
                  </div>
                  
                  <div className="bg-muted/50 rounded-lg p-3 mb-4 overflow-x-auto border border-border shadow-inner relative group">
                    <div className="scale-90 origin-left">
                      <BlockMath math={res.isGPR && res.latexFormula ? res.latexFormula : res.formula} />
                    </div>
                    {res.isGPR && (
                      <div className="absolute top-2 right-2 flex flex-col items-end">
                        <span className="text-[7px] text-muted-foreground uppercase font-black tracking-tighter">Stability Matrix</span>
                        <span className={`text-[10px] font-mono font-bold ${res.stabilityScore && res.stabilityScore > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {res.stabilityScore?.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[9px] font-black text-emerald-500 flex items-center gap-1 mb-2 uppercase italic tracking-wider">
                         Pros
                      </h4>
                      <ul className="text-[10px] space-y-1 text-muted-foreground">
                        {res.pros.slice(0, 2).map((p, j) => <li key={j} className="flex gap-1.5 items-start"><span>•</span> {p}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-[9px] font-black text-amber-500 flex items-center gap-1 mb-2 uppercase italic tracking-wider">
                        Cons
                      </h4>
                      <ul className="text-[10px] space-y-1 text-muted-foreground">
                        {res.cons.slice(0, 2).map((c, j) => <li key={j} className="flex gap-1.5 items-start"><span>•</span> {c}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Uncertainty Quantification Panel */}
            <div className="p-4 bg-muted/40 rounded-xl border border-border font-mono text-[10px] space-y-2">
              <div className="text-amber-500/70 mb-2 font-bold tracking-tight uppercase flex justify-between items-center">
                <span>// Uncertainty Quantification Layer</span>
                <span className="text-[8px] bg-amber-500/10 px-1 rounded">GPR VARIANCE AUDIT</span>
              </div>
              <div className="flex flex-col gap-1 text-muted-foreground italic">
                <div className="bg-background/50 p-1.5 rounded border border-border/50 overflow-hidden">
                  <span className="text-muted-foreground/60">Cov(t) = </span> 
                  <InlineMath math="k(t, t) - k_*(t)^T (K + \sigma_n^2 I)^{-1} k_*(t)" />
                </div>
                <div className="bg-background/50 p-1.5 rounded border border-border/50 overflow-hidden">
                   <span className="text-muted-foreground/60">P(t) Stability Score = </span> 
                   <InlineMath math="{\mathcal{S} \approx 100 - (\alpha |\rho_{DXY}| + \beta |\rho_{EUR}|)}" />
                </div>
              </div>
            </div>

            {/* Recommendation Box */}
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-emerald-500/10 p-1 rounded">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest leading-none">Recommended: {bestMethod.method.toUpperCase()}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed italic mb-3">
                Current window volatility suggests minimal oscillation in the <strong>{bestMethod.method}</strong> vector. 
                Forex deviation from spline is partially negated by consistent DXY trends.
              </p>
              <div className="pt-3 border-t border-emerald-500/10 flex gap-2">
                <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-bold">OPTIMAL FIT</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-30">
            <Calculator className="w-16 h-16 mb-4 text-slate-500" />
            <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Awaiting Interval Selection</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-card border-t border-border grid grid-cols-2 gap-3">
        <button 
          onClick={onExportPython}
          className="bg-muted border border-border hover:border-primary rounded py-2 text-[10px] font-bold text-muted-foreground hover:text-foreground transition flex items-center justify-center gap-2"
        >
          <FileCode className="w-3.5 h-3.5" /> SNIPPET.PY
        </button>
        <button className="bg-muted border border-border hover:border-primary rounded py-2 text-[10px] font-bold text-muted-foreground hover:text-foreground transition flex items-center justify-center gap-2">
           <Share2 className="w-3.5 h-3.5" /> API DETAILS
        </button>
      </div>
    </div>
  );
}
