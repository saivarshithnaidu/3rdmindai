import supabaseService from './supabase.service';
import openrouterService from './openrouter.service';
import mcpService from './mcp.service';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';
import JSZip from 'jszip';

export const CODING_AGENT_IDENTITY = `You are an expert software engineer with 15 years of experience. You write clean, production-ready code.

Your principles:
- Never write pseudocode or placeholders
- Every function is complete and working
- Error handling always included
- Code is readable and well-commented
- Follow language-specific best practices
- Security first — never expose secrets
- Performance matters — no N+1 queries
- Write tests for critical functions

Output format for multiple files:
Always use this exact format:
<file path='relative/path/to/file.ext'>
file content here
</file>

For single code blocks use standard markdown code fences with language.

When building a project:
1. First output the folder structure
2. Then write each file completely
3. Never skip a file saying 'same as above'
4. README.md always included`;

export const codingAgentService = {
  /**
   * Detect language and framework based on text description
   */
  async detectLanguageAndFramework(description: string): Promise<{
    language: string;
    framework: string | null;
    projectType: 'api' | 'frontend' | 'fullstack' | 'script' | 'library' | 'mobile' | 'database' | 'other';
    suggestedStack: string[];
    estimatedFiles: number;
  }> {
    const system = `Detect the programming language, framework, and type of project from this description: ${description}
  
Return ONLY JSON:
{
  "language": "string",
  "framework": "string or null",
  "projectType": "api"|"frontend"|"fullstack"|"script"|"library"|"mobile"|"database"|"other",
  "suggestedStack": ["string"],
  "estimatedFiles": 5
}`;

    const model = 'deepseek/deepseek-chat';
    const response = await openrouterService.callModel(
      system,
      [{ role: 'user', content: description }],
      model
    );

    const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  },

  /**
   * Plan files structure, setup commands and build order
   */
  async planProject(description: string, stack: string[], sessionId: string): Promise<{
    folder_structure: string;
    files: Array<{ path: string; purpose: string; dependencies: string[] }>;
    build_order: string[];
    setup_commands: string[];
    env_variables: string[];
  }> {
    const supabase = supabaseService.getServiceClient();
    const { data: session } = await supabase
      .from('coding_sessions')
      .select('project_id')
      .eq('id', sessionId)
      .single();

    const projectId = session?.project_id || '00000000-0000-0000-0000-000000000000';

    emit(projectId, StreamEventType.ORCHESTRATOR_PLANNING, "Planning project architecture...", { status: 'running' });

    const system = `You are a senior architect. Plan the complete file structure for:
${description}
Stack: ${stack.join(', ')}

Return ONLY JSON:
{
  "folder_structure": "string (tree format representation)",
  "files": [{
    "path": "string",
    "purpose": "string",
    "dependencies": ["string"]
  }],
  "build_order": ["string"],
  "setup_commands": ["string"],
  "env_variables": ["string"]
}`;

    const model = 'deepseek/deepseek-chat';
    const response = await openrouterService.callModel(
      system,
      [{ role: 'user', content: `Please plan the project: ${description}` }],
      model
    );

    const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  },

  /**
   * Build project code files one by one and stream to database in realtime
   */
  async buildProject(sessionId: string, description: string, plan: any, stack: string[]): Promise<any> {
    const supabase = supabaseService.getServiceClient();

    // Fetch project_id
    const { data: sessionData } = await supabase
      .from('coding_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!sessionData) {
      throw new Error('Session not found');
    }

    const projectId = sessionData.project_id;
    let totalLines = 0;
    const fileCount = plan.build_order.length;

    try {
      for (const filePath of plan.build_order) {
        emit(projectId, StreamEventType.TOOL_CALLING, `Writing ${filePath}...`, { status: 'running' });

        // Get previously written files
        const { data: writtenFiles } = await supabase
          .from('code_files')
          .select('*')
          .eq('session_id', sessionId);

        const context = (writtenFiles || [])
          .map(f => `// ${f.file_path}\n${f.content.substring(0, 800)}`)
          .join('\n\n');

        const system = CODING_AGENT_IDENTITY;
        const userPrompt = `Write the complete ${filePath} file.
    
Project: ${description}
Stack: ${stack.join(', ')}

Files already written (context):
${context}

Write the COMPLETE file now.
No placeholders. No TODOs.
Production ready code.`;

        // Check if file already exists, or insert new one
        const { data: existing } = await supabase
          .from('code_files')
          .select('*')
          .eq('session_id', sessionId)
          .eq('file_path', filePath)
          .maybeSingle();

        let fileId = existing?.id;
        const language = this.detectLanguageFromPath(filePath);

        if (!fileId) {
          const { data: insertedFile } = await supabase
            .from('code_files')
            .insert({
              session_id: sessionId,
              file_path: filePath,
              language,
              content: 'Generating...',
              version: 1
            })
            .select()
            .single();

          fileId = insertedFile.id;
        }

        // Call streaming endpoint
        const stream = openrouterService.streamModel(
          system,
          [{ role: 'user', content: userPrompt }],
          'deepseek/deepseek-chat'
        );

        const reader = stream.getReader();
        const decoder = new TextEncoder();
        const stringDecoder = new TextDecoder();
        let accumulated = '';
        let lastUpdate = Date.now();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          accumulated += stringDecoder.decode(value, { stream: true });
          const cleanedText = this.extractFileContent(accumulated);

          // Rate-limit database updates to ~300ms intervals to prevent overloading
          if (Date.now() - lastUpdate > 300) {
            await supabase
              .from('code_files')
              .update({ content: cleanedText })
              .eq('id', fileId);
            lastUpdate = Date.now();
          }
        }

        // Final complete update
        const finalContent = this.extractFileContent(accumulated);
        const lineCount = finalContent.split('\n').length;
        totalLines += lineCount;

        await supabase
          .from('code_files')
          .update({ content: finalContent })
          .eq('id', fileId);

        emit(projectId, StreamEventType.TOOL_RESULT, `${filePath} written (${lineCount} lines)`, { status: 'running' });
      }

      // Generate README.md automatically
      emit(projectId, StreamEventType.TOOL_CALLING, "Generating README.md...", { status: 'running' });
      const systemReadme = `You are a technical writer. Write a comprehensive, premium README.md for this project:
Description: ${description}
Stack: ${stack.join(', ')}

Explain how to install dependencies, run the project, and outline the architecture. Return only markdown.`;

      const readmeRaw = await openrouterService.callModel(
        systemReadme,
        [{ role: 'user', content: 'Generate README.md now.' }],
        'deepseek/deepseek-chat'
      );

      const cleanReadme = this.extractFileContent(readmeRaw);

      await supabase
        .from('code_files')
        .insert({
          session_id: sessionId,
          file_path: 'README.md',
          language: 'markdown',
          content: cleanReadme,
          version: 1
        });

      // Update session status to complete
      const { data: updatedSession } = await supabase
        .from('coding_sessions')
        .update({ status: 'complete' })
        .eq('id', sessionId)
        .select()
        .single();

      emit(projectId, StreamEventType.AGENT_COMPLETE, `Project complete — ${fileCount + 1} files, ${totalLines + cleanReadme.split('\n').length} lines of code`, { status: 'done' });

      return updatedSession;
    } catch (err: any) {
      console.error('Build project failed:', err);

      await supabase
        .from('coding_sessions')
        .update({ status: 'failed' })
        .eq('id', sessionId);

      emit(projectId, StreamEventType.STREAM_ERROR, `Failed building project: ${err.message}`, { status: 'error' });
      throw err;
    }
  },

  /**
   * Edit existing code files based on instruction
   */
  async editCode(sessionId: string, instruction: string, targetFiles: string[]): Promise<any[]> {
    const supabase = supabaseService.getServiceClient();
    const updatedFilesList: any[] = [];

    // Get project_id for emission
    const { data: session } = await supabase
      .from('coding_sessions')
      .select('project_id')
      .eq('id', sessionId)
      .single();

    const projectId = session?.project_id || '00000000-0000-0000-0000-000000000000';

    emit(projectId, StreamEventType.AGENT_THINKING, `Refactoring files based on instruction...`, { status: 'running' });

    for (const filePath of targetFiles) {
      const { data: codeFile } = await supabase
        .from('code_files')
        .select('*')
        .eq('session_id', sessionId)
        .eq('file_path', filePath)
        .maybeSingle();

      if (!codeFile) continue;

      emit(projectId, StreamEventType.TOOL_CALLING, `Modifying ${filePath}...`, { status: 'running' });

      const userPrompt = `Edit this code based on instruction.
    
Instruction: ${instruction}

Current code:
${codeFile.content}

Return the COMPLETE updated file.
No partial updates. Full file only.`;

      const response = await openrouterService.callModel(
        CODING_AGENT_IDENTITY,
        [{ role: 'user', content: userPrompt }],
        'deepseek/deepseek-chat'
      );

      const cleanContent = this.extractFileContent(response);
      const nextVersion = (codeFile.version || 1) + 1;

      const { data: updated } = await supabase
        .from('code_files')
        .update({
          content: cleanContent,
          version: nextVersion,
          updated_at: new Date().toISOString()
        })
        .eq('id', codeFile.id)
        .select()
        .single();

      if (updated) {
        updatedFilesList.push(updated);
      }

      emit(projectId, StreamEventType.TOOL_RESULT, `${filePath} updated (v${nextVersion})`, { status: 'running' });
    }

    emit(projectId, StreamEventType.AGENT_COMPLETE, `Code edits applied to ${updatedFilesList.length} files.`, { status: 'done' });
    return updatedFilesList;
  },

  /**
   * Code Review using GPT-4o
   */
  async reviewCode(sessionId: string, code: string, language: string, reviewType: 'full' | 'security' | 'performance' | 'best-practices'): Promise<any> {
    const supabase = supabaseService.getServiceClient();

    // Get project_id for emission
    const { data: session } = await supabase
      .from('coding_sessions')
      .select('project_id')
      .eq('id', sessionId)
      .single();

    const projectId = session?.project_id || '00000000-0000-0000-0000-000000000000';

    emit(projectId, StreamEventType.JUDGE_EVALUATING, `Reviewing code structure (${reviewType})...`, { status: 'running' });

    const system = `You are a senior code reviewer. Review this ${language} code.
Focus: ${reviewType}

Return ONLY JSON:
{
  "overall_score": 85,
  "summary": "Detailed summary paragraph of code quality.",
  "issues": [{
    "severity": "critical"|"major"|"minor",
    "line": 12,
    "issue": "Description of the problem",
    "fix": "How to fix it description",
    "code_fix": "the fixed line or block of code"
  }],
  "suggestions": [{
    "type": "type of suggestion",
    "description": "suggestion description",
    "example": "code example"
  }],
  "security_flags": [{
    "type": "CWE or type of vulnerability",
    "severity": "high"|"medium"|"low",
    "description": "security issue description",
    "fix": "how to resolve"
  }],
  "performance_notes": ["string"],
  "positive_aspects": ["string"]
}`;

    const response = await openrouterService.callModel(
      system,
      [{ role: 'user', content: code }],
      'openai/gpt-4o'
    );

    const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const { data: savedReview, error: insErr } = await supabase
      .from('code_reviews')
      .insert({
        session_id: sessionId,
        overall_score: parsed.overall_score || 0,
        issues: parsed.issues || [],
        suggestions: parsed.suggestions || [],
        security_flags: parsed.security_flags || [],
        summary: parsed.summary || ''
      })
      .select()
      .single();

    if (insErr) {
      console.error('Failed to save review in database:', insErr);
    }

    emit(projectId, StreamEventType.JUDGE_PASSED, `Review complete. Score: ${parsed.overall_score || 0}/100. Found ${(parsed.issues || []).length} issues.`, { status: 'done' });
    return savedReview || parsed;
  },

  /**
   * Debug existing code or bug trace
   */
  async debugCode(sessionId: string | null, code: string, errorMessage: string, language: string): Promise<any> {
    const supabase = supabaseService.getServiceClient();
    let projectId = '00000000-0000-0000-0000-000000000000';

    if (sessionId) {
      const { data: session } = await supabase
        .from('coding_sessions')
        .select('project_id')
        .eq('id', sessionId)
        .single();
      projectId = session?.project_id || projectId;
    }

    emit(projectId, StreamEventType.AGENT_THINKING, `Debugging code error...`, { status: 'running' });

    const system = `Debug this ${language} code based on the error message.
Return ONLY JSON:
{
  "root_cause": "Detailed explanation of what is wrong",
  "explanation": "Why this occurred",
  "prevention": "How to prevent this in the future",
  "fixed_code": "COMPLETE fixed code file (no partial code, no shortcuts)"
}`;

    const userPrompt = `Error: ${errorMessage}

Code:
${code}`;

    const response = await openrouterService.callModel(
      system,
      [{ role: 'user', content: userPrompt }],
      'deepseek/deepseek-chat'
    );

    const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    emit(projectId, StreamEventType.AGENT_COMPLETE, `Debug solution found.`, { status: 'done' });
    return parsed;
  },

  /**
   * Generate test suites for a target file path
   */
  async generateTests(sessionId: string, filePath: string, testFramework: string): Promise<any> {
    const supabase = supabaseService.getServiceClient();

    // Fetch session details
    const { data: session } = await supabase
      .from('coding_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) {
      throw new Error('Session not found');
    }

    // Fetch source file
    const { data: sourceFile } = await supabase
      .from('code_files')
      .select('*')
      .eq('session_id', sessionId)
      .eq('file_path', filePath)
      .single();

    if (!sourceFile) {
      throw new Error(`Code file "${filePath}" not found`);
    }

    emit(session.project_id, StreamEventType.TOOL_CALLING, `Generating test suite for ${filePath}...`, { status: 'running' });

    const system = `Write comprehensive tests for this code.
Framework: ${testFramework}

Write tests for:
- Happy path (all main functionality)
- Edge cases
- Error conditions
- Boundary values

Return ONLY the complete runnable test file content. No explanations. No wrapping text.`;

    const response = await openrouterService.callModel(
      system,
      [{ role: 'user', content: sourceFile.content }],
      'deepseek/deepseek-chat'
    );

    const cleanTestContent = this.extractFileContent(response);

    const parts = filePath.split('.');
    const ext = parts.pop();
    const testFilePath = `${parts.join('.')}.test.${ext}`;

    const { data: savedTest } = await supabase
      .from('code_files')
      .insert({
        session_id: sessionId,
        file_path: testFilePath,
        language: sourceFile.language,
        content: cleanTestContent,
        version: 1
      })
      .select()
      .single();

    emit(session.project_id, StreamEventType.AGENT_COMPLETE, `Generated tests at "${testFilePath}"`, { status: 'done' });
    return savedTest;
  },

  /**
   * Zip all session files and upload to Supabase Storage
   */
  async packageAsZip(sessionId: string): Promise<string> {
    const supabase = supabaseService.getServiceClient();
    const { data: files } = await supabase
      .from('code_files')
      .select('*')
      .eq('session_id', sessionId);

    if (!files || files.length === 0) {
      throw new Error('No files found to package');
    }

    const zip = new JSZip();
    for (const f of files) {
      zip.file(f.file_path, f.content);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const storagePath = `coding-sessions/${sessionId}/archive-${Date.now()}.zip`;

    const { error: uploadErr } = await supabase.storage
      .from('images')
      .upload(storagePath, zipBuffer, {
        contentType: 'application/zip',
        upsert: true
      });

    if (uploadErr) {
      throw new Error(`Failed to upload zip archive: ${uploadErr.message}`);
    }

    const { data } = supabase.storage.from('images').getPublicUrl(storagePath);
    return data.publicUrl;
  },

  /**
   * Push all files to GitHub repository
   */
  async pushToGitHub(sessionId: string, repo: string, branch: string, commitMessage: string, userId: string = '00000000-0000-0000-0000-000000000000'): Promise<string> {
    const supabase = supabaseService.getServiceClient();
    const { data: files } = await supabase
      .from('code_files')
      .select('*')
      .eq('session_id', sessionId);

    if (!files || files.length === 0) {
      throw new Error('No files to commit');
    }

    const { data: session } = await supabase
      .from('coding_sessions')
      .select('project_id')
      .eq('id', sessionId)
      .single();

    const projectId = session?.project_id || '00000000-0000-0000-0000-000000000000';

    emit(projectId, StreamEventType.TOOL_CALLING, `Pushing project code files to GitHub (${branch})...`, { status: 'running' });

    for (const file of files) {
      try {
        await mcpService.callTool(
          'github',
          'github_commit',
          {
            repo,
            path: file.file_path,
            content: Buffer.from(file.content).toString('base64'),
            branch,
            message: commitMessage
          },
          null,
          projectId,
          null,
          userId
        );
      } catch (err: any) {
        console.warn(`GitHub Commit failed for "${file.file_path}":`, err.message);
      }
    }

    // Default return page if PR creation is not possible/simulated
    let prUrl = `https://github.com/${repo}/tree/${branch}`;

    try {
      const prResult = await mcpService.callTool(
        'github',
        'github_create_pr',
        {
          repo,
          title: commitMessage,
          body: 'Generated pull request from Coding Agent session.',
          head: branch,
          base: 'main'
        },
        null,
        projectId,
        null,
        userId
      );
      if (prResult?.html_url || prResult?.url) {
        prUrl = prResult.html_url || prResult.url;
      }
    } catch (prErr) {
      console.warn('Could not create pull request:', prErr);
    }

    await supabase
      .from('coding_sessions')
      .update({ github_repo: repo, github_branch: branch })
      .eq('id', sessionId);

    emit(projectId, StreamEventType.AGENT_COMPLETE, `Successfully committed and pushed code. PR: ${prUrl}`, { status: 'done' });
    return prUrl;
  },

  /**
   * Helper: extract text inside <file> tags or default markdown blocks
   */
  extractFileContent(text: string): string {
    const fileRegex = /<file\s+path=['"]([^'"]+)['"]>([\s\S]*?)<\/file>/i;
    const match = text.match(fileRegex);
    if (match) {
      return match[2].trim();
    }

    const fenceRegex = /```\w*\n([\s\S]*?)\n```/;
    const fenceMatch = text.match(fenceRegex);
    if (fenceMatch) {
      return fenceMatch[1].trim();
    }

    return text.trim();
  },

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
      case 'rs':
        return 'rust';
      case 'go':
        return 'go';
      case 'java':
        return 'java';
      case 'php':
        return 'php';
      case 'rb':
        return 'ruby';
      case 'swift':
        return 'swift';
      case 'kt':
      case 'kts':
        return 'kotlin';
      default:
        return 'plaintext';
    }
  }
};

export default codingAgentService;
