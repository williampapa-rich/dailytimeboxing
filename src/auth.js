import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

export function useAuthUser() {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user || null);
      setLoaded(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAnonymous = !!user?.is_anonymous;
  const identities = user?.identities || [];
  const isGoogleLinked = identities.some((i) => i.provider === 'google');
  const email = user?.email || identities.find((i) => i.provider === 'google')?.identity_data?.email || null;
  const avatarUrl = user?.user_metadata?.avatar_url || identities.find((i) => i.provider === 'google')?.identity_data?.avatar_url || null;
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || email || null;

  return { user, loaded, isAnonymous, isGoogleLinked, email, avatarUrl, displayName };
}
