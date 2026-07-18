import supabaseService from './supabase.service';
import openrouterService from './openrouter.service';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';
import { Sandbox } from '@e2b/sdk';
import codebaseIntelligenceService from './codebase-intelligence.service';

export const codeExecutorService = {
  /**
   * Helper: Get E2B template based on language and framework
   */
  getTemplate(language: string, framework?: string | null): string {
    const lang = language.toLowerCase();
    const fw = framework?.toLowerCase() || '';

    if (fw.includes('next') || fw.includes('react')) {
      return 'nextjs';
    }
    if (lang === 'node' || lang === 'javascript' || lang === 'typescript') {
      return 'node';
    }
    if (lang === 'python') {
      return 'python';
    }
    return 'base';
  },

  /**
   * Instantiates an E2B sandbox
   */
  async createSandbox(language: string, framework?: string | null): Promise<Sandbox> {
    const apiKey = process.env.E2B_API_KEY;
    if (!apiKey) {
      console.warn('E2B_API_KEY is not defined. Sandboxing will run in simulated mode.');
    }

    const template = this.getTemplate(language, framework);
    
    // Create E2B sandbox instance
    const sandbox = await Sandbox.create({
      template,
      apiKey: apiKey || 'mock_key',
      timeout: 60000
    });

    return sandbox;
  },

  /**
   * Installs project dependencies inside the sandbox
   */
  async installDependencies(sandbox: Sandbox, packageJsonContent: string): Promise<{ success: boolean; output: string }> {
    try {
      // Write package.json to the sandbox root
      await sandbox.filesystem.write('package.json', packageJsonContent);

      // Trigger dependency install
      const proc = await sandbox.process.start({
        cmd: 'npm install'
      });

      const output = await proc.wait();
      
      return {
        success: output.exitCode === 0,
        output: output.stdout + '\n' + output.stderr
      };
    } catch (err: any) {
      console.error('Failed to install dependencies in E2B sandbox:', err);
      return { success: false, output: err.message };
    }
  },

  /**
   * Executes code/commands inside the sandbox
   */
  async executeCode(
    sandbox: Sandbox,
    files: Array<{ filePath: string; content: string }>,
    entrypoint: string,
    testCommand?: string
  ): Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number }> {
    try {
      // Write all files to the sandbox filesystem
      for (const file of files) {
        // Ensure parent directories exist (E2B write automatically handles directory nesting)
        await sandbox.filesystem.write(file.filePath, file.content);
      }

      // Determine run command
      const cmd = testCommand || `node ${entrypoint}`;

      // Start execution process
      const proc = await sandbox.process.start({
        cmd
      });

      const output = await proc.wait();

      return {
        success: output.exitCode === 0,
        stdout: output.stdout,
        stderr: output.stderr,
        exitCode: output.exitCode || 0
      };
    } catch (err: any) {
      console.error('Code execution failed in E2B sandbox:', err);
      return {
        success: false,
        stdout: '',
        stderr: err.message,
        exitCode: -1
      };
    }
  },

  /**
   * Closes / terminates sandbox
   */
  async closeSandbox(sandbox: Sandbox): Promise<void> {
    try {
      await sandbox.close();
    } catch (err) {
      console.error('Failed to close E2B sandbox:', err);
    }
  },

  /**
   * Runs the code in E2B sandbox and executes auto-repair loop up to 3 rounds
   */
  async selfHealingBuild(sessionId: string, projectId: string, maxAttempts: number = 3): Promise<any> {
    const supabase = supabaseService.getServiceClient();
    
    emit(projectId, StreamEventType.TOOL_CALLING, 'Running code in sandbox...', { status: 'running' });

    // Fetch session details
    const { data: session } = await supabase
      .from('coding_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) {
      throw new Error(`Coding session ${sessionId} not found`);
    }

    // Save sandbox ID on the session
    const sandbox = await this.createSandbox(session.language, session.framework);
    await supabase
      .from('coding_sessions')
      .update({ sandbox_id: sandbox.id })
      .eq('id', sessionId);

    let round = 1;
    let success = false;
    let finalOutput = '';
    let finalError = '';

    while (round <= maxAttempts) {
      // 1. Fetch current code files
      const { data: codeFiles } = await supabase
        .from('code_files')
        .select('*')
        .eq('session_id', sessionId);

      if (!codeFiles || codeFiles.length === 0) {
        throw new Error('No files found in this session to run.');
      }

      const files = codeFiles.map(f => ({ filePath: f.file_path, content: f.content }));

      // 2. Identify package.json / requirements
      const pkgFile = files.find(f => f.filePath === 'package.json');
      if (pkgFile && round === 1) {
        emit(projectId, StreamEventType.TOOL_CALLING, 'Installing dependencies...', { status: 'running' });
        await this.installDependencies(sandbox, pkgFile.content);
      }

      // 3. Detect entrypoint file (like index.js, app.js, main.py, or config test commands)
      let entrypoint = 'index.js';
      const jsFiles = files.filter(f => f.filePath.endsWith('.js') || f.filePath.endsWith('.ts'));
      if (jsFiles.some(f => f.filePath === 'index.ts' || f.filePath === 'index.js')) {
        entrypoint = jsFiles.find(f => f.filePath === 'index.ts' || f.filePath === 'index.js')?.filePath || entrypoint;
      } else if (jsFiles.length > 0) {
        entrypoint = jsFiles[0].filePath;
      } else if (files.some(f => f.filePath.endsWith('.py'))) {
        entrypoint = files.find(f => f.filePath.endsWith('.py'))?.filePath || 'main.py';
      }

      // Run tests or run entrypoint
      const testFile = files.find(f => f.filePath.includes('.test.') || f.filePath.includes('test_'));
      let testCommand: string | undefined;
      if (testFile) {
        testCommand = testFile.filePath.endsWith('.py') ? 'pytest' : 'npm test';
      }

      emit(projectId, StreamEventType.TOOL_CALLING, `Executing code (Round ${round})...`, { status: 'running' });

      const execResult = await this.executeCode(sandbox, files, entrypoint, testCommand);

      finalOutput = execResult.stdout;
      finalError = execResult.stderr;

      // Update session execution output
      await supabase
        .from('coding_sessions')
        .update({
          execution_output: `STDOUT:\n${execResult.stdout}\n\nSTDERR:\n${execResult.stderr}`,
          fix_rounds: round
        })
        .eq('id', sessionId);

      if (execResult.success) {
        success = true;
        await supabase
          .from('coding_sessions')
          .update({ all_tests_passing: true })
          .eq('id', sessionId);

        emit(projectId, StreamEventType.TOOL_RESULT, 'Sandbox execution successful! ✓ All tests passing.', {
          status: 'done',
          data: { stdout: execResult.stdout }
        });
        break;
      } else {
        // Run self healing round
        emit(projectId, StreamEventType.TOOL_FAILED, `Tests failed — agent fixing (round ${round})`, {
          status: 'running',
          data: { stderr: execResult.stderr }
        });

        if (round < maxAttempts) {
          await this.fixErrors(sessionId, execResult.stderr, execResult.stdout, round);
        }
        round++;
      }
    }

    // Close E2B sandbox
    await this.closeSandbox(sandbox);

    if (!success) {
      await supabase
        .from('coding_sessions')
        .update({ status: 'failed' }) // or needs review flag
        .eq('id', sessionId);

      emit(projectId, StreamEventType.STREAM_ERROR, 'Sandbox execution failed after 3 rounds. Needs human review.', {
        status: 'error',
        data: { stderr: finalError }
      });
    }

    return { success, output: finalOutput, error: finalError, rounds: round - 1 };
  },

  /**
   * Self-healing LLM prompt parsing and updates
   */
  async fixErrors(sessionId: string, stderr: string, stdout: string, round: number): Promise<void> {
    const supabase = supabaseService.getServiceClient();

    // 1. Fetch current session files
    const { data: codeFiles } = await supabase
      .from('code_files')
      .select('*')
      .eq('session_id', sessionId);

    if (!codeFiles || codeFiles.length === 0) return;

    const allFilesBlock = codeFiles
      .map(f => `// File Path: ${f.file_path}\n${f.content}`)
      .join('\n\n');

    const system = `You are an expert debugger repairing compiler errors and test failures. 
Identify the root cause of the error, determine which file(s) require modifications, and apply the exact fix.

Return ONLY the corrected file contents using this precise format. DO NOT explain anything. DO NOT return pseudocode.

<file path='path/to/file'>
corrected content
</file>`;

    const userPrompt = `You are debugging your own code.

Error output (stderr):
${stderr}

Standard output (stdout):
${stdout}

Current files in the project:
${allFilesBlock}

Round ${round} of fixing. Identify the root cause and output corrected complete files now.`;

    const response = await openrouterService.callModel(
      system,
      [{ role: 'user', content: userPrompt }],
      'deepseek/deepseek-chat'
    );

    // Parse files from tags
    const fileRegex = /<file\s+path=['"]([^'"]+)['"]>([\s\S]*?)<\/file>/gi;
    let match;

    while ((match = fileRegex.exec(response)) !== null) {
      const filePath = match[1];
      const newContent = match[2].trim();

      // Find file record in Supabase to update it
      const dbFile = codeFiles.find(f => f.file_path === filePath);
      if (dbFile) {
        const nextVersion = (dbFile.version || 1) + 1;
        await supabase
          .from('code_files')
          .update({
            content: newContent,
            version: nextVersion,
            updated_at: new Date().toISOString()
          })
          .eq('id', dbFile.id);
      } else {
        // If file doesn't exist, create it
        await supabase
          .from('code_files')
          .insert({
            session_id: sessionId,
            file_path: filePath,
            language: codebaseIntelligenceService.detectLanguageFromPath(filePath),
            content: newContent,
            version: 1
          });
      }
    }
  }
};

export default codeExecutorService;
