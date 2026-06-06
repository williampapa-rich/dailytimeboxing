import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchTimeboxRange } from './supabase.js';
import { useAuthUser } from './auth.js';

function minToHHMM(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDuration(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Intensity levels: 0=empty, 1-4 progressively darker
function getIntensity(minutes) {
  if (!minutes || minutes <= 0) return 0;
  if (minutes <= 60) return 1;
  if (minutes <= 120) return 2;
  if (minutes <= 240) return 3;
  return 4;
}

function intensityColor(level, accent) {
  // Parse hex accent to RGB
  const hex = accent.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const alphas = [0, 0.2, 0.42, 0.66, 0.9];
  const a = alphas[level] || 0;
  return `rgba(${r},${g},${b},${a})`;
}

export function StatsSection({ C, t, lang, isLoggedIn }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-indexed
  const [heatmap, setHeatmap] = useState({}); // { 'YYYY-MM-DD': totalDoneMinutes }
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null); // 'YYYY-MM-DD'
  const [dayBoxes, setDayBoxes] = useState([]); // done boxes for selected day

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    setLoading(true);
    setHeatmap({});
    setSelectedDay(null);
    setDayBoxes([]);

    const start = new Date(viewYear, viewMonth, 1);
    const end = new Date(viewYear, viewMonth + 1, 0);
    const startStr = toYMD(start);
    const endStr = toYMD(end);

    fetchTimeboxRange(startStr, endStr).then(rangeData => {
      if (cancelled) return;
      const map = {};
      for (const [dateStr, boxes] of Object.entries(rangeData)) {
        const doneMin = (boxes || []).reduce((acc, b) => {
          if (b.done) return acc + ((b.end ?? 0) - (b.start ?? 0));
          return acc;
        }, 0);
        if (doneMin > 0) map[dateStr] = doneMin;
      }
      setHeatmap(map);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [isLoggedIn, viewYear, viewMonth]);

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const totalDays = lastDay.getDate();
  // Start week on Monday (1), so shift: Sunday(0)->6, Mon(1)->0, ...
  const startDow = (firstDay.getDay() + 6) % 7; // 0=Mon ... 6=Sun
  const cells = []; // null = empty, string = 'YYYY-MM-DD'
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) {
    cells.push(toYMD(new Date(viewYear, viewMonth, d)));
  }
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const handleDayClick = (dateStr) => {
    if (!dateStr) return;
    setSelectedDay(dateStr);
    fetchTimeboxRange(dateStr, dateStr).then(data => {
      const boxes = (data[dateStr] || []).filter(b => b.done);
      setDayBoxes(boxes);
    }).catch(() => setDayBoxes([]));
  };

  const monthNames = {
    ko: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    zh: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    es: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
    ja: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
  };

  // Day-of-week headers Mon~Sun using t.days (Sun=0…Sat=6), reorder to Mon-first
  const dowLabels = [t.days[1], t.days[2], t.days[3], t.days[4], t.days[5], t.days[6], t.days[0]];

  const CELL = 16;
  const GAP = 3;

  // Stats for selected day
  let totalDoneMin = 0, earliestStart = null, latestEnd = null;
  if (selectedDay && dayBoxes.length > 0) {
    for (const b of dayBoxes) {
      totalDoneMin += (b.end ?? 0) - (b.start ?? 0);
      if (earliestStart === null || b.start < earliestStart) earliestStart = b.start;
      if (latestEnd === null || b.end > latestEnd) latestEnd = b.end;
    }
  }

  const monthLabel = (() => {
    const names = monthNames[lang] || monthNames['en'];
    const cjk = ['ko', 'zh', 'ja'].includes(lang);
    const yearSuffix = lang === 'ko' ? '년 ' : lang === 'zh' ? '年 ' : lang === 'ja' ? '年 ' : ' ';
    return cjk ? `${viewYear}${yearSuffix}${names[viewMonth]}` : `${names[viewMonth]} ${viewYear}`;
  })();

  if (!isLoggedIn) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: C.textMid }}>{t.statsNotLoggedIn}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button
          onClick={goToPrevMonth}
          aria-label={t.statsPrevMonth}
          style={{ width: 28, height: 28, borderRadius: 6, border: 'none', backgroundColor: C.hover, color: C.textMid, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s' }}
          onMouseEnter={e => e.currentTarget.style.color = C.text}
          onMouseLeave={e => e.currentTarget.style.color = C.textMid}
        >
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{monthLabel}</span>
        <button
          onClick={goToNextMonth}
          aria-label={t.statsNextMonth}
          style={{ width: 28, height: 28, borderRadius: 6, border: 'none', backgroundColor: C.hover, color: C.textMid, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s' }}
          onMouseEnter={e => e.currentTarget.style.color = C.text}
          onMouseLeave={e => e.currentTarget.style.color = C.textMid}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Heatmap grid */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'inline-block', minWidth: 'max-content' }}>
          {/* DOW headers */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${CELL}px)`, gap: GAP, marginBottom: 4 }}>
            {dowLabels.map((d, i) => (
              <div key={i} style={{ width: CELL, textAlign: 'center', fontSize: 9, color: C.textDim, fontWeight: 600 }}>{d}</div>
            ))}
          </div>
          {/* Calendar rows */}
          {loading ? (
            <div style={{ fontSize: 12, color: C.textDim, padding: '8px 0' }}>{t.loading}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${CELL}px)`, gap: GAP }}>
              {cells.map((dateStr, idx) => {
                if (!dateStr) return <div key={idx} style={{ width: CELL, height: CELL }} />;
                const mins = heatmap[dateStr] || 0;
                const level = getIntensity(mins);
                const isSelected = dateStr === selectedDay;
                const todayStr = toYMD(new Date());
                const isToday = dateStr === todayStr;
                return (
                  <div
                    key={dateStr}
                    title={`${dateStr}: ${mins}m`}
                    onClick={() => handleDayClick(dateStr)}
                    style={{
                      width: CELL, height: CELL, borderRadius: 3,
                      backgroundColor: level === 0 ? 'transparent' : intensityColor(level, C.accent),
                      border: isSelected
                        ? `2px solid ${C.accent}`
                        : isToday
                          ? `1.5px solid ${C.borderStrong}`
                          : `1px solid ${C.border}`,
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      transition: 'transform 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  />
                );
              })}
            </div>
          )}

          {/* Intensity legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <span style={{ fontSize: 9, color: C.textDim }}>0m</span>
            {[0, 1, 2, 3, 4].map(lv => (
              <div key={lv} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: lv === 0 ? 'transparent' : intensityColor(lv, C.accent), border: `1px solid ${C.border}`, boxSizing: 'border-box' }} />
            ))}
            <span style={{ fontSize: 9, color: C.textDim }}>4h+</span>
          </div>
        </div>
      </div>

      {/* Stats cards for selected day */}
      {selectedDay && (
        <div style={{ marginTop: 20, padding: 16, backgroundColor: C.hover, borderRadius: 12, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textMid, marginBottom: 12 }}>{selectedDay}</div>
          {dayBoxes.length === 0 ? (
            <div style={{ fontSize: 13, color: C.textDim, textAlign: 'center', padding: '8px 0' }}>{t.statsNoData}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: t.statsTotalTime, value: formatDuration(totalDoneMin) },
                { label: t.total, value: `${dayBoxes.length}` },
                { label: t.statsStartTime, value: earliestStart !== null ? minToHHMM(earliestStart) : '--:--' },
                { label: t.statsFinishTime, value: latestEnd !== null ? minToHHMM(latestEnd) : '--:--' },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '10px 12px', backgroundColor: C.card, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, color: C.textMid, fontWeight: 500, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Full-screen view (like view/edit modes), opened from the FAB. Reuses the
// view↔edit transition animation and provides a back button in the header.
export function StatsView({ C, t, lang, onBack }) {
  const { user, loaded, isAnonymous } = useAuthUser();
  const isLoggedIn = loaded && !!user && !isAnonymous;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
      backgroundColor: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
      overflow: 'hidden', animation: 'dtb-fade-in 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      {/* Header: back + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button
          onClick={onBack}
          aria-label={t.close || 'Close'}
          style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'none', color: C.textMid, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s' }}
          onMouseEnter={e => e.currentTarget.style.color = C.text}
          onMouseLeave={e => e.currentTarget.style.color = C.textMid}
        >
          <ChevronLeft size={20} />
        </button>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: C.text }}>{t.stats}</h2>
      </div>
      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20 }}>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <StatsSection C={C} t={t} lang={lang} isLoggedIn={isLoggedIn} />
        </div>
      </div>
    </div>
  );
}
