import { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronDown, Minus, X, RefreshCw, ExternalLink, Search } from 'lucide-react';
import { getConnection, removeConnection } from './providers/tokens.js';
import * as spotify from './providers/spotify.js';
import * as youtube from './providers/youtube.js';

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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Spotify player state
  const [playlists, setPlaylists] = useState([]);
  const [playlistDropdownOpen, setPlaylistDropdownOpen] = useState(false);
  const [dropdownDir, setDropdownDir] = useState('up');
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [track, setTrack] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [ytUnplayable, setYtUnplayable] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const deviceIdRef = useRef(null);
  const playlistBtnRef = useRef(null);
  const searchTimerRef = useRef(null);

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

  // Provider init on tab change
  useEffect(() => {
    setTrack(null);
    setPlaying(false);
    setPlaylists([]);
    setSelectedPlaylist(null);
    setPremiumRequired(false);
    setYtUnplayable(false);
    setPosition(0);
    setDuration(0);
    setErr('');
  }, [activeTab]);

  // Progress polling (in addition to event-driven updates)
  useEffect(() => {
    if (!playing || seeking) return;
    let cancelled = false;
    const id = setInterval(async () => {
      if (cancelled) return;
      if (activeTab === 'spotify') {
        try {
          const s = await spotify.getSdkState();
          if (s) {
            setPosition(s.position);
            setDuration(s.duration);
          }
        } catch (e) {}
      } else if (activeTab === 'youtube') {
        const p = youtube.getProgress();
        setPosition(p.position);
        setDuration(p.duration);
      }
    }, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [playing, seeking, activeTab]);

  // Spotify init when connected and active
  useEffect(() => {
    if (!connected.spotify || activeTab !== 'spotify') return;
    let unsub = null;
    (async () => {
      try {
        setBusy(true);
        const items = await spotify.listPlaylists();
        setPlaylists(items);
        const { deviceId } = await spotify.initPlayer();
        deviceIdRef.current = deviceId;
        unsub = spotify.onPlayerState((s) => {
          if (s?.error?.code === 'premium_required') {
            setPremiumRequired(true);
            return;
          }
          if (s.track) setTrack(s.track);
          setPlaying(!!s.playing);
          if (typeof s.position === 'number') setPosition(s.position);
          if (typeof s.duration === 'number') setDuration(s.duration);
        });
      } catch (e) {
        if (e?.message === 'premium_required') setPremiumRequired(true);
        else setErr(e.message || String(e));
      } finally {
        setBusy(false);
      }
    })();
    return () => { if (unsub) unsub(); };
  }, [connected.spotify, activeTab]);

  // YouTube init when connected and active
  useEffect(() => {
    if (!connected.youtube || activeTab !== 'youtube') return;
    let unsub = null;
    (async () => {
      try {
        setBusy(true);
        const items = await youtube.listPlaylists();
        setPlaylists(items);
        await youtube.initPlayer('dtb-youtube-iframe');
        unsub = youtube.onPlayerState((s) => {
          if (s.track) {
            setTrack({ name: s.track.name, artist: s.track.artist, albumArt: s.track.albumArt || null });
            setYtUnplayable(false);
          }
          setPlaying(!!s.playing);
        });
      } catch (e) {
        if (e?.code === 'reauth') {
          setErr('YouTube 토큰이 만료됐어요. 다시 연결해주세요.');
        } else {
          setErr(e.message || String(e));
        }
      } finally {
        setBusy(false);
      }
    })();
    return () => { if (unsub) unsub(); };
  }, [connected.youtube, activeTab]);

  if (mobile) return null;

  const T = THEMES[activeTab];

  const onConnect = async (provider) => {
    setErr('');
    try {
      if (provider === 'spotify') {
        await spotify.beginAuth();
      } else if (provider === 'youtube') {
        await youtube.beginAuth();
      }
    } catch (e) {
      setErr(e.message || String(e));
    }
  };

  const onDisconnect = async (provider) => {
    if (!confirm(`${provider} 연결을 해제할까요?`)) return;
    await removeConnection(provider);
    setConnected(c => ({ ...c, [provider]: false }));
    setPlaylists([]);
    setSelectedPlaylist(null);
    setTrack(null);
    setPlaying(false);
    setPremiumRequired(false);
  };

  const stopOtherProvider = async (current) => {
    try {
      if (current === 'spotify') {
        youtube.pause();
      } else if (current === 'youtube') {
        if (connected.spotify && deviceIdRef.current) {
          await spotify.pause(deviceIdRef.current).catch(() => {});
        }
      }
    } catch (e) {}
  };

  // play=true로 transfer하면 다른 탭/기기는 자동 정지되고 우리 탭에서 이어재생
  const ensureSpotifyDevice = async (continuePlay = true) => {
    if (!deviceIdRef.current) return;
    try {
      await spotify.transferPlayback(deviceIdRef.current, continuePlay);
      await new Promise(r => setTimeout(r, 600));
    } catch (e) {}
  };

  const syncSpotifyState = async () => {
    if (activeTab !== 'spotify' || !connected.spotify) return;
    try {
      const pb = await spotify.getCurrentPlayback();
      if (!pb || !pb.item) return;
      setTrack({
        name: pb.item.name,
        artist: (pb.item.artists || []).map(a => a.name).join(', '),
        albumArt: pb.item.album?.images?.[0]?.url || null,
        uri: pb.item.uri,
      });
      setPlaying(!!pb.is_playing);
    } catch (e) {}
  };

  // 탭이 보이게 될 때마다 현재 재생 상태 동기화
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') syncSpotifyState();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [activeTab, connected.spotify]);

  // SDK 내부에서 종종 튀어나오는 "string did not match" 같은 무해한 메시지는 무시
  const setSafeErr = (e) => {
    const msg = (e && (e.message || String(e))) || '';
    if (/string did not match/i.test(msg)) return;
    if (/CloudPlaybackClientError/i.test(msg)) return;
    setErr(msg);
  };

  const onSelectPlaylist = async (pl) => {
    setPlaylistDropdownOpen(false);
    setSelectedPlaylist(pl);
    setYtUnplayable(false);
    try {
      if (activeTab === 'spotify') {
        if (premiumRequired) {
          window.open(pl.external_urls?.spotify || `https://open.spotify.com/playlist/${pl.id}`, '_blank');
          return;
        }
        await stopOtherProvider('spotify');
        await ensureSpotifyDevice(false);
        await spotify.playPlaylist(pl.id, deviceIdRef.current);
      } else if (activeTab === 'youtube') {
        await stopOtherProvider('youtube');
        youtube.playPlaylist(pl.id);
        // 5초 안에 영상이 안 잡히면 재생 불가 플리로 간주
        setTimeout(() => {
          setTrack((cur) => {
            if (!cur) setYtUnplayable(true);
            return cur;
          });
        }, 5000);
      }
    } catch (e) {
      setSafeErr(e);
    }
  };

  const togglePlay = async () => {
    try {
      if (activeTab === 'spotify') {
        // Safari/iOS autoplay 우회 — 반드시 사용자 제스처 안에서 호출
        await spotify.sdkActivate();
        if (playing) {
          await spotify.sdkPause();
        } else {
          await stopOtherProvider('spotify');
          const state = await spotify.getSdkState();
          if (state) {
            await spotify.sdkResume();
          } else {
            try { await spotify.sdkResume(); } catch (e) {}
            await ensureSpotifyDevice(true);
            try { await spotify.resume(deviceIdRef.current); } catch (e) {}
            for (let i = 0; i < 15; i++) {
              await new Promise(r => setTimeout(r, 300));
              const s = await spotify.getSdkState();
              if (s) {
                if (s.paused) {
                  try { await spotify.sdkResume(); } catch (e) {}
                }
                break;
              }
            }
          }
        }
      } else if (activeTab === 'youtube') {
        if (playing) {
          youtube.pause();
        } else {
          await stopOtherProvider('youtube');
          youtube.play();
        }
      }
    } catch (e) { setSafeErr(e); }
  };

  const skipNext = async () => {
    try {
      if (activeTab === 'spotify') {
        await stopOtherProvider('spotify');
        const state = await spotify.getSdkState();
        if (state) await spotify.sdkNext();
        else { await ensureSpotifyDevice(true); await spotify.next(deviceIdRef.current); }
      } else if (activeTab === 'youtube') {
        await stopOtherProvider('youtube');
        youtube.next();
      }
    } catch (e) { setSafeErr(e); }
  };
  // Seek
  const onSeekCommit = async (ms) => {
    setSeeking(false);
    setPosition(ms);
    try {
      if (activeTab === 'spotify') {
        const s = await spotify.getSdkState();
        if (s) await spotify.sdkSeek(ms);
        else await spotify.seek(ms, deviceIdRef.current);
      } else if (activeTab === 'youtube') {
        youtube.seek(ms / 1000);
      }
    } catch (e) { setSafeErr(e); }
  };

  // Search (Spotify only)
  useEffect(() => {
    if (activeTab !== 'spotify' || !searchOpen) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const items = await spotify.searchTracks(searchQuery.trim(), 20);
        setSearchResults(items);
      } catch (e) { setSafeErr(e); }
      finally { setSearching(false); }
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, searchOpen, activeTab]);

  const onPickSearchResult = async (tr) => {
    try {
      await stopOtherProvider('spotify');
      await spotify.sdkActivate();
      await ensureSpotifyDevice(false);
      await spotify.playUris([tr.uri], deviceIdRef.current);
      setSearchOpen(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (e) { setSafeErr(e); }
  };

  const skipPrev = async () => {
    try {
      if (activeTab === 'spotify') {
        await stopOtherProvider('spotify');
        const state = await spotify.getSdkState();
        if (state) await spotify.sdkPrevious();
        else { await ensureSpotifyDevice(true); await spotify.previous(deviceIdRef.current); }
      } else if (activeTab === 'youtube') {
        await stopOtherProvider('youtube');
        youtube.previous();
      }
    } catch (e) { setSafeErr(e); }
  };

  const [dropdownRect, setDropdownRect] = useState(null);
  const togglePlaylistDropdown = () => {
    if (playlistDropdownOpen) {
      setPlaylistDropdownOpen(false);
      return;
    }
    const btn = playlistBtnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const above = rect.top - 16;
      const below = window.innerHeight - rect.bottom - 16;
      const dir = below > above ? 'down' : 'up';
      setDropdownDir(dir);
      const maxH = Math.min(320, Math.max(120, dir === 'down' ? below : above));
      setDropdownRect({
        left: rect.left,
        width: rect.width,
        top: dir === 'down' ? rect.bottom + 4 : 'auto',
        bottom: dir === 'up' ? (window.innerHeight - rect.top + 4) : 'auto',
        maxHeight: maxH,
      });
    }
    setPlaylistDropdownOpen(true);
  };

  return (
    <div
      style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 50,
        width: collapsed ? 56 : 340, borderRadius: collapsed ? '50%' : 12,
        overflow: 'hidden',
        backgroundColor: T.bg, color: T.text,
        border: `1px solid ${T.border}`,
        boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
        fontFamily: 'inherit',
        transition: 'width 0.18s, border-radius 0.18s',
      }}
    >
      <style>{`
        .dtb-progress {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 14px; background: transparent; cursor: pointer; margin: 0; padding: 0;
          display: block;
        }
        .dtb-progress::-webkit-slider-runnable-track {
          height: 3px; border-radius: 2px;
          background: linear-gradient(to right, var(--c) 0, var(--c) var(--p), rgba(255,255,255,0.18) var(--p), rgba(255,255,255,0.18) 100%);
        }
        .dtb-progress::-moz-range-track {
          height: 3px; border-radius: 2px;
          background: linear-gradient(to right, var(--c) 0, var(--c) var(--p), rgba(255,255,255,0.18) var(--p), rgba(255,255,255,0.18) 100%);
        }
        .dtb-progress::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 10px; height: 10px; border-radius: 50%;
          background: var(--c); border: none; margin-top: -3.5px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.5);
        }
        .dtb-progress::-moz-range-thumb {
          width: 10px; height: 10px; border-radius: 50%;
          background: var(--c); border: none;
          box-shadow: 0 1px 3px rgba(0,0,0,0.5);
        }
        .dtb-progress:focus { outline: none; }
        .dtb-progress-spotify { --c: #1DB954; }
        .dtb-progress-youtube { --c: #FF0000; }
      `}</style>
      {/* Tabs */}
      {!collapsed && (
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
        <div style={{ display: 'flex', gap: 4 }}>
          {connected.spotify && activeTab === 'spotify' && (
            <button
              onClick={() => setSearchOpen(v => !v)}
              title="곡 검색"
              style={{ ...iconBtn(searchOpen ? T.accent : T.sub) }}
            ><Search size={13} /></button>
          )}
          {connected[activeTab] && (
            <button
              onClick={() => onDisconnect(activeTab)}
              title="연결 해제"
              style={iconBtn(T.sub)}
            ><X size={13} /></button>
          )}
          <button onClick={() => setCollapsed(true)} title="접기" style={iconBtn(T.sub)}>
            <Minus size={14} />
          </button>
        </div>
      </div>
      )}

      {/* Collapsed bubble (also serves as expand toggle) */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          title="플레이어 열기"
          style={{
            width: 56, height: 56, border: 'none', cursor: 'pointer',
            backgroundColor: 'transparent', color: T.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {activeTab === 'spotify' ? <SpotifyIcon size={26} /> : <YoutubeIcon size={26} />}
        </button>
      )}

      {/* Body (hidden when collapsed) */}
      <div style={{ padding: '14px 14px 12px', display: collapsed ? 'none' : 'block' }}>
        {!connected[activeTab] ? (
          <div style={{ textAlign: 'center', padding: '12px 4px 4px' }}>
            <div style={{ fontSize: 12, color: T.sub, marginBottom: 12, whiteSpace: 'pre-line' }}>
              {activeTab === 'spotify'
                ? 'Spotify 계정을 연결하면\n내 플레이리스트를 재생할 수 있어요'
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
            {/* Search panel (Spotify only) */}
            {activeTab === 'spotify' && searchOpen && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <Search size={12} color={T.sub} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="곡 검색..."
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '8px 10px 8px 28px', borderRadius: 6,
                      backgroundColor: '#FFFFFF10', border: `1px solid ${T.border}`,
                      color: T.text, fontSize: 12, outline: 'none',
                    }}
                  />
                </div>
                {(searching || searchResults.length > 0) && (
                  <div style={{
                    maxHeight: 220, overflowY: 'auto',
                    backgroundColor: '#FFFFFF08', border: `1px solid ${T.border}`, borderRadius: 6,
                  }}>
                    {searching ? (
                      <div style={{ padding: 12, fontSize: 11, color: T.sub, textAlign: 'center' }}>검색 중...</div>
                    ) : (
                      searchResults.map(tr => (
                        <button
                          key={tr.id}
                          onClick={() => onPickSearchResult(tr)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 10px', border: 'none', background: 'transparent',
                            color: T.text, cursor: 'pointer', textAlign: 'left', fontSize: 12,
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF10'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          {tr.album?.images?.[2]?.url && (
                            <img src={tr.album.images[2].url} alt="" width={32} height={32} style={{ borderRadius: 3, flexShrink: 0 }} />
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.name}</div>
                            <div style={{ fontSize: 10, color: T.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {(tr.artists || []).map(a => a.name).join(', ')}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Playlist selector */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <button
                ref={playlistBtnRef}
                onClick={togglePlaylistDropdown}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px', borderRadius: 6,
                  backgroundColor: '#FFFFFF10', border: `1px solid ${T.border}`,
                  color: T.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selectedPlaylist ? T.text : T.sub }}>
                  {busy ? '불러오는 중...' : (selectedPlaylist ? (activeTab === 'spotify' ? selectedPlaylist.name : selectedPlaylist.snippet?.title) : '플레이리스트 선택')}
                </span>
                <ChevronDown size={14} color={T.sub} />
              </button>
              {playlistDropdownOpen && playlists.length > 0 && dropdownRect && (
                <div style={{
                  position: 'fixed',
                  left: dropdownRect.left,
                  width: dropdownRect.width,
                  top: dropdownRect.top,
                  bottom: dropdownRect.bottom,
                  maxHeight: dropdownRect.maxHeight,
                  overflowY: 'auto',
                  backgroundColor: T.bg, border: `1px solid ${T.border}`, borderRadius: 6,
                  boxShadow: dropdownDir === 'up' ? '0 -4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.4)',
                  zIndex: 100,
                }}>
                  {playlists.map(p => {
                    const name = activeTab === 'spotify' ? p.name : p.snippet?.title;
                    const thumb = activeTab === 'spotify'
                      ? p.images?.[0]?.url
                      : (p.snippet?.thumbnails?.default?.url || p.snippet?.thumbnails?.medium?.url);
                    return (
                      <button
                        key={p.id}
                        onClick={() => onSelectPlaylist(p)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 10px', border: 'none', background: 'transparent',
                          color: T.text, cursor: 'pointer', textAlign: 'left', fontSize: 12,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF10'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {thumb && (
                          <img src={thumb} alt="" width={24} height={24} style={{ borderRadius: 3, flexShrink: 0, objectFit: 'cover' }} />
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Premium required notice */}
            {activeTab === 'spotify' && premiumRequired && (
              <div style={{
                fontSize: 11, color: T.sub, marginBottom: 10, padding: 8,
                backgroundColor: '#FFFFFF08', borderRadius: 6, lineHeight: 1.5,
              }}>
                인앱 재생은 Spotify Premium 전용입니다. 플레이리스트를 누르면 Spotify 앱에서 열려요.
              </div>
            )}

            {/* YouTube playlist unplayable notice */}
            {activeTab === 'youtube' && ytUnplayable && (
              <div style={{
                fontSize: 11, color: T.sub, marginBottom: 10, padding: 8,
                backgroundColor: '#FFFFFF08', borderRadius: 6, lineHeight: 1.5,
              }}>
                이 플레이리스트는 임베드 재생이 제한돼 있어요. YouTube에서 직접 만든 플리만 지원합니다 (자동 생성된 믹스/추천 플리는 불가).
              </div>
            )}

            {/* Now playing */}
            <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              {track?.albumArt && (
                <img src={track.albumArt} alt="" width={44} height={44} style={{ borderRadius: 4, flexShrink: 0 }} />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: T.text, lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {track?.name || (activeTab === 'spotify' && premiumRequired
                    ? selectedPlaylist?.name
                    : '재생할 곡 없음')}
                </div>
                <div style={{ fontSize: 11, color: T.sub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {track?.artist || '—'}
                </div>
              </div>
              {activeTab === 'spotify' && premiumRequired && selectedPlaylist && (
                <a
                  href={selectedPlaylist.external_urls?.spotify || `https://open.spotify.com/playlist/${selectedPlaylist.id}`}
                  target="_blank" rel="noreferrer"
                  style={{ color: T.accent, display: 'flex', alignItems: 'center' }}
                  title="Spotify 앱에서 열기"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>

            {/* Progress bar */}
            {!(activeTab === 'spotify' && premiumRequired) && duration > 0 && (
              <div style={{ marginBottom: 12 }}>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={1000}
                  value={seeking ? seekValue : position}
                  onMouseDown={() => { setSeeking(true); setSeekValue(position); }}
                  onTouchStart={() => { setSeeking(true); setSeekValue(position); }}
                  onChange={(e) => setSeekValue(parseInt(e.target.value, 10))}
                  onMouseUp={(e) => onSeekCommit(parseInt(e.target.value, 10))}
                  onTouchEnd={(e) => onSeekCommit(parseInt(e.target.value, 10))}
                  className={`dtb-progress dtb-progress-${activeTab}`}
                  style={{ '--p': `${Math.min(100, ((seeking ? seekValue : position) / duration) * 100)}%` }}
                />
                <div className="dtb-tnum" style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 10, color: T.sub, marginTop: 2, fontVariantNumeric: 'tabular-nums',
                }}>
                  <span>{fmtMs(seeking ? seekValue : position)}</span>
                  <span>{fmtMs(duration)}</span>
                </div>
              </div>
            )}

            {/* Controls */}
            {!(activeTab === 'spotify' && premiumRequired) && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
                <button onClick={skipPrev} style={ctrlBtn(T.text)} title="이전곡"><SkipBack size={18} /></button>
                <button
                  onClick={togglePlay}
                  style={{ ...ctrlBtn('#000'), backgroundColor: T.accent, width: 40, height: 40 }}
                  title={playing ? '일시정지' : '재생'}
                >
                  {playing ? <Pause size={18} fill="#000" /> : <Play size={18} fill="#000" />}
                </button>
                <button onClick={skipNext} style={ctrlBtn(T.text)} title="다음곡"><SkipForward size={18} /></button>
              </div>
            )}

            {err && (
              <div style={{
                marginTop: 10, padding: 8, fontSize: 11, color: '#FCA5A5',
                backgroundColor: 'rgba(248,113,113,0.12)', borderRadius: 6, lineHeight: 1.4,
              }}>
                {err}
                <button
                  onClick={() => setErr('')}
                  style={{ float: 'right', background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', padding: 0 }}
                >×</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* YouTube iframe - always mounted (hidden), so audio survives collapse/tab switch */}
      <div style={{
        position: 'absolute', width: 1, height: 1,
        opacity: 0, pointerEvents: 'none', overflow: 'hidden',
        left: -9999, top: -9999,
      }}>
        <div id="dtb-youtube-iframe" />
      </div>
    </div>
  );
}

function fmtMs(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function iconBtn(color) {
  return {
    width: 24, height: 24, borderRadius: 4,
    border: 'none', backgroundColor: 'transparent', color,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}

function ctrlBtn(color) {
  return {
    width: 32, height: 32, borderRadius: '50%',
    border: 'none', backgroundColor: 'transparent', color,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}
