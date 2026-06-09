import { supabaseService } from './supabase.service';
import { openrouterService } from './openrouter.service';
import * as XLSX from 'xlsx';
import { ColumnSchema, Canvas, CanvasRow } from '../types';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';

export const dataAgentService = {
  async detectDataRequest(message: string): Promise<{
    isDataRequest: boolean;
    mode?: 'search' | 'enrich';
    name?: string;
    enrichmentItems?: string[];
    rowsTarget?: number;
  }> {
    const system = `You are a classifier that detects if a user's prompt is a request for structured data (e.g. list, table, spreadsheet, catalog, database) or the enrichment of multiple items.
Respond ONLY with a JSON object. No markdown formatting.

If the user is asking to find or search a list of items (e.g., "Research the top 10 SaaS businesses", "find all restaurants in Denver"), classify this as "search".
If the user provides a specific list of items (e.g., names of companies, websites, cities) and asks to find details or enrich them (e.g., "enrich this list of companies with funding and founder", "here are 5 startups, find their tech stack"), classify this as "enrich".

Expected JSON output formats:
For search:
{
  "isDataRequest": true,
  "mode": "search",
  "name": "A short, descriptive name for the spreadsheet (e.g. 'Top SaaS Businesses 2026')",
  "rowsTarget": 10 // Extract the specific number of items requested (e.g., 10 from "top 10 SaaS companies"). Default to 20 if not specified.
}

For enrich:
{
  "isDataRequest": true,
  "mode": "enrich",
  "name": "A short, descriptive name for the spreadsheet (e.g. 'Company Research')",
  "enrichmentItems": ["item 1", "item 2", ...],
  "rowsTarget": 5 // Set to the count of enrichmentItems.
}

For non-data requests (general conversation, building apps, debugging, writing text, single entity queries like "tell me about Apple"):
{
  "isDataRequest": false
}
`;

    try {
      const responseText = await openrouterService.callModel(
        system,
        [{ role: 'user', content: message }],
        'deepseek/deepseek-chat'
      );
      
      const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
      // Auto-compute rowsTarget for enrich mode if not parsed
      if (parsed.isDataRequest && parsed.mode === 'enrich' && Array.isArray(parsed.enrichmentItems) && !parsed.rowsTarget) {
        parsed.rowsTarget = parsed.enrichmentItems.length;
      }
      
      return parsed;
    } catch (err) {
      console.error('Failed to detect data request:', err);
      return { isDataRequest: false };
    }
  },

  async inferSchema(query: string, mode: 'search' | 'enrich'): Promise<ColumnSchema[]> {
    const system = `You are a schema designer. Based on the user query, define a list of columns (maximum 7 columns) that would best display the requested structured data in a spreadsheet.
Respond ONLY with a JSON array of ColumnSchema objects. No markdown formatting.

Each column object must have:
- "key": string (lowercase, snake_case, unique, alphanumeric)
- "label": string (User-friendly column header)
- "type": "text" | "number" | "url" | "date"

Example output:
[
  { "key": "company_name", "label": "Company Name", "type": "text" },
  { "key": "funding_amount", "label": "Funding (USD)", "type": "number" },
  { "key": "website", "label": "Website", "type": "url" }
]
`;

    try {
      const responseText = await openrouterService.callModel(
        system,
        [{ role: 'user', content: `Query: ${query}\nMode: ${mode}` }],
        'deepseek/deepseek-chat'
      );

      const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const schema = JSON.parse(cleaned);
      if (Array.isArray(schema)) {
        return schema.slice(0, 7) as ColumnSchema[];
      }
      return [{ key: 'result', label: 'Result', type: 'text' }];
    } catch (err) {
      console.error('Failed to infer schema:', err);
      return [{ key: 'result', label: 'Result', type: 'text' }];
    }
  },

  async createCanvas(
    projectId: string,
    agentId: string | null,
    name: string,
    columns: ColumnSchema[],
    mode: 'search' | 'enrich',
    rowsTarget = 20
  ): Promise<Canvas> {
    const supabase = supabaseService.getServiceClient();
    const { data, error } = await supabase
      .from('canvases')
      .insert({
        project_id: projectId,
        agent_id: agentId,
        name,
        columns,
        rows_target: rowsTarget,
        rows_done: 0,
        mode,
        status: 'building',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create canvas: ${error.message}`);
    }

    emit(projectId, StreamEventType.CANVAS_CREATING,
      `Creating spreadsheet: ${name}`);

    return data as Canvas;
  },

  async saveRow(
    canvasId: string,
    rowIndex: number,
    data: Record<string, unknown>,
    sources: string[]
  ): Promise<CanvasRow> {
    const supabase = supabaseService.getServiceClient();
    const { data: rowData, error } = await supabase
      .from('canvas_rows')
      .insert({
        canvas_id: canvasId,
        row_index: rowIndex,
        data,
        sources,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save canvas row: ${error.message}`);
    }

    // Increment rows_done in canvases
    await supabase.rpc('increment_canvas_rows_done', { canvas_id_param: canvasId });

    try {
      const { data: canvas } = await supabase
        .from('canvases')
        .select('project_id')
        .eq('id', canvasId)
        .maybeSingle();
      if (canvas?.project_id) {
        emit(canvas.project_id, StreamEventType.CANVAS_ROW_ADDED,
          `Row ${rowIndex + 1} added`,
          {
            data: {
              rowIndex,
              preview: Object.values(data).slice(0, 2).join(' • ')
            }
          });
      }
    } catch {}

    return rowData as CanvasRow;
  },

  async finalizeCanvas(canvasId: string, status: 'done' | 'error' = 'done'): Promise<void> {
    const supabase = supabaseService.getServiceClient();
    
    try {
      const { data: canvas } = await supabase
        .from('canvases')
        .select('project_id, rows_done')
        .eq('id', canvasId)
        .maybeSingle();
      if (canvas) {
        const rowsDone = canvas.rows_done || 0;
        emit(canvas.project_id, StreamEventType.CANVAS_COMPLETE,
          `Spreadsheet complete: ${rowsDone} rows`,
          {
            status: status === 'done' ? 'done' : 'error',
            data: { rowsDone }
          });
      }
    } catch {}

    await supabase
      .from('canvases')
      .update({ status })
      .eq('id', canvasId);
  },

  async runSearchMode(
    canvasId: string,
    query: string,
    columns: ColumnSchema[],
    rowsTarget = 20
  ): Promise<void> {
    const system = `You are a structured research agent. Find records matching the user request.
Output the records as JSON Lines (one complete JSON object per line).
Columns schema defined:
${JSON.stringify(columns, null, 2)}

For each record, output exactly ONE line containing a JSON object in this format:
{"row_index": <0-indexed integer>, "data": { <key-value pairs matching columns> }, "sources": [<array of string URLs>]}

Ensure the data keys match the schema key names exactly.
Output exactly ${rowsTarget} rows if possible.
Do NOT output markdown. Do NOT wrap in \`\`\`json. Output raw JSON lines only, one object per line.`;

    try {
      const stream = openrouterService.streamModel(
        system,
        [{ role: 'user', content: query }],
        'deepseek/deepseek-chat'
      );

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let rowIndex = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed && parsed.data) {
              await this.saveRow(canvasId, rowIndex, parsed.data, parsed.sources || []);
              rowIndex++;
            }
          } catch (e) {
            // Incomplete line or malformed, ignore
          }
        }
      }

      // Handle any trailing data in buffer
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim());
          if (parsed && parsed.data) {
            await this.saveRow(canvasId, rowIndex, parsed.data, parsed.sources || []);
          }
        } catch (e) {
          // ignore
        }
      }

      await this.finalizeCanvas(canvasId, 'done');
    } catch (err) {
      console.error('Error in runSearchMode:', err);
      await this.finalizeCanvas(canvasId, 'error');
    }
  },

  async runEnrichMode(
    canvasId: string,
    items: string[],
    columns: ColumnSchema[]
  ): Promise<void> {
    const system = `You are a data enrichment agent. Given a target item and a schema, look up details for that item.
Columns schema:
${JSON.stringify(columns, null, 2)}

Respond with a JSON object in this format:
{
  "data": { <key-value pairs matching schema keys> },
  "sources": [<array of source URLs>]
}
Do NOT output markdown. Output raw JSON only.`;

    try {
      // Process items in batches of 3 to stay within rate/concurrency limits
      const batchSize = 3;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (item, batchIdx) => {
            const globalIdx = i + batchIdx;
            try {
              const responseText = await openrouterService.callModel(
                system,
                [{ role: 'user', content: `Item to enrich: ${item}` }],
                'deepseek/deepseek-chat'
              );
              const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
              const parsed = JSON.parse(cleaned);
              if (parsed && parsed.data) {
                await this.saveRow(canvasId, globalIdx, parsed.data, parsed.sources || []);
              }
            } catch (err) {
              console.error(`Enrichment failed for item: ${item}`, err);
              // Save placeholder/error row so indexing isn't broken
              const placeholder: Record<string, unknown> = {};
              columns.forEach(col => {
                placeholder[col.key] = 'N/A';
              });
              placeholder[columns[0].key] = item;
              await this.saveRow(canvasId, globalIdx, placeholder, []);
            }
          })
        );
      }
      await this.finalizeCanvas(canvasId, 'done');
    } catch (err) {
      console.error('Error in runEnrichMode:', err);
      await this.finalizeCanvas(canvasId, 'error');
    }
  },

  async exportToXlsx(canvasId: string): Promise<Buffer> {
    const supabase = supabaseService.getServiceClient();
    
    // Fetch canvas schema
    const { data: canvas, error: canvasErr } = await supabase
      .from('canvases')
      .select('*')
      .eq('id', canvasId)
      .single();

    if (canvasErr || !canvas) {
      throw new Error('Canvas not found');
    }

    // Fetch canvas rows
    const { data: rows, error: rowsErr } = await supabase
      .from('canvas_rows')
      .select('*')
      .eq('canvas_id', canvasId)
      .order('row_index', { ascending: true });

    if (rowsErr || !rows) {
      throw new Error('Canvas rows not found');
    }

    const columns: ColumnSchema[] = canvas.columns;
    
    // Format rows for excel export
    const excelData = rows.map((r: any) => {
      const formatted: Record<string, any> = {};
      columns.forEach(col => {
        formatted[col.label] = r.data[col.key] ?? '';
      });
      formatted['Sources'] = Array.isArray(r.sources) ? r.sources.join(', ') : '';
      return formatted;
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    
    // Excel sheet names cannot exceed 31 characters and cannot contain special characters like \ / ? * : [ ]
    const sanitizedSheetName = (canvas.name || 'Research')
      .substring(0, 31)
      .replace(/[\\\?\*\/\[\]\:]/g, '');
      
    XLSX.utils.book_append_sheet(wb, ws, sanitizedSheetName || 'Research');

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buf;
  }
};

export default dataAgentService;
