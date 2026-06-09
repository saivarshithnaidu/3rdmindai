import supabaseService from './supabase.service';
import { emit } from '../lib/emit';
import { StreamEventType } from '../lib/stream-events';
import dns from 'dns/promises';

interface AuditFinding {
  category: 'performance' | 'seo' | 'accessibility' | 'configuration' | 'security';
  priority: 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  recommendation: string;
  docs_url?: string;
}

export const websiteHealthService = {
  async runHealthScan(scanId: string, targetUrl: string): Promise<void> {
    const supabase = supabaseService.getServiceClient();

    // 1. Fetch scan metadata
    const { data: scan, error: scanErr } = await supabase
      .from('health_scans')
      .select('*')
      .eq('id', scanId)
      .single();

    if (scanErr || !scan) {
      throw new Error(`Health scan not found: ${scanErr?.message}`);
    }

    emit(scan.project_id, StreamEventType.AGENT_STARTED, `Launching Website Health Audit on "${targetUrl}"...`, { status: 'running' });

    let domain = '';
    try {
      const parsedUrl = targetUrl.includes('://') ? targetUrl : `https://${targetUrl}`;
      domain = new URL(parsedUrl).hostname;
    } catch {
      domain = targetUrl;
    }

    const findings: AuditFinding[] = [];
    let checksPassed = 0;
    let checksFailed = 0;

    try {
      // ----------------------------------------------------
      // CHECK 1: HTTPS & SSL/TLS Configuration
      // ----------------------------------------------------
      emit(scan.project_id, StreamEventType.PRICE_CHECKING, 'Auditing HTTPS & SSL Certificate configuration...', { status: 'running' });
      try {
        const fetchRes = await fetch(`https://${domain}`, { method: 'HEAD', redirect: 'follow' });
        checksPassed++;
        
        // HSTS Check
        const hsts = fetchRes.headers.get('strict-transport-security');
        if (!hsts) {
          findings.push({
            category: 'security',
            priority: 'medium',
            title: 'HSTS Header Missing',
            description: 'HTTP Strict Transport Security (HSTS) is a header that forces browsers to interact with your site only over secure HTTPS connections.',
            recommendation: 'Configure your web server to return the "Strict-Transport-Security" header with a max-age parameter (e.g. max-age=31536000).',
            docs_url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security'
          });
          checksFailed++;
        } else {
          checksPassed++;
        }
      } catch (err: any) {
        findings.push({
          category: 'security',
          priority: 'high',
          title: 'SSL/TLS Connection Unstable',
          description: `Failed to establish a secure HEAD request to https://${domain}. SSL handshake might be misconfigured.`,
          recommendation: 'Check your SSL certificate provider (e.g. Let\'s Encrypt, Cloudflare) and verify all cert chains are valid.',
          docs_url: 'https://letsencrypt.org/docs/'
        });
        checksFailed++;
      }

      // ----------------------------------------------------
      // CHECK 2: Cache & Optimization Performance Headers
      // ----------------------------------------------------
      emit(scan.project_id, StreamEventType.BROWSER_SEARCHING, 'Inspecting HTTP optimization headers...', { status: 'running' });
      try {
        const headerRes = await fetch(`https://${domain}`, { method: 'GET' });
        const headers = headerRes.headers;

        // Cache-Control
        const cacheCtrl = headers.get('cache-control');
        if (!cacheCtrl) {
          findings.push({
            category: 'performance',
            priority: 'low',
            title: 'Cache-Control Configuration Missing',
            description: 'Browser caching reduces page load times for returning visitors by storing static resources locally.',
            recommendation: 'Add Cache-Control headers to serve static assets (JS, CSS, images) with long max-ages (e.g. Cache-Control: max-age=31536000).',
            docs_url: 'https://web.dev/articles/http-cache'
          });
          checksFailed++;
        } else {
          checksPassed++;
        }

        // gzip/Brotli encoding
        const encoding = headers.get('content-encoding');
        if (!encoding || (!encoding.includes('gzip') && !encoding.includes('br'))) {
          findings.push({
            category: 'performance',
            priority: 'medium',
            title: 'Text Compression Disabled',
            description: 'Serving assets uncompressed consumes excessive bandwidth and slows down first paint metrics.',
            recommendation: 'Enable gzip or Brotli compression on your origin server (Nginx, Apache, or Vercel).',
            docs_url: 'https://web.dev/articles/gzipped-content'
          });
          checksFailed++;
        } else {
          checksPassed++;
        }

        // Security headers
        const securityHeaders = [
          { name: 'X-Frame-Options', title: 'Clickjacking Protection Missing', desc: 'Allows your website to be embedded in iframes on malicious sites.', rec: 'Set header "X-Frame-Options: DENY" or "SAMEORIGIN".' },
          { name: 'X-Content-Type-Options', title: 'MIME Sniffing Prevention Missing', desc: 'Forces browsers to adhere to correct MIME types.', rec: 'Set header "X-Content-Type-Options: nosniff".' },
          { name: 'Content-Security-Policy', title: 'CSP Policy Not Configured', desc: 'Content Security Policy (CSP) protects against XSS attacks and script injection.', rec: 'Define a Content-Security-Policy configuration matching your script origins.' }
        ];

        for (const sh of securityHeaders) {
          if (!headers.get(sh.name.toLowerCase())) {
            findings.push({
              category: 'security',
              priority: 'low',
              title: sh.title,
              description: sh.desc,
              recommendation: sh.rec,
              docs_url: 'https://owasp.org/www-project-secure-headers/'
            });
            checksFailed++;
          } else {
            checksPassed++;
          }
        }

        // Page Size estimation
        const text = await headerRes.text();
        const sizeMb = Buffer.byteLength(text, 'utf8') / (1024 * 1024);
        if (sizeMb > 3.0) {
          findings.push({
            category: 'performance',
            priority: 'medium',
            title: 'Large Payload Size Detected',
            description: `The raw HTML text size is estimated at ${sizeMb.toFixed(2)} MB, exceeding the recommended limit of 3MB.`,
            recommendation: 'Optimize your pages by deferring non-critical scripts, compressing assets, and using lazy loading.',
            docs_url: 'https://web.dev/articles/reduce-network-payload-size-using-text-compression'
          });
          checksFailed++;
        } else {
          checksPassed++;
        }

      } catch (err) {
        console.warn('Headers audit failed:', err);
      }

      // ----------------------------------------------------
      // CHECK 3: SEO Configurations
      // ----------------------------------------------------
      emit(scan.project_id, StreamEventType.LEADS_SEARCHING, 'Auditing SEO meta configurations...', { status: 'running' });
      try {
        const headRes = await fetch(`https://${domain}`);
        const html = await headRes.text();

        // Title tag
        const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
        if (!titleMatch || !titleMatch[1].trim()) {
          findings.push({
            category: 'seo',
            priority: 'high',
            title: 'Missing Title Tag',
            description: 'Search engines use title tags as the primary link in search results pages.',
            recommendation: 'Add a distinct <title> tag inside the <head> element between 50-60 characters.',
            docs_url: 'https://developers.google.com/search/docs/appearance/title-link'
          });
          checksFailed++;
        } else {
          checksPassed++;
        }

        // Meta description
        const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i);
        if (!descMatch || !descMatch[1].trim()) {
          findings.push({
            category: 'seo',
            priority: 'medium',
            title: 'Missing Meta Description',
            description: 'Meta descriptions act as snippet summaries on search engine result lists.',
            recommendation: 'Add a <meta name="description" content="..."> tag to your head under 160 characters.',
            docs_url: 'https://developers.google.com/search/docs/appearance/snippets'
          });
          checksFailed++;
        } else {
          checksPassed++;
        }

        // robots.txt and sitemap.xml checks
        for (const path of ['robots.txt', 'sitemap.xml']) {
          try {
            const pathRes = await fetch(`https://${domain}/${path}`, { method: 'HEAD' });
            if (pathRes.status !== 200) {
              findings.push({
                category: 'seo',
                priority: 'low',
                title: `Missing ${path} File`,
                description: `Search engine crawlers check /${path} to index your site layout.`,
                recommendation: `Publish a valid /${path} configuration file at your root directory.`,
                docs_url: `https://developers.google.com/search/docs/crawling-indexing/intro-to-${path.split('.')[0]}`
              });
              checksFailed++;
            } else {
              checksPassed++;
            }
          } catch {
            checksFailed++;
          }
        }
      } catch (err) {
        console.warn('SEO audit failed:', err);
      }

      // ----------------------------------------------------
      // CHECK 4: Email DNS Configuration (SPF/DMARC)
      // ----------------------------------------------------
      emit(scan.project_id, StreamEventType.LEAD_RESEARCHING, 'Verifying DNS SPF/DMARC configurations...', { status: 'running' });
      try {
        const txtRecords = await dns.resolveTxt(domain);
        const joinedTxt = txtRecords.flat().join(' ');

        // Check SPF
        const hasSpf = joinedTxt.includes('v=spf1');
        if (!hasSpf) {
          findings.push({
            category: 'configuration',
            priority: 'high',
            title: 'Email SPF Record Missing',
            description: 'Sender Policy Framework (SPF) records prevent attackers from spoofing emails from your domain name.',
            recommendation: 'Add a TXT DNS record specifying your outbound email servers (e.g. "v=spf1 include:_spf.google.com ~all").',
            docs_url: 'https://support.google.com/a/answer/33786'
          });
          checksFailed++;
        } else {
          checksPassed++;
        }

        // Check DMARC
        let hasDmarc = false;
        try {
          const dmarcRecords = await dns.resolveTxt(`_dmarc.${domain}`);
          const dmarcTxt = dmarcRecords.flat().join(' ');
          hasDmarc = dmarcTxt.includes('v=DMARC1');
        } catch {}

        if (!hasDmarc) {
          findings.push({
            category: 'configuration',
            priority: 'medium',
            title: 'Email DMARC Alignment Missing',
            description: 'DMARC records prevent email phishing by setting validation checks aligned with SPF/DKIM keys.',
            recommendation: 'Add a TXT DNS record named "_dmarc" specifying your alignment policy (e.g. "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com").',
            docs_url: 'https://support.google.com/a/answer/2466563'
          });
          checksFailed++;
        } else {
          checksPassed++;
        }
      } catch (dnsErr) {
        // Fallback for subdomains / local DNS failures
        findings.push({
          category: 'configuration',
          priority: 'low',
          title: 'DNS TXT Record Check Incomplete',
          description: 'Failed to query TXT records over local DNS servers.',
          recommendation: 'Verify your domain registrar configurations have SPF and DMARC TXT records deployed.',
          docs_url: 'https://support.google.com/a/answer/140034'
        });
        checksFailed++;
      }

      // Calculate final score
      // Start at 100
      let score = 100;
      for (const f of findings) {
        if (f.priority === 'high') score -= 15;
        else if (f.priority === 'medium') score -= 7;
        else if (f.priority === 'low') score -= 3;
        else score -= 1;
      }
      score = Math.max(score, 0);

      // Save findings
      for (const f of findings) {
        await supabase
          .from('health_findings')
          .insert({
            scan_id: scanId,
            category: f.category,
            priority: f.priority,
            title: f.title,
            description: f.description,
            recommendation: f.recommendation,
            docs_url: f.docs_url || null
          });
      }

      // Update scan record
      await supabase
        .from('health_scans')
        .update({
          status: 'complete',
          score,
          checks_passed: checksPassed,
          checks_failed: checksFailed
        })
        .eq('id', scanId);

      emit(scan.project_id, StreamEventType.AGENT_COMPLETE, `Health check finished on "${targetUrl}". Score: ${score}/100`, { status: 'done' });

    } catch (err: any) {
      console.error('Failed website health check scan:', err);
      await supabase
        .from('health_scans')
        .update({ status: 'failed' })
        .eq('id', scanId);

      emit(scan.project_id, StreamEventType.STREAM_ERROR, `Health check scan failed on "${targetUrl}": ${err.message}`, { status: 'error' });
      throw err;
    }
  }
};

export default websiteHealthService;
