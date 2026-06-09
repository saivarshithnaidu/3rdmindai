import { NextRequest, NextResponse } from 'next/server';
import supabaseService from '../../../../../services/supabase.service';
import { decrypt } from '../../../../../lib/crypto';
import { Octokit } from '@octokit/rest';
import codingAgentService from '../../../../../services/coding-agent.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repoUrl, branch = 'main', projectId, userId = '00000000-0000-0000-0000-000000000000' } = body;

    if (!repoUrl || !projectId) {
      return NextResponse.json({ error: 'Missing required parameters: repoUrl, projectId' }, { status: 400 });
    }

    const supabase = supabaseService.getServiceClient();

    // 1. Get Github access token from connector
    const { data: connector } = await supabase
      .from('connectors')
      .select('*')
      .eq('user_id', userId)
      .eq('slug', 'github')
      .maybeSingle();

    if (!connector || !connector.access_token) {
      return NextResponse.json({ error: 'GitHub connector is not connected. Please connect GitHub first.' }, { status: 400 });
    }

    const decryptedToken = decrypt(connector.access_token);
    if (!decryptedToken) {
      return NextResponse.json({ error: 'Failed to decrypt GitHub access token' }, { status: 500 });
    }

    // 2. Parse owner and repo
    let cleanedUrl = repoUrl.replace('https://github.com/', '').replace('.git', '');
    const parts = cleanedUrl.split('/');
    if (parts.length < 2) {
      return NextResponse.json({ error: 'Invalid GitHub repository URL format' }, { status: 400 });
    }
    const owner = parts[0];
    const repo = parts[1];

    const octokit = new Octokit({ auth: decryptedToken });

    // 3. Get repository file tree recursively
    const treeResponse = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: branch,
      recursive: '1'
    });

    const files = treeResponse.data.tree.filter((node: any) => node.type === 'blob');

    // Filter out binary, lock, and heavy dependency directory files
    const filteredFiles = files.filter((file: any) => {
      const path = file.path;
      if (
        path.includes('node_modules/') ||
        path.includes('.git/') ||
        path.includes('.next/') ||
        path.includes('dist/') ||
        path.includes('build/') ||
        path.includes('package-lock.json') ||
        path.includes('yarn.lock') ||
        path.includes('pnpm-lock.yaml')
      ) {
        return false;
      }
      const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.mp3', '.mp4', '.woff', '.woff2', '.ttf', '.eot'];
      if (binaryExtensions.some(ext => path.toLowerCase().endsWith(ext))) {
        return false;
      }
      return true;
    });

    // 4. Create new coding session
    const { data: session, error: sessErr } = await supabase
      .from('coding_sessions')
      .insert({
        project_id: projectId,
        user_id: userId,
        mode: 'edit',
        language: 'javascript', // Default to javascript, will adapt per file
        description: `Imported repository ${owner}/${repo} (${branch})`,
        status: 'complete',
        github_repo: `${owner}/${repo}`,
        github_branch: branch
      })
      .select()
      .single();

    if (sessErr || !session) {
      throw new Error(`Failed to create import session: ${sessErr?.message}`);
    }

    // 5. Download and save files up to a reasonable limit (e.g. 50 files to avoid rate limits)
    const filesToPull = filteredFiles.slice(0, 50);

    for (const file of filesToPull) {
      try {
        const contentRes = await octokit.rest.repos.getContent({
          owner,
          repo,
          path: file.path,
          ref: branch
        });

        if (contentRes.data && 'content' in contentRes.data) {
          const content = Buffer.from(contentRes.data.content, 'base64').toString('utf8');
          const lang = codingAgentService.detectLanguageFromPath(file.path);

          await supabase
            .from('code_files')
            .insert({
              session_id: session.id,
              file_path: file.path,
              language: lang,
              content: content,
              version: 1
            });
        }
      } catch (err: any) {
        console.warn(`Failed to pull content for file "${file.path}":`, err.message);
      }
    }

    return NextResponse.json({ success: true, sessionId: session.id });
  } catch (err: any) {
    console.error('GitHub pull API route failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
