import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { MarketData } from '../services/dataService';
import { AnalysisResult } from '../lib/math';

interface ChartContainerProps {
  data: MarketData[];
  selectedInterval: [number, number] | null;
  onIntervalSelect: (interval: [number, number] | null) => void;
  results: AnalysisResult[];
}

export function ChartContainer({ data, selectedInterval, onIntervalSelect, results }: ChartContainerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const margin = { top: 20, right: 40, bottom: 100, left: 60 };
  const navHeight = 40;
  const navMargin = { top: 10, bottom: 20 };
  const width = Math.max(0, dimensions.width - margin.left - margin.right);
  const height = Math.max(0, dimensions.height - margin.top - margin.bottom);

  useEffect(() => {
    if (!svgRef.current || width <= 0 || height <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Clipping path for the main area
    svg.append("defs").append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("width", width)
      .attr("height", height);

    const mainG = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const navG = svg.append("g")
      .attr("transform", `translate(${margin.left},${dimensions.height - navHeight - navMargin.bottom})`);

    const chartData = data.map(d => ({
      ...d,
      dateObj: new Date(d.date)
    })).filter(d => !isNaN(d.dateObj.getTime()));

    if (chartData.length === 0) return;

    // Main Scales
    const x = d3.scaleTime()
      .domain(d3.extent(chartData, d => d.dateObj) as [Date, Date])
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([
        d3.min(chartData, d => d.gold)! * 0.98,
        d3.max(chartData, d => d.gold)! * 1.02
      ])
      .range([height, 0]);

    // Navigator Scales
    const xNav = d3.scaleTime()
      .domain(x.domain())
      .range([0, width]);

    const yNav = d3.scaleLinear()
      .domain(y.domain())
      .range([navHeight, 0]);

    // Axes
    const xAxis = d3.axisBottom(x).ticks(8);
    const yAxis = d3.axisLeft(y).ticks(10);

    const gX = mainG.append("g")
      .attr("transform", `translate(0,${height})`)
      .attr("class", "x-axis")
      .call(xAxis)
      .attr("color", "currentColor")
      .attr("opacity", 0.3);

    const gY = mainG.append("g")
      .attr("class", "y-axis")
      .call(yAxis)
      .attr("color", "currentColor")
      .attr("opacity", 0.3);

    // Grid lines
    const gridX = mainG.append("g")
      .attr("class", "grid-lines")
      .attr("transform", `translate(0,${height})`)
      .attr("opacity", 0.05)
      .call(d3.axisBottom(x).tickSize(-height).tickFormat(() => ""));

    const gridY = mainG.append("g")
      .attr("class", "grid-lines")
      .attr("opacity", 0.05)
      .call(d3.axisLeft(y).tickSize(-width).tickFormat(() => ""));

    // Line Generator
    const line = d3.line<any>()
      .x(d => x(d.dateObj))
      .y(d => y(d.gold))
      .curve(d3.curveMonotoneX);

    const navLine = d3.line<any>()
      .x(d => xNav(d.dateObj))
      .y(d => yNav(d.gold))
      .curve(d3.curveMonotoneX);

    // Drawing Main Line (Clipped)
    const linePath = mainG.append("path")
      .datum(chartData)
      .attr("class", "main-line")
      .attr("fill", "none")
      .attr("stroke", "#f59e0b")
      .attr("stroke-width", 2)
      .attr("clip-path", "url(#clip)")
      .attr("d", line);

    // Navigator Line
    navG.append("path")
      .datum(chartData)
      .attr("fill", "none")
      .attr("stroke", "#f59e0b")
      .attr("stroke-width", 1)
      .attr("opacity", 0.4)
      .attr("d", navLine);

    // Analysis Layer (Confidence bands, etc) - Contained in group to clip
    const analysisG = mainG.append("g").attr("clip-path", "url(#clip)");

    const drawAnalysis = (currX: any, currY: any) => {
      analysisG.selectAll("*").remove();
      if (results.length > 0 && selectedInterval) {
        // Find GPR or best method for visualization
        const activeRes = results.find(r => r.isGPR) || 
                         results.find(r => r.method === 'Cubic Spline') || 
                         results[0];
        
        const tStart = selectedInterval[0];
        const tEnd = selectedInterval[1];
        const numPoints = 150;

        const pts: any[] = [];
        for(let i=0; i<=numPoints; i++) {
            const t = tStart + (i/numPoints) * (tEnd - tStart);
            pts.push({ t, yVal: activeRes.predict(t), ci: activeRes.ciHalfWidth(t), pi: activeRes.piHalfWidth(t) });
        }

        const areaPi = d3.area<any>()
          .x(d => currX(new Date(d.t)))
          .y0(d => currY(d.yVal - d.pi))
          .y1(d => currY(d.yVal + d.pi));

        const areaCi = d3.area<any>()
          .x(d => currX(new Date(d.t)))
          .y0(d => currY(d.yVal - d.ci))
          .y1(d => currY(d.yVal + d.ci));

        const interpLine = d3.line<any>()
          .x(d => currX(new Date(d.t)))
          .y(d => currY(d.yVal));

        analysisG.append("path").datum(pts).attr("fill", "#10b981").attr("opacity", 0.05).attr("d", areaPi);
        analysisG.append("path").datum(pts).attr("fill", "#10b981").attr("opacity", 0.15).attr("d", areaCi);
        analysisG.append("path").datum(pts).attr("fill", "none").attr("stroke", "#10b981").attr("stroke-width", 2).attr("stroke-dasharray", "4,4").attr("d", interpLine);
      }
    };

    // Interaction Overlays
    const zoom = d3.zoom<SVGRectElement, unknown>()
      .scaleExtent([1, 100])
      .translateExtent([[-width * 0.1, -height], [width * 1.1, height * 2]]) // Allow slight horizontal over-pan
      .on("zoom", (event) => {
        const { transform } = event;
        const zx = transform.rescaleX(x);
        
        // Find visible data points to auto-scale Y (Professional Trading View feel)
        const visibleData = chartData.filter(d => {
          const xPos = zx(d.dateObj);
          return xPos >= 0 && xPos <= width;
        });

        const yDomain = visibleData.length > 0 
          ? [d3.min(visibleData, d => d.gold)! * 0.995, d3.max(visibleData, d => d.gold)! * 1.005]
          : y.domain();

        const zy = d3.scaleLinear().domain(yDomain).range([height, 0]);

        // Update main line
        linePath.attr("d", d3.line<any>()
          .x(d => zx(d.dateObj))
          .y(d => zy(d.gold))
          .curve(d3.curveMonotoneX)(chartData)
        );

        gX.call(xAxis.scale(zx));
        gY.call(yAxis.scale(zy));
        gridX.call(d3.axisBottom(zx).tickSize(-height).tickFormat(() => ""));
        gridY.call(d3.axisLeft(zy).tickSize(-width).tickFormat(() => ""));
        
        drawAnalysis(zx, zy);
      })
      .on("start", (event) => {
        if (event.sourceEvent?.type === 'mousedown') {
          svg.style("cursor", "grabbing");
        }
      })
      .on("end", () => {
        svg.style("cursor", "crosshair");
      });

    const brush = d3.brushX()
      .extent([[0, 0], [width, navHeight]])
      .on("brush end", (event) => {
        if (!event.sourceEvent) return;
        const s = event.selection || xNav.range();
        const selected = s.map(xNav.invert);
        onIntervalSelect(event.selection ? [selected[0].getTime(), selected[1].getTime()] : null);
      });

    // Apply Zoom Behavior to a clear rect over main chart
    const zoomArea = mainG.append("rect")
      .attr("class", "zoom-area")
      .attr("width", width)
      .attr("height", height)
      .style("fill", "transparent")
      .style("pointer-events", "all")
      .style("cursor", "crosshair")
      .call(zoom);

    // Sync initial state
    zoomArea.call(zoom.transform, d3.zoomIdentity);

    // Navigator Brush
    navG.append("g")
      .attr("class", "brush")
      .call(brush)
      .call(brush.move, selectedInterval ? [xNav(new Date(selectedInterval[0])), xNav(new Date(selectedInterval[1]))] : null);

    // Initial Analysis Render
    drawAnalysis(x, y);

    // Legend
    const legend = svg.append("g")
      .attr("transform", `translate(${margin.left}, 15)`);
    
    // Add interaction hints
    legend.append("text")
      .attr("x", width)
      .attr("text-anchor", "end")
      .attr("class", "text-[9px] fill-slate-500 italic")
      .text("Scroll to Zoom • Drag to Pan • Brush Navigator to Select");

    // Labels
    navG.append("text")
      .attr("x", 0)
      .attr("y", -5)
      .attr("class", "text-[9px] fill-slate-500 font-bold uppercase tracking-widest")
      .text("Historical Context Navigator");

  }, [data, width, height, selectedInterval, results]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full overflow-visible" />
      {!selectedInterval && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20 text-center">
            <p className="text-sm font-medium">Drag horizontally to select interval for analysis</p>
        </div>
      )}
    </div>
  );
}
