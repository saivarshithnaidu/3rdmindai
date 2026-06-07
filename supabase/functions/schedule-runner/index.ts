// Deno Supabase Edge Function: schedule-runner
// Triggered every 15 minutes by Supabase Cron
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const appUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") || "http://localhost:3000";
    const checkUrl = `${appUrl}/api/startup-agents/schedule/check`;

    console.log(`Triggering schedule check at: ${checkUrl}`);
    const res = await fetch(checkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      throw new Error(`Next.js API check responded with status: ${res.status}`);
    }

    const data = await res.json();
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("Schedule runner execution failed:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
