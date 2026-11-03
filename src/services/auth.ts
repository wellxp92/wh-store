import { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

/**
 * Normalizes a Supabase User into the AppUser interface
 */
export function mapSupabaseUser(user: SupabaseAuthUser | null): AppUser | null {
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email || null,
    displayName: user.user_metadata?.full_name || user.email?.split('@')[0] || null,
    photoURL: user.user_metadata?.avatar_url || null,
  };
}

/**
 * Initiates Google OAuth login via Supabase
 */
export async function loginWithGoogleSupabase(): Promise<AppUser | null> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase não configurado. Por favor, configure as credenciais.');
  }

  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    throw new Error(`Erro no login Google Supabase: ${error.message}`);
  }

  return null;
}

/**
 * Login with email and password via Supabase
 */
export async function loginWithPasswordSupabase(email: string, password: string): Promise<AppUser> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase não configurado.');
  }

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Usuário não encontrado.');
  }

  const mapped = mapSupabaseUser(data.user);
  if (!mapped) throw new Error('Falha ao obter dados do usuário.');
  return mapped;
}

/**
 * Signs out from Supabase
 */
export async function logoutUserSupabase(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
}

/**
 * Gets current authenticated user
 */
export async function getCurrentUserSupabase(): Promise<AppUser | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return mapSupabaseUser(data.user);
}

/**
 * Listens to authentication state changes
 */
export function onAuthStateChangeSupabase(callback: (user: AppUser | null) => void): () => void {
  const client = getSupabaseClient();
  if (!client) {
    callback(null);
    return () => {};
  }

  const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
    callback(mapSupabaseUser(session?.user || null));
  });

  return () => {
    subscription.unsubscribe();
  };
}
