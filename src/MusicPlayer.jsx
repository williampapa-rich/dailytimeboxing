import { useEffect, useRef, useState } from 'react';
import { Music, X } from 'lucide-react';
import { getConnection, removeConnection } from './providers/tokens.js';
import * as youtube from './providers/youtube.js';
import { useI18n } from './i18n.js';

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

const DEFAULT_SPOTIFY_URI = 'album/6m7pd3VUKdtHJPEpRmpyKv';

function parseSpotifyUrl(input) {
  if (!input) return null;
  const trimmed = input.trim();
  // Already a path like album/xxx or playlist/xxx
  if (/^(album|playlist|track|artist|episode|show)\/[a-zA-Z0-9]+/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.hostname.includes('spotify.com')) {
      const match = u.pathname.match(/\/(album|playlist|track|artist|episode|show)\/([a-zA-Z0-9]+)/);
      if (match) return `${match[1]}/${match[2]}`;
    }
  } catch (e) {}
  return null;
}

function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
}

export default function MusicPlayer({ appColors }) {
  const AC = appColors || {};
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [mobileAlert, setMobileAlert] = useState(false);
  const [activeTab, setActiveTab] = useState('spotify');

  // Spotify embed
  const [spotifyUri, setSpotifyUri] = useState(() => {
    try { return localStorage.getItem('dtb-spotify-uri') || DEFAULT_SPOTIFY_URI; } catch (e) { return DEFAULT_SPOTIFY_URI; }
  });
  const [spotifyInput, setSpotifyInput] = useState('');
  const [spotifyInputOpen, setSpotifyInputOpen] = useState(false);

  // YouTube state
  const [ytConnected, setYtConnected] = useState(false);
  const [ytBusy, setYtBusy] = useState(false);
  const [ytErr, setYtErr] = useState('');
  const [ytPlaylists, setYtPlaylists] = useState([]);
  const [ytSelectedPlaylist, setYtSelectedPlaylist] = useState(null);
  const [ytTrack, setYtTrack] = useState(null);
  const [ytPlaying, setYtPlaying] = useState(false);
  const [ytDropdownOpen, setYtDropdownOpen] = useState(false);
  const panelRef = useRef(null);

  const spotifyEmbedSrc = `https://open.spotify.com/embed/${spotifyUri}?utm_source=generator`;

  const onSpotifyUrlSubmit = () => {
    const parsed = parseSpotifyUrl(spotifyInput);
    if (parsed) {
      setSpotifyUri(parsed);
      try { localStorage.setItem('dtb-spotify-uri', parsed); } catch (e) {}
      setSpotifyInput('');
      setSpotifyInputOpen(false);
    }
  };

  // ESC
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // YouTube init
  useEffect(() => {
    (async () => {
      const yt = await getConnection('youtube').catch(() => null);
      setYtConnected(!!yt);
    })();
  }, []);

  useEffect(() => {
    if (!ytConnected || activeTab !== 'youtube') return;
    let unsub = null;
    (async () => {
      try {
        setYtBusy(true);
        const items = await youtube.listPlaylists();
        setYtPlaylists(items);
        await youtube.initPlayer('dtb-youtube-iframe');
        unsub = youtube.onPlayerState((s) => {
          if (s.track) { setYtTrack({ name: s.track.name, artist: s.track.artist, albumArt: s.track.albumArt || null }); }
          setYtPlaying(!!s.playing);
        });
      } catch (e) {
        if (e?.code === 'reauth') {
          await removeConnection('youtube');
          setYtConnected(false); setYtPlaylists([]); setYtSelectedPlaylist(null); setYtTrack(null); setYtPlaying(false);
        } else { setYtErr(e.message || String(e)); }
      } finally { setYtBusy(false); }
    })();
    return () => { if (unsub) unsub(); };
  }, [ytConnected, activeTab]);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => isMobile() ? setMobileAlert(true) : setIsOpen(v => !v)}
        title={t.musicPlayer}
        style={{
          position: 'fixed', bottom: 20, right: 76, zIndex: 51,
          height: 48, width: 48, borderRadius: 999, cursor: 'pointer',
          border: AC.border ? `1px solid ${AC.border}` : 'none',
          backgroundColor: AC.card || '#1a1a1a', color: AC.text || '#fff',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <Music size={20} />
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 51,
          backdropFilter: isOpen ? 'blur(6px)' : 'blur(0px)',
          WebkitBackdropFilter: isOpen ? 'blur(6px)' : 'blur(0px)',
          background: isOpen ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0)',
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden',
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'all 0.25s ease',
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        aria-hidden={!isOpen}
        style={{
          position: 'fixed', bottom: 78, right: 76, zIndex: 52,
          width: 380, maxHeight: 'calc(100vh - 100px)',
          display: 'flex', flexDirection: 'column',
          backgroundColor: AC.card || '#1a1a2e', color: AC.text || '#fff',
          borderRadius: 16, border: `1px solid ${AC.border || 'rgba(255,255,255,0.08)'}`,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden',
          pointerEvents: isOpen ? 'auto' : 'none',
          transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
          transformOrigin: 'bottom right',
          transition: 'opacity 0.2s ease, visibility 0.2s ease, transform 0.2s ease',
          overflow: 'hidden',
        }}
      >
        {/* Tab bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: `1px solid ${AC.border || 'rgba(255,255,255,0.06)'}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ id: 'spotify', icon: <SpotifyIcon size={18} /> }, { id: 'youtube', icon: <YoutubeIcon size={18} /> }].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                width: 34, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer',
                backgroundColor: activeTab === tab.id ? (AC.hover || 'rgba(255,255,255,0.08)') : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: activeTab === tab.id ? 1 : 0.45, transition: 'all 0.15s',
              }}>{tab.icon}</button>
            ))}
          </div>
          <button onClick={() => setIsOpen(false)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', backgroundColor: 'transparent', color: AC.textMid || '#999', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'spotify' ? (
            <div style={{ padding: '12px' }}>
              {/* Spotify embed iframe — always mounted, never removed */}
              <iframe
                style={{ borderRadius: 12, width: '100%', border: 'none' }}
                src={spotifyEmbedSrc}
                height="352"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
              {/* URL input toggle */}
              <div style={{ marginTop: 10, textAlign: 'center' }}>
                {spotifyInputOpen ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      autoFocus
                      type="text"
                      value={spotifyInput}
                      onChange={(e) => setSpotifyInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') onSpotifyUrlSubmit(); }}
                      placeholder="Spotify URL"
                      style={{
                        flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 12,
                        backgroundColor: AC.hover || 'rgba(255,255,255,0.06)',
                        border: `1px solid ${AC.border || 'rgba(255,255,255,0.08)'}`,
                        color: AC.text || '#fff', outline: 'none',
                      }}
                    />
                    <button onClick={onSpotifyUrlSubmit} style={{
                      padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      backgroundColor: AC.accent || '#1DB954', color: '#fff', fontSize: 12, fontWeight: 600,
                    }}>OK</button>
                    <button onClick={() => { setSpotifyInputOpen(false); setSpotifyInput(''); }} style={{
                      padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      backgroundColor: 'transparent', color: AC.textMid || '#999', fontSize: 14,
                    }}>×</button>
                  </div>
                ) : (
                  <button onClick={() => setSpotifyInputOpen(true)} style={{
                    fontSize: 11, color: AC.textMid || '#888', background: 'none', border: 'none', cursor: 'pointer',
                    textDecoration: 'underline', opacity: 0.7,
                  }}>
                    Spotify URL
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: '14px 16px 16px' }}>
              {!ytConnected ? (
                <div style={{ textAlign: 'center', padding: '20px 4px' }}>
                  <div style={{ fontSize: 12, color: AC.textMid || '#888', marginBottom: 14, whiteSpace: 'pre-line' }}>{t.youtubeConnect}</div>
                  <button onClick={async () => { try { await youtube.beginAuth(); } catch (e) { setYtErr(e.message || String(e)); } }} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 999,
                    backgroundColor: '#FF0000', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  }}>
                    <YoutubeIcon size={16} />YouTube {t.connectProvider}
                  </button>
                </div>
              ) : (
                <>
                  {/* YouTube playlist dropdown */}
                  <button onClick={() => setYtDropdownOpen(v => !v)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: 6, marginBottom: 10,
                    backgroundColor: AC.hover || 'rgba(255,255,255,0.06)', border: `1px solid ${AC.border || 'rgba(255,255,255,0.08)'}`,
                    color: AC.text || '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: ytSelectedPlaylist ? (AC.text || '#fff') : (AC.textMid || '#888') }}>
                      {ytBusy ? t.loading : (ytSelectedPlaylist ? ytSelectedPlaylist.snippet?.title : t.selectPlaylist)}
                    </span>
                  </button>
                  {ytDropdownOpen && ytPlaylists.length > 0 && (
                    <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 10, borderRadius: 6, border: `1px solid ${AC.border || 'rgba(255,255,255,0.06)'}` }}>
                      {ytPlaylists.map(p => (
                        <button key={p.id} onClick={() => { setYtSelectedPlaylist(p); setYtDropdownOpen(false); youtube.playPlaylist(p.id); }} style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                          border: 'none', background: 'transparent', color: AC.text || '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 12,
                        }}>
                          {(p.snippet?.thumbnails?.default?.url) && <img src={p.snippet.thumbnails.default.url} alt="" width={28} height={28} style={{ borderRadius: 3, flexShrink: 0, objectFit: 'cover' }} />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.snippet?.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {ytTrack && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      {ytTrack.albumArt && <img src={ytTrack.albumArt} alt="" width={44} height={44} style={{ borderRadius: 6, flexShrink: 0 }} />}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: AC.text || '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ytTrack.name}</div>
                        <div style={{ fontSize: 11, color: AC.textMid || '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ytTrack.artist}</div>
                      </div>
                    </div>
                  )}
                  {/* YouTube controls */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                    <button onClick={() => youtube.previous()} title={t.prevTrack} style={ctrlBtn(AC.text || '#ccc')}>⏮</button>
                    <button onClick={() => ytPlaying ? youtube.pause() : youtube.play()} title={ytPlaying ? t.pause : t.play}
                      style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${AC.border || 'rgba(255,255,255,0.2)'}`, backgroundColor: 'transparent', color: AC.text || '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {ytPlaying ? '⏸' : '▶'}
                    </button>
                    <button onClick={() => youtube.next()} title={t.nextTrack} style={ctrlBtn(AC.text || '#ccc')}>⏭</button>
                  </div>
                  {ytErr && <div style={{ marginTop: 8, fontSize: 11, color: '#FCA5A5', textAlign: 'center' }}>{ytErr}</div>}
                  <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <button onClick={async () => { if (confirm(t.confirmDisconnect)) { await removeConnection('youtube'); setYtConnected(false); setYtPlaylists([]); setYtSelectedPlaylist(null); setYtTrack(null); } }}
                      style={{ fontSize: 11, color: AC.textDim || '#666', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', opacity: 0.7 }}>{t.disconnect}</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* YouTube iframe — always mounted */}
      <div style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden', left: -9999, top: -9999 }}>
        <div id="dtb-youtube-iframe" />
      </div>

      {/* Mobile alert modal */}
      <div
        onClick={() => setMobileAlert(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          opacity: mobileAlert ? 1 : 0,
          visibility: mobileAlert ? 'visible' : 'hidden',
          pointerEvents: mobileAlert ? 'auto' : 'none',
          transition: 'all 0.25s ease',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(320px, 85vw)', padding: '28px 24px', borderRadius: 16,
            backgroundColor: AC.card || '#1a1a2e', color: AC.text || '#fff', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            transform: mobileAlert ? 'scale(1)' : 'scale(0.9)',
            transition: 'transform 0.25s ease',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>😭</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t.desktopOnly}</div>
          <div style={{ fontSize: 13, color: AC.textMid || '#999', lineHeight: 1.6, marginBottom: 20, whiteSpace: 'pre-line' }}>{t.desktopOnlyMsg}</div>
          <button
            onClick={() => setMobileAlert(false)}
            style={{ padding: '10px 24px', borderRadius: 10, border: 'none', backgroundColor: AC.accent || '#D97757', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >{t.confirm}</button>
        </div>
      </div>
    </>
  );
}

function ctrlBtn(color) {
  return {
    width: 36, height: 36, borderRadius: '50%',
    border: 'none', backgroundColor: 'transparent', color,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
  };
}
