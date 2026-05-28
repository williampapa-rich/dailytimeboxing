import { useEffect, useRef, useState } from 'react';
import { Music, X, Play, Pause, SkipBack, SkipForward, ChevronDown, Search } from 'lucide-react';
import { getConnection, removeConnection } from './providers/tokens.js';
import * as spotify from './providers/spotify.js';
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

function fmtDuration(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const SPOTIFY_GREEN = '#1DB954';

function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
}

export default function MusicPlayer({ appColors }) {
  const AC = appColors || {};
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [mobileAlert, setMobileAlert] = useState(false);
  const [activeTab, setActiveTab] = useState('spotify');

  // Spotify SDK state
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spBusy, setSpBusy] = useState(false);
  const [spErr, setSpErr] = useState('');
  const [spPlaylists, setSpPlaylists] = useState([]);
  const [spPlaylistDropdownOpen, setSpPlaylistDropdownOpen] = useState(false);
  const [spSelectedPlaylist, setSpSelectedPlaylist] = useState(null);
  const [spPlaylistTracks, setSpPlaylistTracks] = useState([]);
  const [spTrack, setSpTrack] = useState(null);
  const [spPlaying, setSpPlaying] = useState(false);
  const [spPremiumRequired, setSpPremiumRequired] = useState(false);
  const [spPosition, setSpPosition] = useState(0);
  const [spDuration, setSpDuration] = useState(0);
  const [spSeeking, setSpSeeking] = useState(false);
  const [spSeekValue, setSpSeekValue] = useState(0);
  const [spSearchOpen, setSpSearchOpen] = useState(false);
  const [spSearchQuery, setSpSearchQuery] = useState('');
  const [spSearchResults, setSpSearchResults] = useState([]);
  const [spSearching, setSpSearching] = useState(false);
  const spDeviceIdRef = useRef(null);
  const spSearchTimerRef = useRef(null);

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

  // ESC
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Connection check
  useEffect(() => {
    (async () => {
      const [sp, yt] = await Promise.all([
        getConnection('spotify').catch(() => null),
        getConnection('youtube').catch(() => null),
      ]);
      setSpotifyConnected(!!sp);
      setYtConnected(!!yt);
    })();
  }, []);

  // Spotify init
  useEffect(() => {
    if (!spotifyConnected || activeTab !== 'spotify') return;
    let unsub = null;
    (async () => {
      try {
        setSpBusy(true);
        const items = await spotify.listPlaylists();
        setSpPlaylists(items);
        const { deviceId } = await spotify.initPlayer();
        spDeviceIdRef.current = deviceId;
        unsub = spotify.onPlayerState((s) => {
          if (s?.error?.code === 'premium_required') { setSpPremiumRequired(true); return; }
          if (s.track) setSpTrack(s.track);
          setSpPlaying(!!s.playing);
          if (typeof s.position === 'number') setSpPosition(s.position);
          if (typeof s.duration === 'number') setSpDuration(s.duration);
        });
      } catch (e) {
        if (e?.message === 'premium_required') setSpPremiumRequired(true);
        else setSpErr(e.message || String(e));
      } finally { setSpBusy(false); }
    })();
    return () => { if (unsub) unsub(); };
  }, [spotifyConnected, activeTab]);

  // Spotify progress polling
  useEffect(() => {
    if (activeTab !== 'spotify' || !spPlaying || spSeeking) return;
    let cancelled = false;
    const id = setInterval(async () => {
      if (cancelled) return;
      try { const s = await spotify.getSdkState(); if (s) { setSpPosition(s.position); setSpDuration(s.duration); } } catch (e) {}
    }, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [activeTab, spPlaying, spSeeking]);

  // Spotify search
  useEffect(() => {
    if (activeTab !== 'spotify' || !spSearchOpen) return;
    if (spSearchTimerRef.current) clearTimeout(spSearchTimerRef.current);
    if (!spSearchQuery.trim()) { setSpSearchResults([]); return; }
    spSearchTimerRef.current = setTimeout(async () => {
      setSpSearching(true);
      try { const items = await spotify.searchTracks(spSearchQuery.trim(), 20); setSpSearchResults(items); }
      catch (e) { setSafeSpErr(e); }
      finally { setSpSearching(false); }
    }, 300);
    return () => { if (spSearchTimerRef.current) clearTimeout(spSearchTimerRef.current); };
  }, [spSearchQuery, spSearchOpen, activeTab]);

  // Spotify visibility sync
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState !== 'visible' || activeTab !== 'spotify' || !spotifyConnected) return;
      try {
        const pb = await spotify.getCurrentPlayback();
        if (!pb || !pb.item) return;
        setSpTrack({ name: pb.item.name, artist: (pb.item.artists || []).map(a => a.name).join(', '), albumArt: pb.item.album?.images?.[0]?.url || null, uri: pb.item.uri });
        setSpPlaying(!!pb.is_playing);
      } catch (e) {}
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis); };
  }, [activeTab, spotifyConnected]);

  // YouTube init
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

  const setSafeSpErr = (e) => {
    const msg = (e && (e.message || String(e))) || '';
    if (/string did not match/i.test(msg) || /CloudPlaybackClientError/i.test(msg)) return;
    setSpErr(msg);
  };

  const onSpotifyConnect = async () => {
    setSpErr('');
    try { await spotify.beginAuth(); } catch (e) { setSpErr(e.message || String(e)); }
  };

  const onSpotifyDisconnect = async () => {
    if (!confirm(`Spotify ${t.confirmDisconnect}`)) return;
    await removeConnection('spotify');
    setSpotifyConnected(false);
    setSpPlaylists([]); setSpSelectedPlaylist(null); setSpPlaylistTracks([]); setSpTrack(null); setSpPlaying(false); setSpPremiumRequired(false);
  };

  const ensureSpotifyDevice = async (continuePlay = true) => {
    if (!spDeviceIdRef.current) return;
    try { await spotify.transferPlayback(spDeviceIdRef.current, continuePlay); await new Promise(r => setTimeout(r, 600)); } catch (e) {}
  };

  const onSelectSpPlaylist = async (pl) => {
    setSpPlaylistDropdownOpen(false);
    setSpSelectedPlaylist(pl);
    setSpPlaylistTracks([]);
    try {
      if (spPremiumRequired) { window.open(pl.external_urls?.spotify || `https://open.spotify.com/playlist/${pl.id}`, '_blank'); return; }
      await ensureSpotifyDevice(false);
      await spotify.playPlaylist(pl.id, spDeviceIdRef.current);
      spotify.getPlaylistTracks(pl.id).then(setSpPlaylistTracks).catch(() => {});
    } catch (e) { setSafeSpErr(e); }
  };

  const spTogglePlay = async () => {
    try {
      await spotify.sdkActivate();
      if (spPlaying) { await spotify.sdkPause(); }
      else {
        const state = await spotify.getSdkState();
        if (state) { await spotify.sdkResume(); }
        else {
          try { await spotify.sdkResume(); } catch (e) {}
          await ensureSpotifyDevice(true);
          try { await spotify.resume(spDeviceIdRef.current); } catch (e) {}
          for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 300));
            const s = await spotify.getSdkState();
            if (s) { if (s.paused) try { await spotify.sdkResume(); } catch (e) {} break; }
          }
        }
      }
    } catch (e) { setSafeSpErr(e); }
  };

  const spSkipNext = async () => {
    try {
      const state = await spotify.getSdkState();
      if (state) await spotify.sdkNext();
      else { await ensureSpotifyDevice(true); await spotify.next(spDeviceIdRef.current); }
    } catch (e) { setSafeSpErr(e); }
  };

  const spSkipPrev = async () => {
    try {
      const state = await spotify.getSdkState();
      if (state) await spotify.sdkPrevious();
      else { await ensureSpotifyDevice(true); await spotify.previous(spDeviceIdRef.current); }
    } catch (e) { setSafeSpErr(e); }
  };

  const spSeekCommit = async (ms) => {
    setSpSeeking(false); setSpPosition(ms);
    try {
      const s = await spotify.getSdkState();
      if (s) await spotify.sdkSeek(ms);
      else await spotify.seek(ms, spDeviceIdRef.current);
    } catch (e) { setSafeSpErr(e); }
  };

  const spPlayTrackFromList = async (tr, idx) => {
    if (!spSelectedPlaylist) return;
    try {
      await spotify.sdkActivate();
      await ensureSpotifyDevice(false);
      const q = spDeviceIdRef.current ? `?device_id=${spDeviceIdRef.current}` : '';
      await fetch('https://api.spotify.com/v1/me/player/play' + q, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + (await spotify.getValidToken()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_uri: `spotify:playlist:${spSelectedPlaylist.id}`, offset: { position: idx } }),
      });
    } catch (e) { setSafeSpErr(e); }
  };

  const onPickSpSearchResult = async (tr) => {
    try {
      await spotify.sdkActivate();
      await ensureSpotifyDevice(false);
      await spotify.playTrackInContext(tr, spDeviceIdRef.current);
      setSpSelectedPlaylist(null);
      setSpSearchOpen(false); setSpSearchQuery(''); setSpSearchResults([]);
    } catch (e) { setSafeSpErr(e); }
  };

  const spPlName = spSelectedPlaylist ? spSelectedPlaylist.name : null;
  const spPlImage = spSelectedPlaylist ? spSelectedPlaylist.images?.[0]?.url : null;
  const spProgressPct = spDuration > 0 ? Math.min(100, ((spSeeking ? spSeekValue : spPosition) / spDuration) * 100) : 0;

  return (
    <>
      {/* Trigger button */}
      {(() => {
        const nowTrack = (spPlaying && spTrack) ? spTrack : (ytPlaying && ytTrack) ? ytTrack : null;
        return (
          <button
            onClick={() => isMobile() ? setMobileAlert(true) : setIsOpen(v => !v)}
            title={t.musicPlayer}
            style={{
              position: 'fixed', bottom: 20, left: 20, zIndex: 51,
              height: 48, minWidth: 48,
              width: nowTrack ? 'auto' : 48, maxWidth: 260,
              padding: nowTrack ? '0 14px 0 6px' : 0,
              borderRadius: 999, cursor: 'pointer',
              border: AC.border ? `1px solid ${AC.border}` : 'none',
              backgroundColor: AC.card || '#1a1a1a', color: AC.text || '#fff',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {nowTrack ? (
              <>
                {nowTrack.albumArt ? (
                  <img src={nowTrack.albumArt} alt="" width={36} height={36} style={{ borderRadius: '50%', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: SPOTIFY_GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Music size={16} color="#000" />
                  </div>
                )}
                <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600 }}>
                  {nowTrack.name}
                </div>
              </>
            ) : (
              <Music size={20} />
            )}
          </button>
        );
      })()}

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
          position: 'fixed', bottom: 78, left: 20, zIndex: 52,
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
          transformOrigin: 'bottom left',
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
          <div style={{ display: 'flex', gap: 2 }}>
            {activeTab === 'spotify' && spotifyConnected && (
              <>
                <button onClick={() => setSpSearchOpen(v => !v)} title={t.searchTracks} style={iconBtn(spSearchOpen ? SPOTIFY_GREEN : (AC.textMid || '#999'))}>
                  <Search size={13} />
                </button>
              </>
            )}
            <button onClick={() => setIsOpen(false)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', backgroundColor: 'transparent', color: AC.textMid || '#999', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
          {activeTab === 'spotify' ? (
            !spotifyConnected ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: AC.textMid || '#888', marginBottom: 14, whiteSpace: 'pre-line' }}>{t.spotifyConnect}</div>
                <button onClick={onSpotifyConnect} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 999,
                  backgroundColor: '#1DB954', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                }}>
                  <SpotifyIcon size={16} color="#000" /><span>Spotify {t.connectProvider}</span>
                </button>
                {spErr && <div style={{ marginTop: 12, fontSize: 11, color: '#FCA5A5' }}>{spErr}</div>}
              </div>
            ) : (
              <>
                {/* Playlist selector — always visible */}
                <div style={{ padding: '10px 14px 0', flexShrink: 0 }}>
                  <button onClick={() => setSpPlaylistDropdownOpen(v => !v)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: 6,
                    backgroundColor: AC.hover || 'rgba(255,255,255,0.06)', border: `1px solid ${AC.border || 'rgba(255,255,255,0.08)'}`,
                    color: AC.text || '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: spSelectedPlaylist ? (AC.text || '#fff') : (AC.textMid || '#888') }}>
                      {spBusy ? t.loading : (spSelectedPlaylist ? spSelectedPlaylist.name : t.selectPlaylist)}
                    </span>
                    <ChevronDown size={14} color={AC.textMid || '#888'} />
                  </button>
                </div>
                {spPlaylistDropdownOpen && spPlaylists.length > 0 && (
                  <div style={{ maxHeight: 240, overflowY: 'auto', margin: '4px 14px 0', borderRadius: 6, border: `1px solid ${AC.border || 'rgba(255,255,255,0.06)'}`, flexShrink: 0 }}>
                    {spPlaylists.map(p => {
                      const isActive = spSelectedPlaylist?.id === p.id;
                      const thumb = p.images?.[0]?.url;
                      return (
                        <button key={p.id} onClick={() => onSelectSpPlaylist(p)} style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                          border: 'none', background: isActive ? (AC.hover || 'rgba(255,255,255,0.06)') : 'transparent',
                          color: AC.text || '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 12, transition: 'background 0.1s',
                        }}>
                          {thumb && <img src={thumb} alt="" width={32} height={32} style={{ borderRadius: 4, flexShrink: 0, objectFit: 'cover' }} />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isActive ? 700 : 400 }}>{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {spPlaylistDropdownOpen && spPlaylists.length === 0 && !spBusy && (
                  <div style={{ padding: '12px 14px', fontSize: 11, color: AC.textMid || '#888', textAlign: 'center' }}>
                    {t.noTrack}
                  </div>
                )}

                {/* Search panel */}
                {spSearchOpen && (
                  <div style={{ padding: '10px 14px', borderBottom: `1px solid ${AC.border || 'rgba(255,255,255,0.06)'}`, flexShrink: 0 }}>
                    <div style={{ position: 'relative', marginBottom: spSearchResults.length > 0 || spSearching ? 8 : 0 }}>
                      <Search size={12} color={AC.textDim || '#666'} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                      <input autoFocus type="text" value={spSearchQuery} onChange={(e) => setSpSearchQuery(e.target.value)} placeholder={t.searchPlaceholder}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 28px', borderRadius: 6, backgroundColor: AC.hover || 'rgba(255,255,255,0.06)', border: `1px solid ${AC.border || 'rgba(255,255,255,0.08)'}`, color: AC.text || '#fff', fontSize: 12, outline: 'none' }}
                      />
                    </div>
                    {(spSearching || spSearchResults.length > 0) && (
                      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {spSearching ? <div style={{ padding: 10, fontSize: 11, color: AC.textDim || '#666', textAlign: 'center' }}>{t.searching}</div>
                        : spSearchResults.map(tr => (
                          <button key={tr.id} onClick={() => onPickSpSearchResult(tr)} style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px',
                            border: 'none', background: 'transparent', color: AC.text || '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 12,
                          }}>
                            {tr.album?.images?.[2]?.url && <img src={tr.album.images[2].url} alt="" width={28} height={28} style={{ borderRadius: 3, flexShrink: 0 }} />}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.name}</div>
                              <div style={{ fontSize: 10, color: AC.textMid || '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(tr.artists || []).map(a => a.name).join(', ')}</div>
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
                    {spPlImage ? (
                      <img src={spPlImage} alt="" width={100} height={100} style={{ borderRadius: 8, flexShrink: 0, objectFit: 'cover' }} />
                    ) : spTrack?.albumArt ? (
                      <img src={spTrack.albumArt} alt="" width={100} height={100} style={{ borderRadius: 8, flexShrink: 0, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 100, height: 100, borderRadius: 8, backgroundColor: AC.hover || 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Music size={32} color={AC.textDim || '#444'} />
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {spPlName || spTrack?.name || t.noTrack}
                      </div>
                      {spPlName && spTrack?.name && (
                        <div style={{ fontSize: 12, color: AC.textMid || '#aaa', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {spTrack.name} — {spTrack.artist}
                        </div>
                      )}
                      {!spPlName && spTrack?.artist && (
                        <div style={{ fontSize: 12, color: AC.textMid || '#aaa', marginTop: 4 }}>{spTrack.artist}</div>
                      )}
                      {spPremiumRequired && (
                        <div style={{ fontSize: 10, color: AC.textMid || '#888', marginTop: 6 }}>{t.spotifyPremium}</div>
                      )}
                    </div>
                  </div>

                  {/* Progress */}
                  {!spPremiumRequired && spDuration > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ position: 'relative', height: 4, backgroundColor: AC.hover || 'rgba(255,255,255,0.1)', borderRadius: 2, cursor: 'pointer' }}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                          spSeekCommit(pct * spDuration);
                        }}
                      >
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${spProgressPct}%`, backgroundColor: SPOTIFY_GREEN, borderRadius: 2, transition: spSeeking ? 'none' : 'width 0.3s linear' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: AC.textDim || '#666', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                        <span>{fmtDuration(spSeeking ? spSeekValue : spPosition)}</span>
                        <span>{fmtDuration(spDuration)}</span>
                      </div>
                    </div>
                  )}

                  {/* Controls */}
                  {!spPremiumRequired && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                      <button onClick={spSkipPrev} style={ctrlBtn(AC.text || '#ccc')} title={t.prevTrack}><SkipBack size={18} /></button>
                      <button onClick={spTogglePlay} title={spPlaying ? t.pause : t.play}
                        style={{
                          width: 48, height: 48, borderRadius: '50%', border: 'none',
                          backgroundColor: SPOTIFY_GREEN, color: '#000', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {spPlaying ? <Pause size={22} fill="#000" /> : <Play size={22} fill="#000" style={{ marginLeft: 2 }} />}
                      </button>
                      <button onClick={spSkipNext} style={ctrlBtn(AC.text || '#ccc')} title={t.nextTrack}><SkipForward size={18} /></button>
                    </div>
                  )}
                </div>

                {/* Track list */}
                {spPlaylistTracks.length > 0 && (
                  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: `1px solid ${AC.border || 'rgba(255,255,255,0.06)'}` }}>
                    {spPlaylistTracks.map((tr, i) => {
                      const isCurrent = spTrack?.uri === tr.uri;
                      return (
                        <button key={tr.id + '-' + i} onClick={() => spPlayTrackFromList(tr, i)} style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                          border: 'none', background: isCurrent ? (AC.hover || 'rgba(255,255,255,0.06)') : 'transparent',
                          color: isCurrent ? SPOTIFY_GREEN : (AC.text || '#ddd'), cursor: 'pointer', textAlign: 'left',
                          transition: 'background 0.1s',
                        }}>
                          <span style={{ width: 20, textAlign: 'center', fontSize: 12, color: isCurrent ? SPOTIFY_GREEN : (AC.textDim || '#666'), fontWeight: isCurrent ? 700 : 400, flexShrink: 0 }}>
                            {isCurrent && spPlaying ? '♪' : i + 1}
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.name}</div>
                            <div style={{ fontSize: 11, color: AC.textMid || '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {(tr.artists || []).map(a => a.name).join(', ')}
                            </div>
                          </div>
                          <span style={{ fontSize: 12, color: AC.textDim || '#666', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtDuration(tr.duration_ms)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {spErr && (
                  <div style={{ padding: '8px 16px', fontSize: 11, color: '#FCA5A5', backgroundColor: 'rgba(248,113,113,0.08)', borderTop: `1px solid ${AC.border || 'rgba(255,255,255,0.06)'}` }}>
                    {spErr}
                    <button onClick={() => setSpErr('')} style={{ float: 'right', background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', padding: 0, fontSize: 14 }}>×</button>
                  </div>
                )}

                {/* Prompt to select playlist */}
                {!spSelectedPlaylist && !spBusy && spPlaylists.length > 0 && (
                  <div style={{ padding: '20px 16px', textAlign: 'center', color: AC.textDim || '#666', fontSize: 12 }}>
                    {t.selectPlaylist}
                  </div>
                )}
                {spBusy && (
                  <div style={{ padding: '20px 16px', textAlign: 'center', color: AC.textDim || '#666', fontSize: 12 }}>
                    {t.loading}
                  </div>
                )}

                {/* Disconnect */}
                <div style={{ padding: '12px 16px', textAlign: 'center', flexShrink: 0 }}>
                  <button onClick={onSpotifyDisconnect}
                    style={{ fontSize: 11, color: AC.textDim || '#666', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', opacity: 0.7 }}>{t.disconnect}</button>
                </div>
              </>
            )
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
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
  };
}
