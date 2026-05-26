import { useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronDown, Minus, Plus } from 'lucide-react';
import { getConnection } from './providers/tokens.js';

const SpotifyIcon = ({ size = 18, color = '#1DB954' }) => (
  <svg width={size} height={size} viewBox="0 0 168 168" aria-hidden="true">
    <circle cx="84" cy="84" r="84" fill={color} />
    <path fill="#000" d="M122.5 117.4c-1.6 2.6-5 3.4-7.6 1.8-20.8-12.7-46.9-15.6-77.6-8.6-3 .7-6-1.2-6.7-4.2s1.2-6 4.2-6.7c33.5-7.6 62.4-4.3 85.6 10 2.6 1.6 3.4 5 1.8 7.6zm10.3-22.9c-2 3.3-6.3 4.3-9.5 2.3-23.8-14.6-60-18.9-88.1-10.4-3.7 1.1-7.6-.9-8.7-4.6-1.1-3.7.9-7.6 4.6-8.7 32.1-9.7 71.9-4.9 99.4 12 3.3 2 4.3 6.3 2.3 9.4zm.9-23.9C105 53.1 56.7 51.4 30.1 59.5c-4.4 1.3-9-1.1-10.3-5.5-1.3-4.4 1.1-9 5.5-10.3 30.6-9.3 84.1-7.4 117.4 12.4 4 2.3 5.3 7.4 3 11.3-2.4 4-7.5 5.3-11.5 3z"/>
  </svg>
);

const YoutubeIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#FF0000" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8 0 12 0 12s0 4 .5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 16 24 12 24 12s0-4-.5-5.8z"/>
    <path fill="#fff" d="M9.5 15.5v-7L15.8 12 9.5 15.5z"/>
  </svg>
);

const THEMES = {
  spotify: { bg: '#121212', accent: '#1DB954', text: '#FFFFFF', sub: '#B3B3B3', border: '#282828' },
  youtube: { bg: '#0F0F0F', accent: '#FF0000', text: '#FFFFFF', sub: '#AAAAAA', border: '#272727' },
};

function isMobile() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 760px)').matches;
}

export default function MusicPlayer() {
  const [mobile, setMobile] = useState(isMobile);
  const [activeTab, setActiveTab] = useState('spotify');
  const [collapsed, setCollapsed] = useState(false);
  const [connected, setConnected] = useState({ spotify: false, youtube: false });

  useEffect(() => {
    const m = window.matchMedia('(max-width: 760px)');
    const h = () => setMobile(m.matches);
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, []);

  useEffect(() => {
    (async () => {
      const [sp, yt] = await Promise.all([
        getConnection('spotify').catch(() => null),
        getConnection('youtube').catch(() => null),
      ]);
      setConnected({ spotify: !!sp, youtube: !!yt });
    })();
  }, []);

  if (mobile) return null;

  const T = THEMES[activeTab];

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="플레이어 열기"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 50,
          width: 48, height: 48, borderRadius: '50%',
          backgroundColor: T.bg, color: T.accent,
          border: `1px solid ${T.border}`, cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {activeTab === 'spotify' ? <SpotifyIcon size={22} /> : <YoutubeIcon size={22} />}
      </button>
    );
  }

  const onConnect = (provider) => {
    alert(`${provider} 연결 기능은 다음 단계에서 활성화됩니다.`);
  };

  return (
    <div
      style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 50,
        width: 320, borderRadius: 12, overflow: 'hidden',
        backgroundColor: T.bg, color: T.text,
        border: `1px solid ${T.border}`,
        boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
        fontFamily: 'inherit',
      }}
    >
      {/* Tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px', borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'spotify', icon: <SpotifyIcon size={20} /> },
            { id: 'youtube', icon: <YoutubeIcon size={20} /> },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              title={t.id}
              style={{
                width: 36, height: 32, borderRadius: 6,
                border: 'none', cursor: 'pointer',
                backgroundColor: activeTab === t.id ? '#FFFFFF14' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: activeTab === t.id ? 1 : 0.55,
                transition: 'all 0.15s',
              }}
            >
              {t.icon}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          title="접기"
          style={{
            width: 24, height: 24, borderRadius: 4,
            border: 'none', backgroundColor: 'transparent',
            color: T.sub, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Minus size={14} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 14px 12px' }}>
        {!connected[activeTab] ? (
          <div style={{ textAlign: 'center', padding: '12px 4px 4px' }}>
            <div style={{ fontSize: 12, color: T.sub, marginBottom: 12 }}>
              {activeTab === 'spotify' ? 'Spotify 계정을 연결하면\n내 플레이리스트를 재생할 수 있어요'
                : 'YouTube 계정을 연결하면\n내 플레이리스트를 재생할 수 있어요'}
            </div>
            <button
              onClick={() => onConnect(activeTab)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', borderRadius: 999,
                backgroundColor: T.accent, color: activeTab === 'spotify' ? '#000' : '#fff',
                border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
              }}
            >
              {activeTab === 'spotify' ? <SpotifyIcon size={16} color="#000" /> : <YoutubeIcon size={16} />}
              <span>{activeTab === 'spotify' ? 'Spotify' : 'YouTube'} 연결</span>
            </button>
          </div>
        ) : (
          <>
            {/* Playlist selector (placeholder) */}
            <button
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', borderRadius: 6,
                backgroundColor: '#FFFFFF10', border: `1px solid ${T.border}`,
                color: T.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                marginBottom: 12,
              }}
            >
              <span style={{ color: T.sub }}>플레이리스트 선택</span>
              <ChevronDown size={14} color={T.sub} />
            </button>

            {/* Now playing */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, lineHeight: 1.3, marginBottom: 2 }}>
                재생할 곡 없음
              </div>
              <div style={{ fontSize: 11, color: T.sub }}>—</div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
              <button style={ctrlBtn(T.text)} title="이전곡"><SkipBack size={18} /></button>
              <button style={{ ...ctrlBtn('#000'), backgroundColor: T.accent, width: 40, height: 40 }} title="재생">
                <Play size={18} fill="#000" />
              </button>
              <button style={ctrlBtn(T.text)} title="다음곡"><SkipForward size={18} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ctrlBtn(color) {
  return {
    width: 32, height: 32, borderRadius: '50%',
    border: 'none', backgroundColor: 'transparent', color,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}
