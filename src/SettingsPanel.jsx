import { useEffect, useRef, useState } from 'react';
import { X, Palette, Clock, BarChart3, User, HelpCircle, LogOut, Globe, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useAuthUser } from './auth.js';
import { signInWithGoogle, signOut } from './supabase.js';
import { THEMES } from './themes.js';
import { useI18n, SUPPORTED_LANGS, LANG_NAMES } from './i18n.js';
import * as gcal from './providers/gcal.js';

const GoogleIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.3l-6.2-5.1C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8L6 32.6C9.4 39 16.1 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.1C41.5 35.6 44 30.2 44 24c0-1.3-.1-2.4-.4-3.5z"/>
  </svg>
);

function useMobile() {
  const check = () => typeof window !== 'undefined' && (window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth <= 1024));
  const [mobile, setMobile] = useState(check);
  useEffect(() => {
    setMobile(check());
    const h = () => setMobile(check());
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return mobile;
}

function CustomBgUploader({ C, t, isLoggedIn, customBg, onUploadBg, onClearBg, onGoogleSignIn }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const pick = () => { setErr(''); inputRef.current?.click(); };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true); setErr('');
    try { await onUploadBg(file); }
    catch (ex) { setErr(ex?.message || t.bgUploadFailed); }
    finally { setUploading(false); }
  };
  const clear = async () => {
    setUploading(true); setErr('');
    try { await onClearBg(); }
    catch (ex) { setErr(ex?.message || t.bgUploadFailed); }
    finally { setUploading(false); }
  };

  return (
    <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>{t.customBgTitle}</div>
      <div style={{ fontSize: 11, color: C.textMid, marginBottom: 12, lineHeight: 1.5 }}>{t.customBgDesc}</div>

      {!isLoggedIn ? (
        <div style={{ padding: '16px', borderRadius: 10, backgroundColor: C.hover, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: C.textMid, marginBottom: 12 }}>{t.customBgMembersOnly}</div>
          <button onClick={onGoogleSignIn} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, backgroundColor: '#fff', color: '#333', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}><GoogleIcon size={14} />{t.startWithGoogle}</button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={pick} disabled={uploading} style={{ padding: '9px 16px', borderRadius: 8, border: `1px solid ${C.borderStrong}`, backgroundColor: C.accent, color: '#fff', cursor: uploading ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, opacity: uploading ? 0.6 : 1 }}>{uploading ? t.bgUploading : (customBg?.url ? t.bgChange : t.bgUpload)}</button>
            {customBg?.url && (
              <button onClick={clear} disabled={uploading} style={{ padding: '9px 16px', borderRadius: 8, border: `1px solid ${C.borderStrong}`, backgroundColor: 'transparent', color: C.text, cursor: uploading ? 'default' : 'pointer', fontSize: 13, fontWeight: 500, opacity: uploading ? 0.6 : 1 }}>{t.bgRemove}</button>
            )}
          </div>
          {err && <div style={{ fontSize: 11, color: C.indicator, marginTop: 8 }}>{err}</div>}
          <input ref={inputRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
        </div>
      )}
    </div>
  );
}

function SectionContent({ section, C, t, lang, setLang, themeId, onChangeTheme, opacity, onChangeOpacity, isLoggedIn, avatarUrl, displayName, email, onGoogleSignIn, onLogout, busy, customBg, onUploadBg, onClearBg, gcalEnabled, onChangeGcalEnabled }) {
  if (section === 'account') return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: C.text }}>{t.account}</h2>
      {isLoggedIn ? (<div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: 16, backgroundColor: C.hover, borderRadius: 10 }}>
          {avatarUrl ? <img src={avatarUrl} alt="" width={48} height={48} style={{ borderRadius: '50%', flexShrink: 0 }} referrerPolicy="no-referrer" />
            : <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: C.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>{(displayName || email || '?')[0]?.toUpperCase()}</div>}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{displayName || t.user}</div>
            {email && <div style={{ fontSize: 12, color: C.textMid, marginTop: 2 }}>{email}</div>}
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{t.connectedWithGoogle}</div>
          </div>
        </div>
        <button onClick={onLogout} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, border: `1px solid ${C.borderStrong}`, backgroundColor: 'transparent', color: C.text, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}><LogOut size={14} />{t.logout}</button>
      </div>) : (<div style={{ padding: '40px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>{t.multiDeviceTitle}</div>
        <div style={{ fontSize: 12, color: C.textMid, marginBottom: 20, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{t.multiDeviceDesc}</div>
        <button onClick={onGoogleSignIn} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 24px', borderRadius: 10, backgroundColor: '#fff', color: '#333', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}><GoogleIcon size={18} />{t.startWithGoogle}</button>
      </div>)}
    </div>
  );
  if (section === 'themes') return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: C.text }}>{t.themes}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {Object.values(THEMES).map(th => { const active = themeId === th.id; return (
          <button key={th.id} onClick={() => onChangeTheme(th.id)} style={{ border: active ? `2px solid ${C.accent}` : '2px solid transparent', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', backgroundColor: C.hover, padding: 0, textAlign: 'left', outline: active ? `2px solid ${C.accent}44` : 'none', outlineOffset: 2, transition: 'all 0.15s' }}>
            <div style={{ width: '100%', height: 100, backgroundImage: `url(${th.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{th.name}</div>
              <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>{th.colors.scheme === 'dark' ? t.dark : t.light}</div>
            </div>
          </button>
        ); })}
        {customBg?.url && (() => { const active = themeId === 'custom'; return (
          <button onClick={() => onChangeTheme('custom')} style={{ border: active ? `2px solid ${C.accent}` : '2px solid transparent', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', backgroundColor: C.hover, padding: 0, textAlign: 'left', outline: active ? `2px solid ${C.accent}44` : 'none', outlineOffset: 2, transition: 'all 0.15s' }}>
            <div style={{ width: '100%', height: 100, backgroundImage: `url(${customBg.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{t.customBgTitle}</div>
              <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>{customBg.colors?.scheme === 'dark' ? t.dark : t.light}</div>
            </div>
          </button>
        ); })()}
      </div>
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{t.opacity}</span>
          <span style={{ fontSize: 12, color: C.textMid, fontVariantNumeric: 'tabular-nums' }}>{Math.round(opacity * 100)}%</span>
        </div>
        <input type="range" min={10} max={100} step={5} value={Math.round(opacity * 100)} onChange={(e) => onChangeOpacity(parseInt(e.target.value, 10) / 100)} style={{ width: '100%', accentColor: C.accent, cursor: 'pointer' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textDim, marginTop: 4 }}><span>{t.transparent}</span><span>{t.opaque}</span></div>
      </div>
      <CustomBgUploader C={C} t={t} isLoggedIn={isLoggedIn} customBg={customBg} onUploadBg={onUploadBg} onClearBg={onClearBg} onGoogleSignIn={onGoogleSignIn} />
    </div>
  );
  if (section === 'clock') return (<div><h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: C.text }}>{t.clock}</h2><p style={{ color: C.textMid, fontSize: 13 }}>{t.comingSoon}</p></div>);
  if (section === 'stats') return (<div><h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: C.text }}>{t.stats}</h2><p style={{ color: C.textMid, fontSize: 13 }}>{t.comingSoon}</p></div>);
  if (section === 'support') return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: C.text }}>{t.support}</h2>
      <div style={{ padding: 20, backgroundColor: C.hover, borderRadius: 10, lineHeight: 1.7 }}>
        <div style={{ fontSize: 13, color: C.text, marginBottom: 12 }}>{t.supportMsg}</div>
        <a href="mailto:canbe0to1@gmail.com" style={{ fontSize: 14, fontWeight: 600, color: C.accent, textDecoration: 'none' }}>canbe0to1@gmail.com</a>
      </div>
    </div>
  );
  if (section === 'language') return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: C.text }}>{t.language}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {SUPPORTED_LANGS.map(code => { const active = lang === code; return (
          <button key={code} onClick={() => setLang(code)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, border: active ? `2px solid ${C.accent}` : '2px solid transparent', backgroundColor: active ? C.hover : 'transparent', color: C.text, cursor: 'pointer', fontSize: 14, fontWeight: active ? 600 : 400, textAlign: 'left', transition: 'all 0.15s' }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = C.hover; }} onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >{LANG_NAMES[code]}</button>
        ); })}
      </div>
    </div>
  );
  if (section === 'calendar') return (
    <GcalSection C={C} t={t} gcalEnabled={gcalEnabled} onChangeGcalEnabled={onChangeGcalEnabled} />
  );
  return null;
}

function GcalSection({ C, t, gcalEnabled, onChangeGcalEnabled }) {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    gcal.isConnected().then(v => { if (!cancelled) { setConnected(v); setChecking(false); } }).catch(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, []);

  const handleConnect = async () => {
    try { await gcal.beginAuth(); } catch (e) { console.error(e); }
  };

  const handleDisconnect = async () => {
    await gcal.disconnect();
    setConnected(false);
    if (onChangeGcalEnabled) onChangeGcalEnabled(false);
  };

  if (checking) return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: C.text }}>{t.calendarTitle}</h2>
      <p style={{ color: C.textMid, fontSize: 13 }}>{t.loading}</p>
    </div>
  );

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: C.text }}>{t.calendarTitle}</h2>
      <p style={{ fontSize: 12, color: C.textMid, marginBottom: 20, lineHeight: 1.6 }}>{t.calendarDesc}</p>

      {!connected ? (
        <button
          onClick={handleConnect}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 8,
            backgroundColor: C.accent, color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            transition: 'all 0.15s',
          }}
        >
          <Calendar size={15} />
          {t.calendarConnect}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Connected status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', backgroundColor: C.hover, borderRadius: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22C55E', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, flex: 1 }}>{t.calendarConnected}</span>
          </div>

          {/* Show toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: C.hover, borderRadius: 10 }}>
            <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{t.calendarShow}</span>
            <button
              onClick={() => onChangeGcalEnabled && onChangeGcalEnabled(!gcalEnabled)}
              style={{
                width: 44, height: 24, borderRadius: 12,
                backgroundColor: gcalEnabled ? C.accent : C.borderStrong,
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'background-color 0.2s', flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: gcalEnabled ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%', backgroundColor: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>

          {/* Disconnect */}
          <button
            onClick={handleDisconnect}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 16px', borderRadius: 8,
              backgroundColor: 'transparent', color: C.textMid,
              border: `1px solid ${C.borderStrong}`, cursor: 'pointer',
              fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = C.hover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {t.calendarDisconnect}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SettingsPanel({ isOpen, onClose, themeId, onChangeTheme, opacity, onChangeOpacity, C, customBg, onUploadBg, onClearBg, gcalEnabled, onChangeGcalEnabled }) {
  const { t, lang, setLang } = useI18n();
  const mobile = useMobile();
  const MENU = [
    { key: 'account', icon: User, label: t.account },
    { key: 'themes', icon: Palette, label: t.themes },
    { key: 'calendar', icon: Calendar, label: t.calendarTitle },
    { key: 'clock', icon: Clock, label: t.clock },
    { key: 'stats', icon: BarChart3, label: t.stats },
    { key: 'support', icon: HelpCircle, label: t.support },
    { key: 'language', icon: Globe, label: t.language },
  ];
  const [activeSection, setActiveSection] = useState(null);
  const [busy, setBusy] = useState(false);
  const innerRef = useRef(null);
  const { user, loaded, isAnonymous, email, avatarUrl, displayName } = useAuthUser();
  const isLoggedIn = loaded && user && !isAnonymous;

  useEffect(() => {
    if (!isOpen) setActiveSection(mobile ? null : 'account');
  }, [isOpen, mobile]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onGoogleSignIn = async () => { setBusy(true); try { await signInWithGoogle(); } catch (e) { console.error(e); } finally { setBusy(false); } };
  const onLogout = async () => { setBusy(true); try { await signOut(); window.location.reload(); } finally { setBusy(false); } };

  const sectionProps = { C, t, lang, setLang, themeId, onChangeTheme, opacity, onChangeOpacity, isLoggedIn, avatarUrl, displayName, email, onGoogleSignIn, onLogout, busy, customBg, onUploadBg, onClearBg, gcalEnabled, onChangeGcalEnabled };

  // Mobile: full-screen drill-down
  if (mobile) {
    return (
      <>
        <div onClick={() => onClose()} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', opacity: isOpen ? 1 : 0, visibility: isOpen ? 'visible' : 'hidden', pointerEvents: isOpen ? 'auto' : 'none', transition: 'opacity 0.25s ease, visibility 0.25s ease' }} />
        <div onClick={(e) => e.stopPropagation()} style={{
          position: 'fixed', inset: '10vh 16px 10vh 16px', zIndex: 101,
          backgroundColor: C.card, color: C.text,
          borderRadius: 16, border: `1px solid ${C.border}`,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          opacity: isOpen ? 1 : 0, visibility: isOpen ? 'visible' : 'hidden',
          transform: isOpen ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.25s ease',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            {activeSection ? (
              <button onClick={() => setActiveSection(null)} style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: C.accent, cursor: 'pointer', fontSize: 14, fontWeight: 500, padding: 0 }}>
                <ChevronLeft size={18} />{t.settings}
              </button>
            ) : (
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{t.settings}</div>
            )}
            <button onClick={() => onClose()} style={{ marginLeft: 'auto', width: 28, height: 28, borderRadius: 6, border: 'none', backgroundColor: 'transparent', color: C.textMid, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {!activeSection ? (
              <>
                {/* Menu list */}
                {MENU.map(m => { const Icon = m.icon; return (
                  <button key={m.key} onClick={() => setActiveSection(m.key)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
                    border: 'none', backgroundColor: 'transparent', color: C.text, cursor: 'pointer',
                    fontSize: 15, fontWeight: 500, textAlign: 'left',
                  }}>
                    <Icon size={18} color={C.textMid} />
                    <span style={{ flex: 1 }}>{m.label}</span>
                    <ChevronRight size={16} color={C.textDim} />
                  </button>
                ); })}
                {/* Auth card at bottom */}
                <div style={{ margin: '16px 16px 8px', padding: 14, backgroundColor: C.hover, borderRadius: 10, textAlign: 'center' }}>
                  {isLoggedIn ? (<>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, textAlign: 'left' }}>
                      {avatarUrl ? <img src={avatarUrl} alt="" width={32} height={32} style={{ borderRadius: '50%', flexShrink: 0 }} referrerPolicy="no-referrer" />
                        : <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: C.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{(displayName || email || '?')[0]?.toUpperCase()}</div>}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName || t.user}</div>
                        {email && <div style={{ fontSize: 11, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>}
                      </div>
                    </div>
                    <button onClick={onLogout} disabled={busy} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.borderStrong}`, backgroundColor: 'transparent', color: C.text, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}><LogOut size={13} />{t.logout}</button>
                  </>) : (<>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>{t.loginRequired}</div>
                    <div style={{ fontSize: 11, color: C.textMid, marginBottom: 12 }}>{t.keepDataSafe}</div>
                    <button onClick={onGoogleSignIn} disabled={busy} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, backgroundColor: '#fff', color: '#333', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}><GoogleIcon size={16} />{t.startWithGoogle}</button>
                  </>)}
                </div>
              </>
            ) : (
              <div style={{ padding: '8px 20px 20px' }}>
                <SectionContent section={activeSection} {...sectionProps} />
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Desktop: sidebar + detail
  return (
    <>
      <div onClick={() => onClose()} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', opacity: isOpen ? 1 : 0, visibility: isOpen ? 'visible' : 'hidden', pointerEvents: isOpen ? 'auto' : 'none', transition: 'opacity 0.25s ease, visibility 0.25s ease' }} />
      <div ref={innerRef} onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', inset: 0, zIndex: 101, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: isOpen ? 'auto' : 'none', opacity: isOpen ? 1 : 0, visibility: isOpen ? 'visible' : 'hidden', transition: 'opacity 0.25s ease, visibility 0.25s ease' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', width: 'min(880px, 92vw)', maxHeight: '85vh', backgroundColor: C.card, color: C.text, borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.border}`, boxShadow: '0 24px 80px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', transform: isOpen ? 'scale(1)' : 'scale(0.96)', transition: 'transform 0.25s ease', pointerEvents: 'auto' }}>
          <aside style={{ display: 'flex', flexDirection: 'column', backgroundColor: C.cardAlt, borderRight: `1px solid ${C.border}`, padding: '16px 10px 10px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, padding: '8px 12px 16px' }}>{t.settings}</div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              {MENU.map(m => { const Icon = m.icon; const active = (activeSection || 'account') === m.key; return (
                <button key={m.key} onClick={() => setActiveSection(m.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, backgroundColor: active ? C.hover : 'transparent', color: active ? C.text : C.textMid, fontWeight: active ? 600 : 400, transition: 'all 0.12s' }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = C.hover; }} onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                ><Icon size={16} />{m.label}</button>
              ); })}
            </nav>
            <div style={{ marginTop: 8, padding: 14, backgroundColor: C.hover, borderRadius: 10, textAlign: 'center' }}>
              {isLoggedIn ? (<>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, textAlign: 'left' }}>
                  {avatarUrl ? <img src={avatarUrl} alt="" width={32} height={32} style={{ borderRadius: '50%', flexShrink: 0 }} referrerPolicy="no-referrer" />
                    : <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: C.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{(displayName || email || '?')[0]?.toUpperCase()}</div>}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName || t.user}</div>
                    {email && <div style={{ fontSize: 10, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>}
                  </div>
                </div>
                <button onClick={onLogout} disabled={busy} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.borderStrong}`, backgroundColor: 'transparent', color: C.text, cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = C.hover} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><LogOut size={13} />{t.logout}</button>
              </>) : (<>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>{t.loginRequired}</div>
                <div style={{ fontSize: 11, color: C.textMid, marginBottom: 12 }}>{t.keepDataSafe}</div>
                <button onClick={onGoogleSignIn} disabled={busy} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, backgroundColor: '#fff', color: '#333', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, transition: 'all 0.15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}><GoogleIcon size={16} />{t.startWithGoogle}</button>
              </>)}
            </div>
          </aside>
          <section style={{ padding: '24px 32px', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => onClose()} style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 6, border: 'none', backgroundColor: 'transparent', color: C.textMid, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = C.text} onMouseLeave={(e) => e.currentTarget.style.color = C.textMid}><X size={18} /></button>
            <SectionContent section={activeSection || 'account'} {...sectionProps} />
          </section>
        </div>
      </div>
    </>
  );
}
