import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseConnection } from './connection';
import type { Database } from './database';
export async function serverClient() {
  const connection = supabaseConnection(process.env);
  if (!connection) return null;
  const jar = await cookies();
  return createServerClient<Database>(
    connection.url,
    connection.key,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            /* Server Components cannot set cookies; proxy refreshes them. */
          }
        },
      },
    },
  );
}
