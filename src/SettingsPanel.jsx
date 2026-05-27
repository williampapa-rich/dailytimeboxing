import { useEffect, useRef, useState } from 'react';
import { X, Palette, Clock, BarChart3, User, HelpCircle, LogOut } from 'lucide-react';
import { useAuthUser } from './auth.js';
import { signInWithGoogle, signOut } from './supabase.js';
import { THEMES } from './themes.js';

const GoogleIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.3l-6.2-5.1C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8L6 32.6C9.4 39 16.1 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.1C41.5 35.6 44 30.2 44 24c0-1.3-.1-2.4-.4-3.5z"/>
  </svg>
);

const MENU = [
  { key: 'account', icon: User, label: '계정' },
  { key: 'themes', icon: Palette, label: '테마' },
  { key: 'clock', icon: Clock, label: '시계' },
  { key: 'stats', icon: BarChart3, label: '통계' },
  { key: 'support', icon: HelpCircle, label: '지원' },
];

export default function SettingsPanel({ isOpen, onClose, themeId, onChangeTheme, opacity, onChangeOpacity, C }) {
  const [activeSection, setActiveSection] = useState('account');
  const [busy, setBusy] = useState(false);
  const innerRef = useRef(null);
  const { user, loaded, isAnonymous, email, avatarUrl, displayName } = useAuthUser();
  const isLoggedIn = loaded && user && !isAnonymous;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onGoogleSignIn = async () => { setBusy(true); try { await signInWithGoogle(); } catch (e) { console.error(e); } finally { setBusy(false); } };
  const onLogout = async () => { setBusy(true); try { await signOut(); window.location.reload(); } finally { setBusy(false); } };

  return (
    <>
      <div onClick={() => onClose()} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', opacity: isOpen ? 1 : 0, visibility: isOpen ? 'visible' : 'hidden', pointerEvents: isOpen ? 'auto' : 'none', transition: 'opacity 0.25s ease, visibility 0.25s ease' }} />
      <div ref={innerRef} onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', inset: 0, zIndex: 101, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: isOpen ? 'auto' : 'none', opacity: isOpen ? 1 : 0, visibility: isOpen ? 'visible' : 'hidden', transition: 'opacity 0.25s ease, visibility 0.25s ease' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', width: 'min(880px, 92vw)', maxHeight: '85vh', backgroundColor: C.card, color: C.text, borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.border}`, boxShadow: '0 24px 80px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', transform: isOpen ? 'scale(1)' : 'scale(0.96)', transition: 'transform 0.25s ease', pointerEvents: 'auto' }}>
          <aside style={{ display: 'flex', flexDirection: 'column', backgroundColor: C.cardAlt, borderRight: `1px solid ${C.border}`, padding: '16px 10px 10px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, padding: '8px 12px 16px' }}>설정</div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              {MENU.map(m => { const Icon = m.icon; const active = activeSection === m.key; return (
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
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName || '사용자'}</div>
                    {email && <div style={{ fontSize: 10, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>}
                  </div>
                </div>
                <button onClick={onLogout} disabled={busy} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.borderStrong}`, backgroundColor: 'transparent', color: C.text, cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = C.hover} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><LogOut size={13} />로그아웃</button>
              </>) : (<>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>로그인이 필요해요</div>
                <div style={{ fontSize: 11, color: C.textMid, marginBottom: 12 }}>데이터를 안전하게 보관하세요</div>
                <button onClick={onGoogleSignIn} disabled={busy} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, backgroundColor: '#fff', color: '#333', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, transition: 'all 0.15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}><GoogleIcon size={16} />Google로 시작하기</button>
              </>)}
            </div>
          </aside>
          <section style={{ padding: '24px 32px', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => onClose()} style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 6, border: 'none', backgroundColor: 'transparent', color: C.textMid, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = C.text} onMouseLeave={(e) => e.currentTarget.style.color = C.textMid}><X size={18} /></button>
            {activeSection === 'account' && (<div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: C.text }}>계정</h2>
              {isLoggedIn ? (<div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: 16, backgroundColor: C.hover, borderRadius: 10 }}>
                  {avatarUrl ? <img src={avatarUrl} alt="" width={48} height={48} style={{ borderRadius: '50%', flexShrink: 0 }} referrerPolicy="no-referrer" />
                    : <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: C.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>{(displayName || email || '?')[0]?.toUpperCase()}</div>}
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{displayName || '사용자'}</div>
                    {email && <div style={{ fontSize: 12, color: C.textMid, marginTop: 2 }}>{email}</div>}
                    <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>Google 계정으로 연결됨</div>
                  </div>
                </div>
                <button onClick={onLogout} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, border: `1px solid ${C.borderStrong}`, backgroundColor: 'transparent', color: C.text, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}><LogOut size={14} />로그아웃</button>
              </div>) : (<div style={{ padding: '40px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>여러 기기에서 사용하고 싶다면?</div>
                <div style={{ fontSize: 12, color: C.textMid, marginBottom: 20, lineHeight: 1.6 }}>Google 계정으로 가입하면 타임박스 데이터가<br/>클라우드에 자동 저장되어 어디서든 이어서 쓸 수 있어요.</div>
                <button onClick={onGoogleSignIn} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 24px', borderRadius: 10, backgroundColor: '#fff', color: '#333', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}><GoogleIcon size={18} />Google로 시작하기</button>
              </div>)}
            </div>)}
            {activeSection === 'themes' && (<div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: C.text }}>테마</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {Object.values(THEMES).map(t => { const active = themeId === t.id; return (
                  <button key={t.id} onClick={() => onChangeTheme(t.id)} style={{ border: active ? `2px solid ${C.accent}` : '2px solid transparent', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', backgroundColor: C.hover, padding: 0, textAlign: 'left', outline: active ? `2px solid ${C.accent}44` : 'none', outlineOffset: 2, transition: 'all 0.15s' }}>
                    <div style={{ width: '100%', height: 100, backgroundImage: `url(${t.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>{t.colors.scheme === 'dark' ? '다크' : '라이트'}</div>
                    </div>
                  </button>
                ); })}
              </div>
              <div style={{ marginTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>불투명도</span>
                  <span style={{ fontSize: 12, color: C.textMid, fontVariantNumeric: 'tabular-nums' }}>{Math.round(opacity * 100)}%</span>
                </div>
                <input type="range" min={10} max={100} step={5} value={Math.round(opacity * 100)} onChange={(e) => onChangeOpacity(parseInt(e.target.value, 10) / 100)} style={{ width: '100%', accentColor: C.accent, cursor: 'pointer' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textDim, marginTop: 4 }}><span>투명</span><span>불투명</span></div>
              </div>
            </div>)}
            {activeSection === 'clock' && (<div><h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: C.text }}>시계</h2><p style={{ color: C.textMid, fontSize: 13 }}>추후 업데이트 예정입니다.</p></div>)}
            {activeSection === 'stats' && (<div><h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: C.text }}>통계</h2><p style={{ color: C.textMid, fontSize: 13 }}>추후 업데이트 예정입니다.</p></div>)}
            {activeSection === 'support' && (<div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: C.text }}>지원</h2>
              <div style={{ padding: 20, backgroundColor: C.hover, borderRadius: 10, lineHeight: 1.7 }}>
                <div style={{ fontSize: 13, color: C.text, marginBottom: 12 }}>문의사항이나 버그 신고는 아래 이메일로 연락주시면 감사하겠습니다.</div>
                <a href="mailto:canbe0to1@gmail.com" style={{ fontSize: 14, fontWeight: 600, color: C.accent, textDecoration: 'none' }}>canbe0to1@gmail.com</a>
              </div>
            </div>)}
          </section>
        </div>
      </div>
    </>
  );
}
