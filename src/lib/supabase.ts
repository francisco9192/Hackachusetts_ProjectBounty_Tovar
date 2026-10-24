import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The single Supabase client for the whole app.
 *
 * Browser code uses the public anon key ONLY. There is no server and no
 * service role key anywhere in this repo. The anon key is safe to ship to the
 * browser because every table is protected by Row Level Security and every
 * status change goes through a `security definer` RPC.
 *
 * The client is created lazily on first use. This keeps a production build
 * (`vite build`, which bundles but never runs this module) from crashing when
 * the env vars are not present at build time. The clear developer error is
 * thrown only when the client is actually constructed/used at runtime.
 */

/**
 * Optional typed Database placeholder. Generated table types can be slotted in
 * here later without touching call sites. Left intentionally empty for now.
 */
export type Database = Record<string, never>;

function readRequiredEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const value = import.meta.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and set ${name} ` +
        'from your Supabase project (Project Settings -> API). Use the public anon key only.',
    );
  }
  return value;
}

let client: SupabaseClient<Database> | null = null;

/**
 * Returns the shared Supabase client, constructing it on first call.
 * Throws a clear developer error naming the specific missing variable when
 * either VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is absent.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (client === null) {
    const url = readRequiredEnv('VITE_SUPABASE_URL');
    const anonKey = readRequiredEnv('VITE_SUPABASE_ANON_KEY');
    client = createClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return client;
}

/**
 * Convenience accessor. `supabase.auth`, `supabase.from(...)`, `supabase.rpc(...)`
 * all work. Access triggers construction (and the env guard) on first use.
 */
export const supabase: SupabaseClient<Database> = new Proxy(
  {} as SupabaseClient<Database>,
  {
    get(_target, prop, receiver) {
      return Reflect.get(getSupabase(), prop, receiver);
    },
  },
);
