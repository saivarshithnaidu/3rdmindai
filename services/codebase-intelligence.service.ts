import supabaseService from './supabase.service';
import openrouterService from './openrouter.service';
import embeddingService from './embedding.service';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';
import JSZip from 'jszip';
import { Octokit } from '@octokit/rest';
import { decrypt } from '../lib/crypto';

export interface CodebaseSymbol {
  type: 'function' | 'class' | 'interface' | 'component' | 'route' | 'schema' | 'type' | 'constant';
  name: string;
  signature: string;
  description: string;
  line_start: number;
  line_end: number;
}

export const codebaseIntelligenceService = {
  /**
   * Helper: detect syntax highlighting language from file extension
   */
  detectLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'py':
        return 'python';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'json':
        return 'json';
      case 'sql':
        return 'sql';
      case 'md':
        return 'markdown';
      case 'sh':
      case 'bash':
        return 'shell';
      case 'dockerfile':
        return 'dockerfile';
      case 'yml':
      case 'yaml':
        return 'yaml';
      default:
        return 'plaintext';
    }
  },

  /**
   * Main indexing function
   */
  async indexCodebase(
    projectId: string,
    source: 'upload' | 'github' | 'session',
    sourceData: any
  ): Promise<{ sessionId?: string; fileCount: number; symbolCount: number }> {
    const supabase = supabaseService.getServiceClient();
    
    emit(projectId, StreamEventType.TOOL_CALLING, `Starting codebase indexing via ${source}...`, { status: 'running' });

    let filesToProcess: Array<{ filePath: string; content: string; language: string }> = [];
    let sessionId: string | undefined;

    if (source === 'upload') {
      // sourceData is either a Buffer or base64 string of the zip file
      let zipBuffer: Buffer;
      if (typeof sourceData === 'string') {
        zipBuffer = Buffer.from(sourceData, 'base64');
      } else if (Buffer.isBuffer(sourceData)) {
        zipBuffer = sourceData;
      } else {
        throw new Error('Invalid upload source data format');
      }

      const zip = await JSZip.loadAsync(zipBuffer);
      const filePaths = Object.keys(zip.files);

      for (const filePath of filePaths) {
        const file = zip.files[filePath];
        if (file.dir) continue;

        // Skip excluded folders and files
        const parts = filePath.split('/');
        if (
          parts.includes('node_modules') ||
          parts.includes('.git') ||
          parts.includes('dist') ||
          parts.includes('build') ||
          parts.includes('.next') ||
          filePath.endsWith('.env') ||
          filePath.endsWith('.env.local') ||
          filePath.endsWith('.env.production') ||
          filePath.endsWith('.env.development')
        ) {
          continue;
        }

        // Exclude large binary formats
        const ext = filePath.split('.').pop()?.toLowerCase();
        if (ext && ['zip', 'png', 'jpg', 'jpeg', 'gif', 'ico', 'pdf', 'mp3', 'mp4', 'woff', 'woff2', 'ttf'].includes(ext)) {
          continue;
        }

        const content = await file.async('string');
        const language = this.detectLanguageFromPath(filePath);
        filesToProcess.push({ filePath, content, language });
      }
    } else if (source === 'github') {
      // sourceData: { repo: 'owner/repo', branch?: 'main', userId: 'uuid' }
      const { repo, branch = 'main', userId } = sourceData;
      if (!repo) throw new Error('Missing GitHub repo parameter');

      // Fetch GitHub connector credentials
      const { data: connector } = await supabase
        .from('connectors')
        .select('*')
        .eq('user_id', userId || '00000000-0000-0000-0000-000000000000')
        .eq('slug', 'github')
        .maybeSingle();

      let token = process.env.GITHUB_TOKEN || '';
      if (connector?.access_token) {
        token = decrypt(connector.access_token);
      }

      const octokit = new Octokit({ auth: token || undefined });
      const [owner, repoName] = repo.split('/');

      // Fetch file tree recursively
      const { data: treeData } = await octokit.git.getTree({
        owner,
        repo: repoName,
        tree_sha: branch,
        recursive: 'true'
      });

      for (const item of treeData.tree) {
        if (item.type !== 'blob' || !item.path) continue;

        const filePath = item.path;
        const parts = filePath.split('/');
        
        if (
          parts.includes('node_modules') ||
          parts.includes('.git') ||
          parts.includes('dist') ||
          parts.includes('build') ||
          parts.includes('.next') ||
          filePath.endsWith('.env') ||
          filePath.endsWith('.env.local') ||
          filePath.endsWith('.env.production') ||
          filePath.endsWith('.env.development')
        ) {
          continue;
        }

        const ext = filePath.split('.').pop()?.toLowerCase();
        if (ext && ['zip', 'png', 'jpg', 'jpeg', 'gif', 'ico', 'pdf', 'mp3', 'mp4', 'woff', 'woff2', 'ttf'].includes(ext)) {
          continue;
        }

        // Fetch file content
        try {
          const { data: blobData } = await octokit.git.getBlob({
            owner,
            repo: repoName,
            file_sha: item.sha || ''
          });
          const content = Buffer.from(blobData.content, 'base64').toString('utf8');
          const language = this.detectLanguageFromPath(filePath);
          filesToProcess.push({ filePath, content, language });
        } catch (blobErr) {
          console.warn(`Failed to fetch GitHub blob content for ${filePath}:`, blobErr);
        }
      }
    } else if (source === 'session') {
      // sourceData: { sessionId: string }
      sessionId = sourceData.sessionId;
      if (!sessionId) throw new Error('Missing sessionId parameter');

      const { data: sessionFiles } = await supabase
        .from('code_files')
        .select('*')
        .eq('session_id', sessionId);

      if (sessionFiles) {
        filesToProcess = sessionFiles.map(f => ({
          filePath: f.file_path,
          content: f.content,
          language: f.language
        }));
      }
    }

    let indexedFiles = 0;
    let indexedSymbols = 0;

    for (const file of filesToProcess) {
      try {
        const contentHash = Buffer.from(file.content).toString('base64').substring(0, 32); // simple hash identifier
        const tokenCount = Math.ceil(file.content.length / 4);

        // Generate embedding for codebase file
        const fileEmbedding = await embeddingService.embedText(file.content);

        // Save file record
        const { data: fileRecord, error: fileErr } = await supabase
          .from('codebase_files')
          .insert({
            project_id: projectId,
            session_id: sessionId || null,
            file_path: file.filePath,
            language: file.language,
            content: file.content,
            content_hash: contentHash,
            embedding: fileEmbedding,
            token_count: tokenCount,
            last_indexed: new Date().toISOString()
          })
          .select()
          .single();

        if (fileErr || !fileRecord) {
          throw new Error(`Failed to save codebase file: ${fileErr?.message}`);
        }

        indexedFiles++;

        // Extract and process symbols
        const symbols = await this.extractSymbols(file.filePath, file.content, file.language);
        for (const symbol of symbols) {
          try {
            const symbolText = `${symbol.signature} - ${symbol.description || ''}`;
            const symbolEmbedding = await embeddingService.embedText(symbolText);

            await supabase
              .from('codebase_symbols')
              .insert({
                file_id: fileRecord.id,
                symbol_type: symbol.type,
                name: symbol.name,
                signature: symbol.signature,
                description: symbol.description || null,
                line_start: symbol.line_start,
                line_end: symbol.line_end,
                embedding: symbolEmbedding
              });

            indexedSymbols++;
          } catch (symErr) {
            console.warn(`Failed to index symbol ${symbol.name} in file ${file.filePath}:`, symErr);
          }
        }

        // Stream event updates
        emit(projectId, StreamEventType.TOOL_RESULT, `Indexed ${indexedFiles}/${filesToProcess.length} files...`, {
          status: 'running',
          data: { filesIndexed: indexedFiles, symbolsIndexed: indexedSymbols }
        });
      } catch (fileIndexErr) {
        console.error(`Error indexing file ${file.filePath}:`, fileIndexErr);
      }
    }

    emit(projectId, StreamEventType.AGENT_COMPLETE, `Indexing complete: ${indexedFiles} files, ${indexedSymbols} symbols understood`, {
      status: 'done',
      data: { fileCount: indexedFiles, symbolCount: indexedSymbols }
    });

    return { sessionId, fileCount: indexedFiles, symbolCount: indexedSymbols };
  },

  /**
   * Prompts OpenRouter DeepSeek to extract symbols from code content
   */
  async extractSymbols(filePath: string, content: string, language: string): Promise<CodebaseSymbol[]> {
    if (!content.trim() || content.length < 20) return [];

    const system = `You are a static analysis tool. Extract all major code symbols (functions, classes, interfaces, components, routes, database schemas, types, constants) from this ${language} file.
Return ONLY a valid JSON array of symbols matching this TypeScript interface:
interface CodebaseSymbol {
  type: 'function'|'class'|'interface'|'component'|'route'|'schema'|'type'|'constant';
  name: string;
  signature: string;
  description: string; // Exactly 1 sentence summarizing its purpose
  line_start: number; // 1-indexed
  line_end: number; // 1-indexed
}

Respond ONLY with the JSON code block. No comments. No markdown wrapping other than \`\`\`json.`;

    const userPrompt = `File: ${filePath}
Content:
${content}`;

    try {
      const response = await openrouterService.callModel(
        system,
        [{ role: 'user', content: userPrompt }],
        'deepseek/deepseek-chat'
      );

      const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.filter(item => 
          item &&
          typeof item.name === 'string' &&
          ['function','class','interface','component','route','schema','type','constant'].includes(item.type) &&
          typeof item.line_start === 'number'
        ) as CodebaseSymbol[];
      }
      return [];
    } catch (err) {
      console.warn(`Failed to extract symbols for ${filePath}:`, err);
      return [];
    }
  },

  /**
   * Vector search on both codebase files and codebase symbols
   */
  async searchCodebase(projectId: string, query: string, limit: number = 10): Promise<any[]> {
    try {
      const queryEmbedding = await embeddingService.embedText(query);
      const supabase = supabaseService.getServiceClient();

      // Parallel searches
      const [filesRes, symbolsRes] = await Promise.all([
        supabase.rpc('match_codebase_files', {
          query_embedding: queryEmbedding,
          match_project_id: projectId,
          match_threshold: 0.3,
          match_count: limit
        }),
        supabase.rpc('match_codebase_symbols', {
          query_embedding: queryEmbedding,
          match_project_id: projectId,
          match_threshold: 0.3,
          match_count: limit
        })
      ]);

      if (filesRes.error) throw filesRes.error;
      if (symbolsRes.error) throw symbolsRes.error;

      const fileResults = filesRes.data || [];
      const symbolResults = symbolsRes.data || [];

      // Combine and deduplicate by file path
      const mergedResultsMap = new Map<string, any>();

      // Load files first
      for (const f of fileResults) {
        mergedResultsMap.set(f.file_path, {
          filePath: f.file_path,
          language: f.language,
          content: f.content,
          score: f.similarity,
          symbols: []
        });
      }

      // Merge symbol matches
      for (const s of symbolResults) {
        const existing = mergedResultsMap.get(s.file_path);
        if (existing) {
          existing.symbols.push({
            name: s.name,
            type: s.symbol_type,
            signature: s.signature,
            description: s.description,
            lines: `${s.line_start}-${s.line_end}`
          });
          // Update score if symbol has higher match
          if (s.similarity > existing.score) {
            existing.score = s.similarity;
          }
        } else {
          // If file content not loaded yet, fetch file content
          const { data: fileData } = await supabase
            .from('codebase_files')
            .select('content, language')
            .eq('project_id', projectId)
            .eq('file_path', s.file_path)
            .maybeSingle();

          mergedResultsMap.set(s.file_path, {
            filePath: s.file_path,
            language: fileData?.language || 'typescript',
            content: fileData?.content || '',
            score: s.similarity,
            symbols: [{
              name: s.name,
              type: s.symbol_type,
              signature: s.signature,
              description: s.description,
              lines: `${s.line_start}-${s.line_end}`
            }]
          });
        }
      }

      return Array.from(mergedResultsMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (err) {
      console.error(`Codebase search failed:`, err);
      return [];
    }
  },

  /**
   * Build formatted codebase context block for prompt injection
   */
  async buildCodeContext(projectId: string, taskDescription: string, maxTokens: number = 4000): Promise<string> {
    const supabase = supabaseService.getServiceClient();

    // 1. Fetch file list to construct project file tree representation
    const { data: files } = await supabase
      .from('codebase_files')
      .select('file_path')
      .eq('project_id', projectId);

    const fileTree = (files || []).map(f => f.file_path).join('\n');

    // 2. Fetch specific static configuration/essential files if they exist
    const essentialPaths = [
      'package.json',
      'tsconfig.json',
      'next.config.js',
      'next.config.ts',
      'schema.sql',
      'supabase_schema.sql',
      'prisma/schema.prisma',
      'middleware.ts',
      'middleware.js'
    ];

    const contextFiles: Array<{ path: string; content: string }> = [];
    let currentTokenCount = 0;

    for (const path of essentialPaths) {
      const { data } = await supabase
        .from('codebase_files')
        .select('file_path, content, token_count')
        .eq('project_id', projectId)
        .eq('file_path', path)
        .maybeSingle();

      if (data && data.content) {
        contextFiles.push({ path: data.file_path, content: data.content });
        currentTokenCount += data.token_count || Math.ceil(data.content.length / 4);
      }
    }

    // 3. Perform semantic codebase search
    const searchMatches = await this.searchCodebase(projectId, taskDescription, 10);
    const semanticSymbols: string[] = [];

    for (const match of searchMatches) {
      // Avoid duplicate inclusion of essential files already loaded
      if (essentialPaths.includes(match.filePath)) continue;

      const fileTokens = Math.ceil(match.content.length / 4);
      if (currentTokenCount + fileTokens < maxTokens * 0.7) {
        contextFiles.push({ path: match.filePath, content: match.content });
        currentTokenCount += fileTokens;
      }

      // Add symbol signatures
      if (match.symbols && match.symbols.length > 0) {
        for (const sym of match.symbols) {
          semanticSymbols.push(`- [${sym.type}] ${sym.signature} (${sym.description || ''}) in ${match.filePath}`);
        }
      }
    }

    // 4. Formatting output
    const filesContentBlock = contextFiles
      .map(f => `// ${f.path}\n${f.content.substring(0, 1500)}`)
      .join('\n\n');

    const symbolsContentBlock = semanticSymbols.join('\n');

    return `CODEBASE CONTEXT:

Project structure:
${fileTree || 'Empty project'}

Relevant files:
${filesContentBlock || 'No matching source files.'}

Relevant symbols:
${symbolsContentBlock || 'No matching symbols.'}`;
  }
};

export default codebaseIntelligenceService;
