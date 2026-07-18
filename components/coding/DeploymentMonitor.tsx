'use client';

import React, { useEffect, useState } from 'react';

interface DeploymentMonitorProps {
  projectId: string;
}

export default function DeploymentMonitor({ projectId }: DeploymentMonitorProps) {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/coding/monitor/list?projectId=${projectId}`);
      const data = await res.json();
      if (data.success) {
        setMonitors(data.monitors || []);
        setIncidents(data.incidents || []);
      }
    } catch (err) {
      console.error('Failed to fetch monitors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [projectId]);

  const getStatusBadge = (monitor: any) => {
    const isDown = monitor.error_count > 0;
    const isDegraded = monitor.uptime_percent < 99 && monitor.uptime_percent >= 95;

    if (isDown) {
      return (
        <span className="flex items-center gap-1.5 text-[9px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-bold uppercase select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
          Down
        </span>
      );
    }
    if (isDegraded) {
      return (
        <span className="flex items-center gap-1.5 text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold uppercase select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Degraded
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 text-[9px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-bold uppercase select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
        Online
      </span>
    );
  };

  return (
    <div className="bg-white border border-[#E5E0DA] rounded-2xl p-6 shadow-3xs space-y-6 font-dmsans">
      <div className="flex items-center justify-between border-b border-[#F4F0EB] pb-4 select-none">
        <div>
          <h3 className="font-lora text-base font-bold text-[#191919] flex items-center gap-2">
            <i className="ti ti-activity-heartbeat text-[#cc785c]" />
            Production Monitoring
          </h3>
          <p className="text-[10px] text-[#85827D] mt-0.5 font-medium">Automatic performance monitoring, downtime detection, and self-healing deployment recovery</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-xs text-[#85827D] select-none font-medium">
          <i className="ti ti-loader animate-spin mr-2" />
          Loading deployment health metrics...
        </div>
      ) : monitors.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-[#E5E0DA] bg-white rounded-2xl text-xs text-[#85827D] italic select-none">
          No live application deployments active. Auto-deploy to activate monitoring.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {monitors.map(monitor => (
              <div key={monitor.id} className="border border-[#E5E0DA] hover:border-[#cc785c]/40 rounded-xl p-4 bg-[#F9F8F6] transition-all space-y-4 shadow-4xs">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[8px] bg-zinc-200 text-[#5E5B56] border border-zinc-300 font-bold px-1.5 py-0.5 rounded uppercase font-mono">
                      {monitor.platform}
                    </span>
                    <a
                      href={monitor.deployed_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-xs font-bold text-[#191919] hover:text-[#cc785c] truncate max-w-[180px] mt-1"
                    >
                      {monitor.deployed_url}
                    </a>
                  </div>
                  {getStatusBadge(monitor)}
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-center select-none pt-2.5 border-t border-[#F4F0EB]/60">
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-[#85827D] uppercase font-bold tracking-wider">Uptime</span>
                    <h4 className="text-xs font-bold text-[#191919] font-mono">{monitor.uptime_percent}%</h4>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-[#85827D] uppercase font-bold tracking-wider">Latency</span>
                    <h4 className="text-xs font-bold text-[#191919] font-mono">{monitor.avg_response_ms || 0}ms</h4>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-[#85827D] uppercase font-bold tracking-wider">Checked</span>
                    <h4 className="text-xs font-bold text-[#191919] font-mono">
                      {monitor.last_checked ? `${new Date(monitor.last_checked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '-'}
                    </h4>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Incidents Section */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-[#85827D] uppercase tracking-wider mb-2 select-none">Incident History</h4>
            {incidents.length === 0 ? (
              <div className="text-left py-4 px-5 border border-[#E5E0DA] bg-white rounded-xl text-[10px] text-[#85827D] italic select-none">
                No downtime incidents reported. All services running smoothly.
              </div>
            ) : (
              <div className="bg-white border border-[#E5E0DA] rounded-xl overflow-hidden divide-y divide-[#F4F0EB]">
                {incidents.map(inc => (
                  <div key={inc.id} className="p-3.5 hover:bg-[#F9F8F6] transition-colors flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-[10px] font-bold text-[#191919] capitalize">
                          {inc.incident_type.replace('_', ' ')}
                        </strong>
                        <span className="text-[9px] text-[#85827D] font-mono">
                          {new Date(inc.started_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[9px] text-[#5E5B56] truncate max-w-[420px] font-mono bg-zinc-50 border border-zinc-100 p-1 rounded">
                        {inc.error_details}
                      </p>
                      {inc.auto_fix_attempted && (
                        <div className="flex items-center gap-1.5 text-[9px] text-green-700 font-semibold pt-1">
                          <i className="ti ti-sparkles animate-pulse" />
                          <span>{inc.resolved ? inc.auto_fix_result : 'Auto-repair fix pending deployment...'}</span>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 pt-0.5">
                      <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                        inc.resolved
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                      }`}>
                        {inc.resolved ? 'Resolved' : 'Active'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
