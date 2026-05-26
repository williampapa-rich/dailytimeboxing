import { useEffect, useRef, useState } from 'react';
import { LogIn, LogOut, ChevronDown } from 'lucide-react';
import { useAuthUser } from './auth.js';
import { linkGoogleIdentity, signInWithGoogle, signOut } from './supabase.js';

const GoogleIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.3l-6.2-5.1C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8L6 32.6C9.4 39 16.1 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.1C41.5 35.6 44 30.2 44 24c0-1.3-.1-2.4-.4-3.5z"/>
  </svg>
);

export default function AuthButton({ C }) {
  const { user, loaded, isAnonymous, email, avatarUrl, displayName } = useAuthUser();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (!loaded) return null;

  const onConnect = async () => {
    setBusy(true); setErr('');
    try {
      const { error } = await linkGoogleIdentity();
      if (error) {
        if (/already|exists/i.test(error.message)) {
          await signInWithGoogle();
        } else throw error;
      }
    } catch (e) {
      setErr(e.message || String(e));
      setTimeout(() => setErr(''), 3500);
    } finally { setBusy(false); }
  };

  const onLogout = async () => {
    setOpen(false);
    setBusy(true);
    try { await signOut(); window.location.reload(); }
    finally { setBusy(false); }
  };

  if (isAnonymous || !user) {
    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={onConnect}
          disabled={busy}
          title="Google로 연결"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
            backgroundColor: C.card, color: C.text, cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
          }}
        >
          <GoogleIcon size={14} />
          <span>Google로 연결</span>
        </button>
        {err && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 6,
            padding: '6px 10px', fontSize: 11, color: C.indicator,
            backgroundColor: C.indicatorSoft, borderRadius: 6, whiteSpace: 'nowrap',
          }}>{err}</div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title={email || ''}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 8px 4px 4px', borderRadius: 999,
          border: `1px solid ${C.border}`, backgroundColor: C.card, color: C.text,
          cursor: 'pointer',
        }}
      >
        {avatarUrl
          ? <img src={avatarUrl} alt="" width={24} height={24} style={{ borderRadius: '50%' }} referrerPolicy="no-referrer" />
          : <div style={{
              width: 24, height: 24, borderRadius: '50%',
              backgroundColor: C.accent, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}>{(displayName || email || '?')[0]?.toUpperCase()}</div>}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          minWidth: 200, padding: 8, borderRadius: 10,
          backgroundColor: C.card, border: `1px solid ${C.border}`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100,
        }}>
          <div style={{ padding: '6px 8px 10px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>
              {displayName || '사용자'}
            </div>
            {email && (
              <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>{email}</div>
            )}
          </div>
          <button
            onClick={onLogout}
            disabled={busy}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 8px', marginTop: 4, borderRadius: 6,
              border: 'none', backgroundColor: 'transparent', color: C.text,
              cursor: 'pointer', fontSize: 12, fontWeight: 500, textAlign: 'left',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = C.hover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <LogOut size={14} />
            <span>로그아웃</span>
          </button>
        </div>
      )}
    </div>
  );
}
