import { createClient, SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;
let serviceClientInstance: SupabaseClient | null = null;

export const supabaseService = {
  getClient(): SupabaseClient {
    if (!clientInstance) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (!url || !anonKey) {
        console.warn('Supabase NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing');
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
        console.warn('Supabase NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
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
