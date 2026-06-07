import React, { useEffect, useState, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { supabaseService } from '../../services/supabase.service';
import { Canvas, CanvasRow, ColumnSchema } from '../../types';
import { FileDown, Loader2, Database, AlertCircle, CheckCircle2 } from 'lucide-react';

// Register AG Grid modules globally for version 35+
ModuleRegistry.registerModules([AllCommunityModule]);

interface LiveDataCanvasProps {
  canvasId: string;
}

export default function LiveDataCanvas({ canvasId }: LiveDataCanvasProps) {
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [rowData, setRowData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const gridRef = useRef<AgGridReact>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!canvasId) return;

    const supabase = supabaseService.getClient();

    // 1. Fetch canvas details and current rows
    async function loadData() {
      try {
        setLoading(true);
        const { data: canvasData, error: canvasErr } = await supabase
          .from('canvases')
          .select('*')
          .eq('id', canvasId)
          .single();

        if (canvasErr) throw canvasErr;
        setCanvas(canvasData);

        const { data: rowsData, error: rowsErr } = await supabase
          .from('canvas_rows')
          .select('*')
          .eq('canvas_id', canvasId)
          .order('row_index', { ascending: true });

        if (rowsErr) throw rowsErr;

        // Map database row items to ag-grid row format
        const formattedRows = (rowsData || []).map((r: any) => ({
          row_index: r.row_index,
          id: r.id,
          ...r.data,
          sources: r.sources,
        }));
        setRowData(formattedRows);
      } catch (err) {
        console.error('Failed to load canvas data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();

    // 2. Subscribe to realtime row insertions
    const channel = supabase
      .channel(`canvas-rows-${canvasId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'canvas_rows',
          filter: `canvas_id=eq.${canvasId}`,
        },
        (payload) => {
          const newRow = payload.new as CanvasRow;
          const formatted = {
            row_index: newRow.row_index,
            id: newRow.id,
            ...newRow.data,
            sources: newRow.sources,
          };

          // Apply incremental row addition via transaction
          if (gridRef.current?.api) {
            gridRef.current.api.applyTransaction({ add: [formatted] });
          } else {
            setRowData((prev) => [...prev, formatted]);
          }

          // Update rows_done count locally
          setCanvas((prev) => (prev ? { ...prev, rows_done: prev.rows_done + 1 } : null));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'canvases',
          filter: `id=eq.${canvasId}`,
        },
        (payload) => {
          const updatedCanvas = payload.new as Canvas;
          setCanvas((prev) => (prev ? { ...prev, status: updatedCanvas.status } : updatedCanvas));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canvasId]);

  const handleExport = async () => {
    if (!canvasId) return;
    try {
      setExporting(true);
      const res = await fetch(`/api/canvas/export?canvasId=${canvasId}`);
      if (!res.ok) throw new Error('Failed to generate export file');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${canvas?.name || 'spreadsheet'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-[#85827D]">
        <Loader2 className="w-6 h-6 animate-spin text-[#191919] mb-2" />
        <p>Loading research spreadsheet...</p>
      </div>
    );
  }

  if (!canvas) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-[#85827D]">
        <AlertCircle className="w-6 h-6 text-red-500 mb-2" />
        <p>Spreadsheet not found or failed to load.</p>
      </div>
    );
  }

  // Create columns definition for AG Grid
  const columnsDefs = (canvas.columns || []).map((col: ColumnSchema) => ({
    field: col.key,
    headerName: col.label,
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1,
    minWidth: 120,
    cellRenderer: (params: any) => {
      if (col.type === 'url' && params.value) {
        return (
          <a
            href={params.value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline truncate block"
          >
            {params.value}
          </a>
        );
      }
      return params.value ?? '';
    },
  }));

  // Append Sources column at the end
  const allColumnDefs = [
    ...columnsDefs,
    {
      field: 'sources',
      headerName: 'Sources',
      sortable: false,
      filter: false,
      resizable: true,
      minWidth: 150,
      cellRenderer: (params: any) => {
        const sources = params.value;
        if (Array.isArray(sources) && sources.length > 0) {
          return (
            <div className="flex gap-1 items-center overflow-x-auto h-full scrollbar-none py-1">
              {sources.map((s: string, idx: number) => {
                let domain = 'Link';
                try {
                  domain = new URL(s).hostname.replace('www.', '');
                } catch (e) {}
                return (
                  <a
                    key={idx}
                    href={s}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 hover:border-emerald-200 px-1.5 py-0.5 rounded-sm transition-all"
                  >
                    {domain}
                  </a>
                );
              })}
            </div>
          );
        }
        return '';
      },
    },
  ];

  const progressPercent = canvas.rows_target > 0
    ? Math.min(100, Math.round((canvas.rows_done / canvas.rows_target) * 100))
    : 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white animate-fadeIn font-dmsans">
      {/* Top Header Card */}
      <div className="p-4 border-b border-[#E5E0DA] bg-[#FDFBF7] flex flex-col gap-2 shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#85827D] uppercase tracking-wider">
              <Database className="w-3.5 h-3.5 text-[#85827D]" />
              <span>LIVE DATA CANVAS</span>
              <span className="px-1.5 py-0.5 bg-[#EBE5DC] text-[#191919] rounded-md font-bold text-[9px]">
                {canvas.mode}
              </span>
            </div>
            <h2 className="text-sm font-bold text-[#191919] mt-0.5 font-lora">
              {canvas.name}
            </h2>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#191919] hover:bg-neutral-800 disabled:opacity-50 py-1.5 px-3 rounded-lg transition-all shadow-2xs cursor-pointer"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            <span>Export XLS</span>
          </button>
        </div>

        {/* Progress & Status Indicators */}
        <div className="flex flex-col gap-1.5 mt-1.5">
          <div className="flex items-center justify-between text-xs text-[#5E5B56]">
            <span className="flex items-center gap-1.5">
              {canvas.status === 'building' && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-[#85827D]" />
                  <span className="font-semibold text-[#85827D]">Researching and compiling...</span>
                </>
              )}
              {canvas.status === 'done' && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                  <span className="font-bold text-emerald-700">Complete!</span>
                </>
              )}
              {canvas.status === 'error' && (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                  <span className="font-bold text-red-600">Error during compilation</span>
                </>
              )}
            </span>
            <span className="font-bold">
              {canvas.rows_done} / {canvas.rows_target} records
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[#EBE5DC] h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ease-out rounded-full ${
                canvas.status === 'error'
                  ? 'bg-red-500'
                  : canvas.status === 'done'
                  ? 'bg-emerald-600'
                  : 'bg-[#191919]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Spreadsheet grid */}
      <div className="flex-1 ag-theme-alpine w-full relative min-h-0" style={{ height: '480px', minHeight: '350px' }}>
        {mounted ? (
          <AgGridReact
            ref={gridRef}
            rowData={rowData}
            columnDefs={allColumnDefs}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true,
            }}
            rowSelection="multiple"
            animateRows={true}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-[#85827D] italic">
            Initializing grid...
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 border-t border-[#E5E0DA] bg-[#FDFBF7] text-[10px] text-[#85827D] flex justify-between shrink-0 font-medium">
        <span>Dynamic real-time synchronization active</span>
        <span>Rendered via AG Grid Community</span>
      </div>
    </div>
  );
}
