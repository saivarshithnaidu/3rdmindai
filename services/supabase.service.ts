import { createClient, SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;
let serviceClientInstance: SupabaseClient | null = null;

export const supabaseService = {
  getClient(): SupabaseClient {
    if (!clientInstance) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (!url || !anonKey) {
        throw new Error(
          'Supabase credentials missing. Please define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables (e.g., Vercel project settings).'
        );
      }
      clientInstance = createClient(url, anonKey, {
        auth: {
          persistSession: false,
        },
      });
    }
    return clientInstance;
  },

  getServiceClient(): SupabaseClient {
    if (!serviceClientInstance) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (!url || !serviceRoleKey) {
        throw new Error(
          'Supabase service role credentials missing. Please define NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment variables (e.g., Vercel project settings).'
        );
      }
      serviceClientInstance = createClient(url, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
    return serviceClientInstance;
  },
};
export default supabaseService;

