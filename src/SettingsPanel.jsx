import { useEffect, useRef, useState } from 'react';
import { X, Palette, Clock, BarChart3, User, HelpCircle, LogOut } from 'lucide-react';
import { useAuthUser } from './auth.js';
import { signInWithGoogle, signOut } from './supabase.js';

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

export default function SettingsPanel({ isOpen, onClose }) {
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

  const onGoogleSignIn = async () => {
    setBusy(true);
    try { await signInWithGoogle(); }
    catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  const onLogout = async () => {
    setBusy(true);
    try { await signOut(); window.location.reload(); }
    finally { setBusy(false); }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => onClose()}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden',
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease, visibility 0.25s ease',
        }}
      />

      {/* Panel */}
      <div
        ref={innerRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', inset: 0, zIndex: 101,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: isOpen ? 'auto' : 'none',
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden',
          transition: 'opacity 0.25s ease, visibility 0.25s ease',
        }}
      >
        <div
          style={{
            display: 'grid', gridTemplateColumns: '240px 1fr',
            width: 'min(880px, 92vw)', maxHeight: '85vh',
            backgroundColor: '#1a1a1a', color: '#fff',
            borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            transform: isOpen ? 'scale(1)' : 'scale(0.96)',
            transition: 'transform 0.25s ease',
            pointerEvents: 'auto',
          }}
        >
          {/* Sidebar */}
          <aside style={{
            display: 'flex', flexDirection: 'column',
            backgroundColor: '#141414', borderRight: '1px solid #222',
            padding: '16px 10px 10px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', padding: '8px 12px 16px' }}>설정</div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              {MENU.map(m => {
                const Icon = m.icon;
                const active = activeSection === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setActiveSection(m.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 8,
                      border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13,
                      backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: active ? '#fff' : '#999',
                      fontWeight: active ? 600 : 400,
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <Icon size={16} />
                    {m.label}
                  </button>
                );
              })}
            </nav>

            {/* Auth card at sidebar bottom */}
            <div style={{
              marginTop: 8, padding: 14, backgroundColor: '#1f1f1f',
              borderRadius: 10, textAlign: 'center',
            }}>
              {isLoggedIn ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, textAlign: 'left' }}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" width={32} height={32} style={{ borderRadius: '50%', flexShrink: 0 }} referrerPolicy="no-referrer" />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#6d28d9', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                        {(displayName || email || '?')[0]?.toUpperCase()}
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayName || '사용자'}
                      </div>
                      {email && <div style={{ fontSize: 10, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>}
                    </div>
                  </div>
                  <button
                    onClick={onLogout}
                    disabled={busy}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '7px 10px', borderRadius: 8,
                      border: '1px solid #333', backgroundColor: 'transparent', color: '#ccc',
                      cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <LogOut size={13} />
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>로그인이 필요해요</div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>데이터를 안전하게 보관하세요</div>
                  <button
                    onClick={onGoogleSignIn}
                    disabled={busy}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '9px 12px', borderRadius: 8,
                      backgroundColor: '#fff', color: '#333',
                      border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                  >
                    <GoogleIcon size={16} />
                    Google로 시작하기
                  </button>
                </>
              )}
            </div>
          </aside>

          {/* Detail panel */}
          <section style={{ padding: '24px 32px', overflowY: 'auto', position: 'relative' }}>
            {/* Close button */}
            <button
              onClick={() => onClose()}
              style={{
                position: 'absolute', top: 12, right: 12,
                width: 28, height: 28, borderRadius: 6,
                border: 'none', backgroundColor: 'transparent', color: '#888',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#888'}
            >
              <X size={18} />
            </button>

            {activeSection === 'account' && (
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: '#fff' }}>계정</h2>
                {isLoggedIn ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: 16, backgroundColor: '#1f1f1f', borderRadius: 10 }}>
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" width={48} height={48} style={{ borderRadius: '50%', flexShrink: 0 }} referrerPolicy="no-referrer" />
                      ) : (
                        <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#6d28d9', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
                          {(displayName || email || '?')[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{displayName || '사용자'}</div>
                        {email && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{email}</div>}
                        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Google 계정으로 연결됨</div>
                      </div>
                    </div>
                    <button
                      onClick={onLogout}
                      disabled={busy}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 16px', borderRadius: 8,
                        border: '1px solid #333', backgroundColor: 'transparent', color: '#ccc',
                        cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      }}
                    >
                      <LogOut size={14} />
                      로그아웃
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: '40px 0', textAlign: 'center' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 6 }}>로그인하면 더 많은 기능을 사용할 수 있어요</div>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>타임박스 데이터가 클라우드에 안전하게 저장됩니다</div>
                    <button
                      onClick={onGoogleSignIn}
                      disabled={busy}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 10,
                        padding: '12px 24px', borderRadius: 10,
                        backgroundColor: '#fff', color: '#333',
                        border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                      }}
                    >
                      <GoogleIcon size={18} />
                      Google로 시작하기
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeSection === 'themes' && (
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: '#fff' }}>테마</h2>
                <p style={{ color: '#888', fontSize: 13 }}>추후 업데이트 예정입니다.</p>
              </div>
            )}

            {activeSection === 'clock' && (
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: '#fff' }}>시계</h2>
                <p style={{ color: '#888', fontSize: 13 }}>추후 업데이트 예정입니다.</p>
              </div>
            )}

            {activeSection === 'stats' && (
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: '#fff' }}>통계</h2>
                <p style={{ color: '#888', fontSize: 13 }}>추후 업데이트 예정입니다.</p>
              </div>
            )}

            {activeSection === 'support' && (
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: '#fff' }}>지원</h2>
                <p style={{ color: '#888', fontSize: 13 }}>문의사항은 이메일로 보내주세요.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
