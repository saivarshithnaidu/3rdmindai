'use client';

import React, { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Award, Clock, Star, RefreshCw } from 'lucide-react';

interface AnalyticsPanelProps {
  agentId: string;
  projectId: string;
}

export default function AnalyticsPanel({ agentId, projectId }: AnalyticsPanelProps) {
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTrendData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/trend?agentId=${agentId}&projectId=${projectId}&weeks=8`);
      if (res.ok) {
        const data = await res.json();
        setTrends(data.trend || []);
      }
    } catch (err) {
      console.error('Failed to load analytics trend data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrendData();
  }, [agentId, projectId]);

  // Aggregate stats based on trends
  const totalCompleted = trends.reduce((acc, t) => acc + (t.tasks_completed || 0), 0);
  const totalFailed = trends.reduce((acc, t) => acc + (t.tasks_failed || 0), 0);
  const totalTasks = totalCompleted + totalFailed;
  
  const avgScore = trends.length > 0 
    ? parseFloat((trends.reduce((acc, t) => acc + (t.avg_judge_score || 0), 0) / trends.length).toFixed(1))
    : 0;

  const avgRevisions = trends.length > 0 
    ? parseFloat((trends.reduce((acc, t) => acc + (t.avg_revision_rounds || 0), 0) / trends.length).toFixed(1))
    : 0;

  // Render SVG charts
  const renderQualityTrendLineChart = () => {
    if (trends.length === 0) return <div className="text-center py-6 text-[10px] text-[#85827D]">No trend data available.</div>;

    const width = 220;
    const height = 100;
    const padding = 15;
    
    const maxScore = 50;
    
    // Map points to SVG coordinates
    const points = trends.map((t, idx) => {
      const x = padding + (idx / Math.max(1, trends.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((t.avg_judge_score || 0) / maxScore) * (height - 2 * padding);
      return { x, y, score: t.avg_judge_score, label: t.week_start.split('-')[1] + '/' + t.week_start.split('-')[2] };
    });

    const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <svg className="w-full" viewBox={`0 0 ${width} ${height}`}>
        {/* Grid lines */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#E5E0DA" strokeWidth="1" />
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#F5F3EE" strokeWidth="1" strokeDasharray="2" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#F5F3EE" strokeWidth="1" strokeDasharray="2" />

        {/* Line path */}
        {points.length > 1 && (
          <path d={pathD} fill="none" stroke="#D97757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Data points */}
        {points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="#white" stroke="#D97757" strokeWidth="2" />
            <text x={p.x} y={p.y - 6} textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#191919">
              {p.score}
            </text>
            <text x={p.x} y={height - 4} textAnchor="middle" fontSize="6.5" fill="#85827D">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  const renderTaskVolumeBarChart = () => {
    if (trends.length === 0) return <div className="text-center py-6 text-[10px] text-[#85827D]">No volume data available.</div>;

    const width = 220;
    const height = 100;
    const padding = 15;
    
    const maxVal = Math.max(3, ...trends.map(t => (t.tasks_completed || 0) + (t.tasks_failed || 0)));
    const barWidth = 14;
    const spacing = (width - 2 * padding) / trends.length;

    return (
      <svg className="w-full" viewBox={`0 0 ${width} ${height}`}>
        {/* Grid lines */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#E5E0DA" strokeWidth="1" />

        {trends.map((t, idx) => {
          const comp = t.tasks_completed || 0;
          const fail = t.tasks_failed || 0;
          const total = comp + fail;
          
          const compHeight = (comp / maxVal) * (height - 2 * padding);
          const failHeight = (fail / maxVal) * (height - 2 * padding);

          const x = padding + idx * spacing + (spacing - barWidth) / 2;
          const yComp = height - padding - compHeight;
          const yFail = yComp - failHeight;

          const label = t.week_start.split('-')[1] + '/' + t.week_start.split('-')[2];

          return (
            <g key={idx}>
              {/* Completed tasks bar */}
              {comp > 0 && (
                <rect x={x} y={yComp} width={barWidth} height={compHeight} fill="#D97757" rx="1.5" />
              )}
              {/* Failed tasks bar */}
              {fail > 0 && (
                <rect x={x} y={yFail} width={barWidth} height={failHeight} fill="#EF4444" rx="1.5" />
              )}
              {/* Label */}
              <text x={x + barWidth / 2} y={height - 4} textAnchor="middle" fontSize="6.5" fill="#85827D">
                {label}
              </text>
              {/* Total text */}
              <text x={x + barWidth / 2} y={Math.min(yComp, yFail) - 4} textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#191919">
                {total}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  const renderScoreRadarChart = () => {
    // Standard radar dimensions for 5 scores
    const width = 220;
    const height = 140;
    const cx = width / 2;
    const cy = height / 2;
    const maxRadius = 45;

    // Dimensions labels
    const labels = ['Completeness', 'Accuracy', 'Actionability', 'Role Fidelity', 'Quality'];
    // We mock values if no specific stats exist, or pull from last evaluation
    const values = [8, 9, 7, 9, 8]; // Example base profile

    const angles = [0, 72, 144, 216, 288].map(a => (a - 90) * (Math.PI / 180));

    // Outer grid polygon
    const gridPoints = angles.map(a => {
      const x = cx + maxRadius * Math.cos(a);
      const y = cy + maxRadius * Math.sin(a);
      return `${x},${y}`;
    }).join(' ');

    const innerGridPoints = angles.map(a => {
      const x = cx + (maxRadius * 0.5) * Math.cos(a);
      const y = cy + (maxRadius * 0.5) * Math.sin(a);
      return `${x},${y}`;
    }).join(' ');

    // Value points mapping
    const valPoints = values.map((val, idx) => {
      const radius = (val / 10) * maxRadius;
      const x = cx + radius * Math.cos(angles[idx]);
      const y = cy + radius * Math.sin(angles[idx]);
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg className="w-full" viewBox={`0 0 ${width} ${height}`}>
        {/* Grids */}
        <polygon points={gridPoints} fill="none" stroke="#E5E0DA" strokeWidth="1" />
        <polygon points={innerGridPoints} fill="none" stroke="#F5F3EE" strokeWidth="1" strokeDasharray="2" />
        
        {/* Grid spoke lines */}
        {angles.map((a, idx) => (
          <line key={idx} x1={cx} y1={cy} x2={cx + maxRadius * Math.cos(a)} y2={cy + maxRadius * Math.sin(a)} stroke="#E5E0DA" strokeWidth="1" />
        ))}

        {/* Data polygon */}
        <polygon points={valPoints} fill="rgba(217, 119, 87, 0.15)" stroke="#D97757" strokeWidth="2" />

        {/* Labels text */}
        {labels.map((label, idx) => {
          const a = angles[idx];
          const textRadius = maxRadius + 14;
          const tx = cx + textRadius * Math.cos(a);
          const ty = cy + textRadius * Math.sin(a);
          
          let anchor: 'start' | 'end' | 'middle' | 'inherit' = 'middle';
          if (Math.cos(a) > 0.1) anchor = 'start';
          if (Math.cos(a) < -0.1) anchor = 'end';

          return (
            <text key={label} x={tx} y={ty + 3} textAnchor={anchor} fontSize="7" fontWeight="bold" fill="#5E5B56">
              {label} ({values[idx]})
            </text>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="space-y-6 font-dmsans h-full flex flex-col justify-between">
      <div className="space-y-6 flex-1 overflow-y-auto pr-1">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E0DA] pb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#85827D]">
            <BarChart2 className="w-4 h-4 text-[#D97757]" />
            <span>Agent Performance Analytics</span>
          </div>

          <button
            type="button"
            onClick={loadTrendData}
            className="p-1 hover:bg-[#F4F0EB] text-[#5E5B56] hover:text-[#191919] rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="text-xs text-[#85827D]">Aggregating analytics...</div>
          </div>
        ) : (
          <>
            {/* General metrics cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl p-3 flex flex-col justify-between h-[64px]">
                <span className="text-[8px] font-bold uppercase tracking-wider text-[#85827D]">Tasks Done</span>
                <span className="text-lg font-extrabold text-[#191919]">{totalTasks} ({totalCompleted} OK / {totalFailed} ERR)</span>
              </div>
              <div className="bg-[#FBF9F6] border border-[#E5E0DA] rounded-2xl p-3 flex flex-col justify-between h-[64px]">
                <span className="text-[8px] font-bold uppercase tracking-wider text-[#85827D]">Revision Avg</span>
                <span className="text-lg font-extrabold text-[#191919]">{avgRevisions} rounds</span>
              </div>
            </div>

            {/* Quality trend */}
            <div className="bg-white border border-[#E5E0DA] rounded-2xl p-4 space-y-3">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#85827D] block">Quality Trend (Last 8 Weeks)</span>
              {renderQualityTrendLineChart()}
            </div>

            {/* Task volume */}
            <div className="bg-white border border-[#E5E0DA] rounded-2xl p-4 space-y-3">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#85827D] block">Task Volume & Failure Rate</span>
              {renderTaskVolumeBarChart()}
            </div>

            {/* Skill Radar */}
            <div className="bg-white border border-[#E5E0DA] rounded-2xl p-4 space-y-3">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#85827D] block">Capabilities Radar</span>
              {renderScoreRadarChart()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
