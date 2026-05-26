import { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronDown, X, Search, Music } from 'lucide-react';
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

function fmtDuration(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function MusicPlayer() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('spotify');
  const [connected, setConnected] = useState({ spotify: false, youtube: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [playlists, setPlaylists] = useState([]);
  const [playlistDropdownOpen, setPlaylistDropdownOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);
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
  const panelRef = useRef(null);
  const searchTimerRef = useRef(null);

  // ESC / click outside
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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

  useEffect(() => {
    setTrack(null); setPlaying(false); setPlaylists([]); setSelectedPlaylist(null);
    setPlaylistTracks([]); setPremiumRequired(false); setYtUnplayable(false);
    setPosition(0); setDuration(0); setErr('');
  }, [activeTab]);

  // Progress polling
  useEffect(() => {
    if (!playing || seeking) return;
    let cancelled = false;
    const id = setInterval(async () => {
      if (cancelled) return;
      if (activeTab === 'spotify') {
        try { const s = await spotify.getSdkState(); if (s) { setPosition(s.position); setDuration(s.duration); } } catch (e) {}
      } else if (activeTab === 'youtube') {
        const p = youtube.getProgress(); setPosition(p.position); setDuration(p.duration);
      }
    }, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [playing, seeking, activeTab]);

  // Spotify init
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
          if (s?.error?.code === 'premium_required') { setPremiumRequired(true); return; }
          if (s.track) setTrack(s.track);
          setPlaying(!!s.playing);
          if (typeof s.position === 'number') setPosition(s.position);
          if (typeof s.duration === 'number') setDuration(s.duration);
        });
      } catch (e) {
        if (e?.message === 'premium_required') setPremiumRequired(true);
        else setErr(e.message || String(e));
      } finally { setBusy(false); }
    })();
    return () => { if (unsub) unsub(); };
  }, [connected.spotify, activeTab]);

  // YouTube init
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
          if (s.track) { setTrack({ name: s.track.name, artist: s.track.artist, albumArt: s.track.albumArt || null }); setYtUnplayable(false); }
          setPlaying(!!s.playing);
        });
      } catch (e) {
        if (e?.code === 'reauth') {
          await removeConnection('youtube');
          setConnected(c => ({ ...c, youtube: false }));
          setPlaylists([]); setSelectedPlaylist(null); setTrack(null); setPlaying(false);
        } else { setErr(e.message || String(e)); }
      } finally { setBusy(false); }
    })();
    return () => { if (unsub) unsub(); };
  }, [connected.youtube, activeTab]);

  const onConnect = async (provider) => {
    setErr('');
    try {
      if (provider === 'spotify') await spotify.beginAuth();
      else if (provider === 'youtube') await youtube.beginAuth();
    } catch (e) { setErr(e.message || String(e)); }
  };

  const onDisconnect = async (provider) => {
    if (!confirm(`${provider} 연결을 해제할까요?`)) return;
    await removeConnection(provider);
    setConnected(c => ({ ...c, [provider]: false }));
    setPlaylists([]); setSelectedPlaylist(null); setPlaylistTracks([]); setTrack(null); setPlaying(false); setPremiumRequired(false);
  };

  const stopOtherProvider = async (current) => {
    try {
      if (current === 'spotify') youtube.pause();
      else if (current === 'youtube' && connected.spotify && deviceIdRef.current) await spotify.pause(deviceIdRef.current).catch(() => {});
    } catch (e) {}
  };

  const ensureSpotifyDevice = async (continuePlay = true) => {
    if (!deviceIdRef.current) return;
    try { await spotify.transferPlayback(deviceIdRef.current, continuePlay); await new Promise(r => setTimeout(r, 600)); } catch (e) {}
  };

  const setSafeErr = (e) => {
    const msg = (e && (e.message || String(e))) || '';
    if (/string did not match/i.test(msg) || /CloudPlaybackClientError/i.test(msg)) return;
    setErr(msg);
  };

  const onSelectPlaylist = async (pl) => {
    setPlaylistDropdownOpen(false);
    setSelectedPlaylist(pl);
    setYtUnplayable(false);
    setPlaylistTracks([]);
    try {
      if (activeTab === 'spotify') {
        if (premiumRequired) { window.open(pl.external_urls?.spotify || `https://open.spotify.com/playlist/${pl.id}`, '_blank'); return; }
        await stopOtherProvider('spotify');
        await ensureSpotifyDevice(false);
        await spotify.playPlaylist(pl.id, deviceIdRef.current);
        spotify.getPlaylistTracks(pl.id).then(setPlaylistTracks).catch(() => {});
      } else if (activeTab === 'youtube') {
        await stopOtherProvider('youtube');
        youtube.playPlaylist(pl.id);
        setTimeout(() => { setTrack((cur) => { if (!cur) setYtUnplayable(true); return cur; }); }, 5000);
      }
    } catch (e) { setSafeErr(e); }
  };

  const togglePlay = async () => {
    try {
      if (activeTab === 'spotify') {
        await spotify.sdkActivate();
        if (playing) { await spotify.sdkPause(); }
        else {
          await stopOtherProvider('spotify');
          const state = await spotify.getSdkState();
          if (state) { await spotify.sdkResume(); }
          else {
            try { await spotify.sdkResume(); } catch (e) {}
            await ensureSpotifyDevice(true);
            try { await spotify.resume(deviceIdRef.current); } catch (e) {}
            for (let i = 0; i < 15; i++) {
              await new Promise(r => setTimeout(r, 300));
              const s = await spotify.getSdkState();
              if (s) { if (s.paused) try { await spotify.sdkResume(); } catch (e) {} break; }
            }
          }
        }
      } else if (activeTab === 'youtube') {
        if (playing) youtube.pause();
        else { await stopOtherProvider('youtube'); youtube.play(); }
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
      } else { await stopOtherProvider('youtube'); youtube.next(); }
    } catch (e) { setSafeErr(e); }
  };

  const skipPrev = async () => {
    try {
      if (activeTab === 'spotify') {
        await stopOtherProvider('spotify');
        const state = await spotify.getSdkState();
        if (state) await spotify.sdkPrevious();
        else { await ensureSpotifyDevice(true); await spotify.previous(deviceIdRef.current); }
      } else { await stopOtherProvider('youtube'); youtube.previous(); }
    } catch (e) { setSafeErr(e); }
  };

  const onSeekCommit = async (ms) => {
    setSeeking(false); setPosition(ms);
    try {
      if (activeTab === 'spotify') {
        const s = await spotify.getSdkState();
        if (s) await spotify.sdkSeek(ms);
        else await spotify.seek(ms, deviceIdRef.current);
      } else youtube.seek(ms / 1000);
    } catch (e) { setSafeErr(e); }
  };

  const playTrackFromList = async (tr, idx) => {
    if (activeTab !== 'spotify' || !selectedPlaylist) return;
    try {
      await spotify.sdkActivate();
      await stopOtherProvider('spotify');
      await ensureSpotifyDevice(false);
      const q = deviceIdRef.current ? `?device_id=${deviceIdRef.current}` : '';
      // Play playlist from offset
      await fetch('https://api.spotify.com/v1/me/player/play' + q, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + (await spotify.getValidToken()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_uri: `spotify:playlist:${selectedPlaylist.id}`, offset: { position: idx } }),
      });
    } catch (e) { setSafeErr(e); }
  };

  // Search (Spotify only)
  useEffect(() => {
    if (activeTab !== 'spotify' || !searchOpen) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try { const items = await spotify.searchTracks(searchQuery.trim(), 20); setSearchResults(items); }
      catch (e) { setSafeErr(e); }
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
      setSearchOpen(false); setSearchQuery(''); setSearchResults([]);
    } catch (e) { setSafeErr(e); }
  };

  // Visibility sync
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState !== 'visible' || activeTab !== 'spotify' || !connected.spotify) return;
      try {
        const pb = await spotify.getCurrentPlayback();
        if (!pb || !pb.item) return;
        setTrack({ name: pb.item.name, artist: (pb.item.artists || []).map(a => a.name).join(', '), albumArt: pb.item.album?.images?.[0]?.url || null, uri: pb.item.uri });
        setPlaying(!!pb.is_playing);
      } catch (e) {}
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis); };
  }, [activeTab, connected.spotify]);

  const plName = selectedPlaylist
    ? (activeTab === 'spotify' ? selectedPlaylist.name : selectedPlaylist.snippet?.title)
    : null;
  const plImage = selectedPlaylist
    ? (activeTab === 'spotify' ? selectedPlaylist.images?.[0]?.url : (selectedPlaylist.snippet?.thumbnails?.medium?.url || selectedPlaylist.snippet?.thumbnails?.default?.url))
    : null;

  const progressPct = duration > 0 ? Math.min(100, ((seeking ? seekValue : position) / duration) * 100) : 0;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(v => !v)}
        title="음악 플레이어"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 51,
          height: 48, minWidth: 48,
          width: track && playing ? 'auto' : 48,
          maxWidth: 260,
          padding: track && playing ? '0 14px 0 6px' : 0,
          borderRadius: 999, border: 'none', cursor: 'pointer',
          backgroundColor: '#1a1a1a', color: '#fff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.2s ease',
        }}
      >
        {track && playing ? (
          <>
            {track.albumArt ? (
              <img src={track.albumArt} alt="" width={36} height={36} style={{ borderRadius: '50%', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Music size={16} />
              </div>
            )}
            <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600 }}>
              {track.name}
            </div>
          </>
        ) : (
          <Music size={20} />
        )}
      </button>

      {/* Backdrop blur overlay */}
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

      {/* Panel — anchored bottom-right, opens upward-left */}
      <div
        ref={panelRef}
        aria-hidden={!isOpen}
        style={{
          position: 'fixed', bottom: 78, right: 20, zIndex: 52,
          width: 380, maxHeight: 'calc(100vh - 100px)',
          display: 'flex', flexDirection: 'column',
          backgroundColor: '#1a1a2e', color: '#fff',
          borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)',
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ id: 'spotify', icon: <SpotifyIcon size={18} /> }, { id: 'youtube', icon: <YoutubeIcon size={18} /> }].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                width: 34, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer',
                backgroundColor: activeTab === t.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: activeTab === t.id ? 1 : 0.45, transition: 'all 0.15s',
              }}>{t.icon}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {connected.spotify && activeTab === 'spotify' && (
              <button onClick={() => setSearchOpen(v => !v)} title="곡 검색" style={iconBtn(searchOpen ? '#1DB954' : '#999')}>
                <Search size={13} />
              </button>
            )}
            {connected[activeTab] && (
              <button onClick={() => onDisconnect(activeTab)} title="연결 해제" style={iconBtn('#999')}>
                <X size={13} />
              </button>
            )}
            {/* Playlist dropdown */}
            {connected[activeTab] && playlists.length > 0 && (
              <button onClick={() => setPlaylistDropdownOpen(v => !v)} title="플레이리스트" style={iconBtn('#999')}>
                <ChevronDown size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Playlist dropdown */}
        {playlistDropdownOpen && playlists.length > 0 && (
          <div style={{ maxHeight: 240, overflowY: 'auto', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            {playlists.map(p => {
              const name = activeTab === 'spotify' ? p.name : p.snippet?.title;
              const thumb = activeTab === 'spotify' ? p.images?.[0]?.url : (p.snippet?.thumbnails?.default?.url || p.snippet?.thumbnails?.medium?.url);
              const isActive = selectedPlaylist?.id === p.id;
              return (
                <button key={p.id} onClick={() => onSelectPlaylist(p)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                  border: 'none', background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 12, transition: 'background 0.1s',
                }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {thumb && <img src={thumb} alt="" width={32} height={32} style={{ borderRadius: 4, flexShrink: 0, objectFit: 'cover' }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isActive ? 700 : 400 }}>{name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Not connected */}
        {!connected[activeTab] ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 14, whiteSpace: 'pre-line' }}>
              {activeTab === 'spotify' ? 'Spotify 계정을 연결하면\n내 플레이리스트를 재생할 수 있어요' : 'YouTube 계정을 연결하면\n내 플레이리스트를 재생할 수 있어요'}
            </div>
            <button onClick={() => onConnect(activeTab)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 999,
              backgroundColor: activeTab === 'spotify' ? '#1DB954' : '#FF0000',
              color: activeTab === 'spotify' ? '#000' : '#fff',
              border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            }}>
              {activeTab === 'spotify' ? <SpotifyIcon size={16} color="#000" /> : <YoutubeIcon size={16} />}
              <span>{activeTab === 'spotify' ? 'Spotify' : 'YouTube'} 연결</span>
            </button>
          </div>
        ) : (
          <>
            {/* Search panel */}
            {activeTab === 'spotify' && searchOpen && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                <div style={{ position: 'relative', marginBottom: searchResults.length > 0 || searching ? 8 : 0 }}>
                  <Search size={12} color="#666" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <input autoFocus type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="곡 검색..."
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 28px', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, outline: 'none' }}
                  />
                </div>
                {(searching || searchResults.length > 0) && (
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {searching ? <div style={{ padding: 10, fontSize: 11, color: '#666', textAlign: 'center' }}>검색 중...</div>
                    : searchResults.map(tr => (
                      <button key={tr.id} onClick={() => onPickSearchResult(tr)} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px',
                        border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 12,
                      }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {tr.album?.images?.[2]?.url && <img src={tr.album.images[2].url} alt="" width={28} height={28} style={{ borderRadius: 3, flexShrink: 0 }} />}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.name}</div>
                          <div style={{ fontSize: 10, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(tr.artists || []).map(a => a.name).join(', ')}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Now playing header */}
            <div style={{ padding: '16px 16px 12px', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                {plImage ? (
                  <img src={plImage} alt="" width={100} height={100} style={{ borderRadius: 8, flexShrink: 0, objectFit: 'cover' }} />
                ) : track?.albumArt ? (
                  <img src={track.albumArt} alt="" width={100} height={100} style={{ borderRadius: 8, flexShrink: 0, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 100, height: 100, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Music size={32} color="#444" />
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {plName || track?.name || '재생할 곡 없음'}
                  </div>
                  {plName && track?.name && (
                    <div style={{ fontSize: 12, color: '#aaa', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {track.name} — {track.artist}
                    </div>
                  )}
                  {!plName && track?.artist && (
                    <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{track.artist}</div>
                  )}
                  {activeTab === 'spotify' && premiumRequired && (
                    <div style={{ fontSize: 10, color: '#888', marginTop: 6 }}>Premium 전용 · 플레이리스트 탭하면 앱에서 열림</div>
                  )}
                </div>
              </div>

              {/* Progress */}
              {!(activeTab === 'spotify' && premiumRequired) && duration > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ position: 'relative', height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, cursor: 'pointer' }}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      onSeekCommit(pct * duration);
                    }}
                  >
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progressPct}%`, backgroundColor: activeTab === 'spotify' ? '#1DB954' : '#FF0000', borderRadius: 2, transition: seeking ? 'none' : 'width 0.3s linear' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#666', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                    <span>{fmtDuration(seeking ? seekValue : position)}</span>
                    <span>{fmtDuration(duration)}</span>
                  </div>
                </div>
              )}

              {/* Controls */}
              {!(activeTab === 'spotify' && premiumRequired) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                  <button onClick={skipPrev} style={ctrlBtn('#ccc')} title="이전곡"><SkipBack size={18} /></button>
                  <button onClick={togglePlay} title={playing ? '일시정지' : '재생'}
                    style={{
                      width: 48, height: 48, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)',
                      backgroundColor: 'transparent', color: '#fff', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {playing ? <Pause size={22} fill="#fff" /> : <Play size={22} fill="#fff" style={{ marginLeft: 2 }} />}
                  </button>
                  <button onClick={skipNext} style={ctrlBtn('#ccc')} title="다음곡"><SkipForward size={18} /></button>
                </div>
              )}
            </div>

            {/* Track list */}
            {playlistTracks.length > 0 && (
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {playlistTracks.map((t, i) => {
                  const isCurrent = track?.uri === t.uri;
                  return (
                    <button key={t.id + '-' + i} onClick={() => playTrackFromList(t, i)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                      border: 'none', background: isCurrent ? 'rgba(255,255,255,0.06)' : 'transparent',
                      color: isCurrent ? '#1DB954' : '#ddd', cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                      onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <span style={{ width: 20, textAlign: 'center', fontSize: 12, color: isCurrent ? '#1DB954' : '#666', fontWeight: isCurrent ? 700 : 400, flexShrink: 0 }}>
                        {isCurrent && playing ? '♪' : i + 1}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(t.artists || []).map(a => a.name).join(', ')}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: '#666', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtDuration(t.duration_ms)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* YouTube unplayable / notices */}
            {activeTab === 'youtube' && ytUnplayable && (
              <div style={{ padding: '10px 16px', fontSize: 11, color: '#888', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                이 플레이리스트는 임베드 재생이 제한돼 있어요.
              </div>
            )}

            {err && (
              <div style={{ padding: '8px 16px', fontSize: 11, color: '#FCA5A5', backgroundColor: 'rgba(248,113,113,0.08)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {err}
                <button onClick={() => setErr('')} style={{ float: 'right', background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', padding: 0, fontSize: 14 }}>×</button>
              </div>
            )}

            {/* Prompt to select playlist */}
            {!selectedPlaylist && !busy && playlists.length > 0 && (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: '#666', fontSize: 12 }}>
                상단에서 플레이리스트를 선택하세요
              </div>
            )}
            {busy && (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: '#666', fontSize: 12 }}>
                불러오는 중...
              </div>
            )}
          </>
        )}
      </div>

      {/* YouTube iframe — always mounted */}
      <div style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden', left: -9999, top: -9999 }}>
        <div id="dtb-youtube-iframe" />
      </div>
    </>
  );
}

function iconBtn(color) {
  return {
    width: 28, height: 28, borderRadius: 6,
    border: 'none', backgroundColor: 'transparent', color,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}

function ctrlBtn(color) {
  return {
    width: 36, height: 36, borderRadius: '50%',
    border: 'none', backgroundColor: 'transparent', color,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}
