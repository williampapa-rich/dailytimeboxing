import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { Pencil, Eye, Trash2, Plus, Save, Check, X, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Settings, Share2, Link, MessageCircle, Send } from 'lucide-react';
import SettingsPanel from "./SettingsPanel.jsx";
import { THEMES, DEFAULT_THEME } from './themes.js';
import MusicPlayer from "./MusicPlayer.jsx";

const SLOTS_PER_DAY = 48;
const VISIBLE_SLOTS = 4;
const SLOT_HEIGHT = 36;
const TIME_LABEL_WIDTH = 56;
const ROW_HORIZONTAL_MARGIN = 4;
const ROW_VERTICAL_MARGIN = 2;
const MINUTES_PER_DAY = 1440;
const MIN_PER_SLOT = 30;


const CLAUDE_COLORS = [
  '#D97757', '#C9A88C', '#A4B07F', '#7FA8A4',
  '#7B8794', '#B58FA4', '#B8633D', '#E0CFA3',
];

const pad2 = (n) => String(n).padStart(2, '0');

const minToTime = (min) => {
  const m = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(min)));
  if (m === MINUTES_PER_DAY) return '24:00';
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
};

const timeToMin = (str) => {
  if (!str || typeof str !== 'string') return null;
  const match = str.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || m < 0 || m >= 60) return null;
  if (h === 24 && m !== 0) return null;
  if (h > 24) return null;
  return h * 60 + m;
};

const formatRange = (start, end) => `${minToTime(start)} - ${minToTime(end)}`;

const getDateKey = (d = new Date()) => {
  return `timeboxes:${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
};

const formatDate = (d = new Date()) => {
  const w = ['일','월','화','수','목','금','토'];
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${w[d.getDay()]})`;
};

const toDateString = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;

const isToday = (d) => toDateString(d) === toDateString(new Date());

const shiftDate = (d, days) => {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
};

const getCurrentMin = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60000;
};

const currentTimeHMS = () => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

const formatHMS = (seconds) => {
  const total = Math.max(0, Math.floor(seconds));
  return `${pad2(Math.floor(total / 3600))}:${pad2(Math.floor((total % 3600) / 60))}:${pad2(total % 60)}`;
};

const getContrastText = (hex) => {
  if (!hex || hex.length < 7) return '#FFFFFF';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 170 ? '#1F1E1D' : '#FFFFFF';
};

const newId = (p = 'id') => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;

// Migrate old slot-based boxes to minute-based
const migrateBox = (b) => {
  if (typeof b.start === 'number' && typeof b.end === 'number') return b;
  if (typeof b.startSlot === 'number' && typeof b.endSlot === 'number') {
    return {
      ...b,
      start: b.startSlot * MIN_PER_SLOT,
      end: (b.endSlot + 1) * MIN_PER_SLOT,
    };
  }
  return b;
};

const URGENT_THRESHOLD_SEC = 300;

const getTimerInfo = (boxes) => {
  const nowMin = getCurrentMin();
  const cur = boxes.find(b => nowMin >= b.start && nowMin < b.end);
  if (cur) {
    const remaining = Math.max(0, (cur.end - nowMin) * 60);
    const total = cur.end - cur.start;
    const elapsed = nowMin - cur.start;
    const progress = Math.min(1, Math.max(0, elapsed / total));
    return { type: 'current', box: cur, remaining, progress, urgent: remaining <= URGENT_THRESHOLD_SEC };
  }
  const upcoming = boxes.filter(b => b.start > nowMin).sort((a, b) => a.start - b.start);
  if (upcoming.length > 0) {
    const next = upcoming[0];
    const remaining = Math.max(0, (next.start - nowMin) * 60);
    return { type: 'next', box: next, remaining, urgent: remaining <= URGENT_THRESHOLD_SEC };
  }
  return { type: 'idle' };
};

export default function App() {
  const [mode, setMode] = useState('view');
  const [themeId, setThemeId] = useState(DEFAULT_THEME);
  const [opacity, setOpacity] = useState(0.3);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const [drag, setDrag] = useState({ anchor: null, current: null, didDrag: false });
  const [boxDrag, setBoxDrag] = useState(null);
  const [pendingClick, setPendingClick] = useState(null);
  const [hover, setHover] = useState(null);
  const [editing, setEditing] = useState(null);
  const [sel, setSel] = useState(null);
  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fColor, setFColor] = useState(CLAUDE_COLORS[0]);
  const [fStart, setFStart] = useState('');
  const [fEnd, setFEnd] = useState('');
  const [fTasks, setFTasks] = useState([{ id: newId('t'), text: '', done: false }]);
  const [error, setError] = useState('');

  const viewElRef = useRef(null);
  const viewObserverRef = useRef(null);
  const lastScrollRef = useRef(0);
  const progRef = useRef(0);
  const [cw, setCw] = useState(0);
  const alertedRef = useRef({});

  const measureView = useCallback(() => {
    const el = viewElRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w > 0) setCw(prev => (w === prev ? prev : w));
  }, []);

  const viewRef = useCallback((node) => {
    if (viewObserverRef.current) {
      viewObserverRef.current.disconnect();
      viewObserverRef.current = null;
    }
    viewElRef.current = node;
    if (!node) return;
    measureView();
    requestAnimationFrame(() => {
      measureView();
      requestAnimationFrame(measureView);
    });
    const o = new ResizeObserver(measureView);
    o.observe(node);
    viewObserverRef.current = o;
  }, [measureView]);

  const currentTheme = THEMES[themeId] || THEMES[DEFAULT_THEME];
  const baseC = currentTheme.colors;
  const C = { ...baseC };
  // Apply user opacity to semi-transparent surfaces
  const scaleAlpha = (rgba, factor) => {
    const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]*)\)/);
    if (!m) return rgba;
    const a = m[4] ? parseFloat(m[4]) * factor : factor;
    return `rgba(${m[1]},${m[2]},${m[3]},${Math.min(1, a).toFixed(2)})`;
  };
  C.bg = scaleAlpha(baseC.bg, opacity / 0.85);
  C.card = scaleAlpha(baseC.card, opacity / 0.85);
  C.cardAlt = scaleAlpha(baseC.cardAlt, opacity / 0.85);
  C.inputBg = scaleAlpha(baseC.inputBg, opacity / 0.85);
  const theme = C.scheme;
  const sw = cw / VISIBLE_SLOTS;
  const tw = sw * SLOTS_PER_DAY;

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch (e) {} };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const t = await window.storage.get('dtb-theme');
        if (t?.value && THEMES[t.value]) setThemeId(t.value);
        const o = await window.storage.get('dtb-opacity');
        if (o?.value) { const v = parseFloat(o.value); if (v >= 0.1 && v <= 1) setOpacity(v); }
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    closeEdit();
    let cancelled = false;
    (async () => {
      try {
        const r = await window.storage.get(getDateKey(selectedDate));
        if (!cancelled) setBoxes(r?.value ? (JSON.parse(r.value) || []).map(migrateBox) : []);
      } catch (e) {
        if (!cancelled) setBoxes([]);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedDate]);

  const changeTheme = async (id) => {
    if (!THEMES[id]) return;
    setThemeId(id);
    try { await window.storage.set('dtb-theme', id); } catch (e) {}
  };

  const changeOpacity = async (val) => {
    setOpacity(val);
    try { await window.storage.set('dtb-opacity', String(val)); } catch (e) {}
  };

  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  // 알림 권한 요청은 사용자 제스처 안에서만 가능 — 자동 호출 제거

  useEffect(() => {
    const info = getTimerInfo(boxes);
    if (!info.urgent || (info.type !== 'current' && info.type !== 'next')) return;
    const key = `${info.type}:${info.box.id}`;
    if (alertedRef.current[key]) return;
    alertedRef.current[key] = true;
    const title = info.type === 'current'
      ? `⏰ "${info.box.title}" 종료 5분 전`
      : `⏰ "${info.box.title}" 시작 5분 전`;
    const body = info.type === 'current'
      ? `${minToTime(info.box.end)}에 종료됩니다`
      : `${minToTime(info.box.start)}에 시작됩니다`;
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    } catch (e) {}
  });

  const save = async (b) => {
    setBoxes(b);
    try { await window.storage.set(getDateKey(selectedDate), JSON.stringify(b)); } catch (e) {}
  };

  const overlaps = (start, end, exc = null) =>
    boxes.some(b => b.id !== exc && !(end <= b.start || start >= b.end));

  const openEdit = (data) => {
    setSel({ start: data.start, end: data.end });
    setEditing(data.id ? data : null);
    setFTitle(data.title || '');
    setFDesc(data.description || '');
    setFColor(data.color || CLAUDE_COLORS[0]);
    setFStart(minToTime(data.start));
    setFEnd(minToTime(data.end));
    setFTasks(
      data.tasks && data.tasks.length > 0
        ? data.tasks.map(t => ({ ...t }))
        : [{ id: newId('t'), text: '', done: false }]
    );
    setError('');
  };

  const closeEdit = () => {
    setSel(null);
    setEditing(null);
    setFTitle('');
    setFDesc('');
    setFColor(CLAUDE_COLORS[0]);
    setFStart('');
    setFEnd('');
    setFTasks([{ id: newId('t'), text: '', done: false }]);
    setPendingClick(null);
    setError('');
  };

  const onSlotDown = (slot, e) => {
    e.preventDefault();
    setDrag({ anchor: slot, current: slot, didDrag: false });
  };

  const onSlotEnter = (slot) => {
    setHover(slot);
    if (drag.anchor !== null) {
      setDrag(p => ({ ...p, current: slot, didDrag: p.didDrag || slot !== p.anchor }));
    }
  };

  const onBoxMouseDown = (box, e) => {
    e.stopPropagation();
    e.preventDefault();
    setBoxDrag({
      id: box.id,
      origStart: box.start,
      origEnd: box.end,
      startY: e.clientY,
      offset: 0,
      moved: false,
      conflict: false,
    });
    setDrag({ anchor: null, current: null, didDrag: false });
    setPendingClick(null);
  };

  useEffect(() => {
    if (!boxDrag) return;
    const onMove = (e) => {
      const dy = e.clientY - boxDrag.startY;
      const slotDelta = Math.round(dy / SLOT_HEIGHT);
      const offset = slotDelta * MIN_PER_SLOT;
      const newStart = boxDrag.origStart + offset;
      const newEnd = boxDrag.origEnd + offset;
      const inBounds = newStart >= 0 && newEnd <= MINUTES_PER_DAY;
      const conflict = inBounds && boxes.some(b =>
        b.id !== boxDrag.id && !(newEnd <= b.start || newStart >= b.end)
      );
      setBoxDrag(prev => prev && ({
        ...prev,
        offset: inBounds ? offset : prev.offset,
        moved: prev.moved || Math.abs(dy) > 4,
        conflict,
      }));
    };
    const onUp = () => {
      setBoxDrag(prev => {
        if (!prev) return null;
        const original = boxes.find(b => b.id === prev.id);
        if (!prev.moved) {
          if (original) openEdit(original);
        } else if (prev.offset !== 0 && !prev.conflict && original) {
          const moved = {
            ...original,
            start: prev.origStart + prev.offset,
            end: prev.origEnd + prev.offset,
          };
          save(boxes.map(b => b.id === prev.id ? moved : b));
        }
        return null;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [boxDrag, boxes]);

  useEffect(() => {
    const h = () => {
      if (drag.anchor === null) return;
      const { anchor, current, didDrag } = drag;
      const minSlot = Math.min(anchor, current);
      const maxSlot = Math.max(anchor, current);

      if (didDrag) {
        const start = minSlot * MIN_PER_SLOT;
        const end = (maxSlot + 1) * MIN_PER_SLOT;
        if (overlaps(start, end)) {
          setError('이미 다른 타임박스가 있는 시간대입니다');
          setTimeout(() => setError(''), 2500);
        } else {
          openEdit({ start, end });
          setPendingClick(null);
        }
      } else {
        if (pendingClick === null) {
          setPendingClick(anchor);
        } else {
          const ms = Math.min(pendingClick, anchor);
          const Ms = Math.max(pendingClick, anchor);
          const start = ms * MIN_PER_SLOT;
          const end = (Ms + 1) * MIN_PER_SLOT;
          if (overlaps(start, end)) {
            setError('이미 다른 타임박스가 있는 시간대입니다');
            setTimeout(() => setError(''), 2500);
            setPendingClick(null);
          } else {
            openEdit({ start, end });
            setPendingClick(null);
          }
        }
      }
      setDrag({ anchor: null, current: null, didDrag: false });
    };
    document.addEventListener('mouseup', h);
    return () => document.removeEventListener('mouseup', h);
  }, [drag, pendingClick, boxes]);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') closeEdit(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const doSave = () => {
    if (!fTitle.trim()) { setError('제목을 입력해주세요'); return; }
    const start = timeToMin(fStart);
    const end = timeToMin(fEnd);
    if (start === null || end === null) {
      setError('올바른 시간 형식이 아닙니다 (HH:MM)');
      return;
    }
    if (end <= start) {
      setError('종료 시간이 시작 시간보다 늦어야 합니다');
      return;
    }
    if (overlaps(start, end, editing?.id)) {
      setError('이미 다른 타임박스가 있는 시간대입니다');
      return;
    }
    const validTasks = fTasks
      .filter(t => t.text.trim())
      .map(t => ({ id: t.id, text: t.text.trim(), done: !!t.done }));
    const nb = {
      id: editing?.id || newId('tb'),
      start, end,
      title: fTitle.trim(),
      description: fDesc.trim(),
      color: fColor,
      tasks: validTasks
    };
    save(editing ? boxes.map(b => b.id === editing.id ? nb : b) : [...boxes, nb]);
    closeEdit();
  };

  const doDelete = () => {
    if (!editing) return;
    save(boxes.filter(b => b.id !== editing.id));
    closeEdit();
  };

  // Task helpers
  const addTask = () => {
    const id = newId('t');
    const item = { id, text: '', done: false };
    setFTasks(prev => prev.some(t => t.id === id) ? prev : [...prev, item]);
    setTimeout(() => document.getElementById(`task-input-${id}`)?.focus(), 30);
  };
  const addTaskAfter = (idx) => {
    const id = newId('t');
    const item = { id, text: '', done: false };
    setFTasks(prev => prev.some(t => t.id === id) ? prev : [...prev.slice(0, idx + 1), item, ...prev.slice(idx + 1)]);
    setTimeout(() => document.getElementById(`task-input-${id}`)?.focus(), 30);
  };
  const updateTaskText = (id, text) => setFTasks(prev => prev.map(t => t.id === id ? { ...t, text } : t));
  const toggleTask = (id) => setFTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const removeTask = (id) => setFTasks(prev => {
    const f = prev.filter(t => t.id !== id);
    return f.length === 0 ? [{ id: newId('t'), text: '', done: false }] : f;
  });

  const toggleTaskInBox = (boxId, taskId) => {
    save(boxes.map(b => b.id !== boxId ? b : {
      ...b,
      tasks: (b.tasks || []).map(t => t.id === taskId ? { ...t, done: !t.done } : t)
    }));
  };

  // Display range uses form fields when sel is open
  const displayRange = (() => {
    if (drag.anchor !== null) {
      return {
        start: Math.min(drag.anchor, drag.current) * MIN_PER_SLOT,
        end: (Math.max(drag.anchor, drag.current) + 1) * MIN_PER_SLOT
      };
    }
    if (pendingClick !== null && hover !== null) {
      return {
        start: Math.min(pendingClick, hover) * MIN_PER_SLOT,
        end: (Math.max(pendingClick, hover) + 1) * MIN_PER_SLOT
      };
    }
    if (pendingClick !== null) {
      return { start: pendingClick * MIN_PER_SLOT, end: (pendingClick + 1) * MIN_PER_SLOT };
    }
    if (sel) {
      const s = timeToMin(fStart);
      const e = timeToMin(fEnd);
      if (s !== null && e !== null && e > s) return { start: s, end: e };
      return { start: sel.start, end: sel.end };
    }
    return null;
  })();

  const rangeConflicts = displayRange && boxes.some(b =>
    b.id !== editing?.id && !(displayRange.end <= b.start || displayRange.start >= b.end)
  );

  const getTarget = useCallback(() => (getCurrentMin() / MIN_PER_SLOT) * sw - cw / 2, [sw, cw]);

  const viewingToday = isToday(selectedDate);

  useLayoutEffect(() => {
    if (mode !== 'view' || !viewingToday) return;
    const el = viewElRef.current;
    if (!el || cw === 0) return;
    progRef.current = Date.now() + 500;
    el.scrollLeft = getTarget();
    lastScrollRef.current = 0;
  }, [mode, cw, getTarget, viewingToday]);

  useEffect(() => {
    if (mode !== 'view' || !viewingToday) return;
    const interval = setInterval(() => {
      const el = viewElRef.current;
      if (!el) return;
      const since = Date.now() - lastScrollRef.current;
      const should = lastScrollRef.current === 0 || since >= 5000;
      if (!should) return;
      const target = getTarget();
      const diff = target - el.scrollLeft;
      if (Math.abs(diff) > 80) {
        progRef.current = Date.now() + 1500;
        el.scrollTo({ left: target, behavior: 'smooth' });
        lastScrollRef.current = 0;
      } else {
        progRef.current = Date.now() + 100;
        el.scrollLeft = target;
      }
    }, 500);
    return () => clearInterval(interval);
  }, [mode, getTarget, viewingToday]);

  useEffect(() => {
    if (mode !== 'view') return;
    const el = viewElRef.current;
    if (!el) return;
    const h = (e) => {
      e.preventDefault();
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      el.scrollLeft += d;
      lastScrollRef.current = Date.now();
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, [mode]);

  const onScroll = () => {
    if (Date.now() < progRef.current) return;
    lastScrollRef.current = Date.now();
  };

  return (
    <div className="dtb-root" onClick={() => shareOpen && setShareOpen(false)} style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: mode === 'edit' ? 'hidden' : 'auto', backgroundColor: C.bg, color: C.text, colorScheme: C.scheme, position: 'relative', opacity: loading ? 0 : 1, transition: 'opacity 0.4s ease' }}>
      {/* Background image */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: `url(${currentTheme.bgImage})`,
        backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
        pointerEvents: 'none',
      }} />
      <style>{`
        .dtb-root, .dtb-root * {
          font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif;
          box-sizing: border-box;
        }
        .dtb-root input, .dtb-root textarea, .dtb-root button { font-family: inherit; }
        .dtb-root input::placeholder, .dtb-root textarea::placeholder { color: ${C.textDim}; opacity: 1; }
        .dtb-no-scrollbar::-webkit-scrollbar { display: none; }
        .dtb-no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .dtb-tnum { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
        @keyframes dtb-fade-in {
          from { opacity: 0; transform: scale(0.98) translateY(6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .dtb-save-btn {
          background-color: ${C.accent};
          color: #FFFFFF !important;
          border: none;
          padding: 11px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          flex: 1;
          box-shadow: 0 1px 2px rgba(0,0,0,0.12);
          transition: background-color 0.15s;
        }
        .dtb-save-btn:hover { background-color: ${C.accentHover}; }
        .dtb-save-btn:active { background-color: ${C.accentActive}; }

        .dtb-cancel-btn {
          background-color: transparent;
          color: ${C.textMid};
          border: 1px solid ${C.border};
          padding: 11px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.15s;
        }
        .dtb-cancel-btn:hover { background-color: ${C.hover}; }

        .dtb-delete-btn {
          background-color: transparent;
          color: ${theme === 'dark' ? '#F87171' : '#DC2626'};
          border: 1px solid ${C.border};
          padding: 11px;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s;
        }
        .dtb-delete-btn:hover { background-color: ${theme === 'dark' ? 'rgba(248,113,113,0.12)' : '#FEF2F2'}; }

        .dtb-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid ${C.inputBorder};
          border-radius: 6px;
          font-size: 14px;
          background-color: ${C.inputBg};
          color: ${C.text};
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .dtb-input:focus {
          border-color: ${C.accent};
          box-shadow: 0 0 0 3px ${C.accent}33;
        }

        .dtb-time-input {
          padding: 8px 12px;
          border: 1px solid ${C.inputBorder};
          border-radius: 6px;
          font-size: 14px;
          background-color: ${C.inputBg};
          color: ${C.text};
          outline: none;
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum";
          text-align: center;
          font-weight: 600;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .dtb-time-input:focus {
          border-color: ${C.accent};
          box-shadow: 0 0 0 3px ${C.accent}33;
        }

        .dtb-task-input {
          flex: 1;
          padding: 7px 10px;
          border: 1px solid ${C.inputBorder};
          border-radius: 6px;
          background-color: ${C.inputBg};
          color: ${C.text};
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .dtb-task-input:focus {
          border-color: ${C.accent};
          box-shadow: 0 0 0 3px ${C.accent}33;
        }

        .dtb-add-task-btn {
          background: none;
          border: 1px dashed ${C.borderStrong};
          color: ${C.textMid};
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: all 0.15s;
          width: 100%;
          justify-content: center;
        }
        .dtb-add-task-btn:hover {
          border-color: ${C.accent};
          color: ${C.accent};
          background-color: ${C.cardAlt};
        }

        .dtb-icon-btn {
          padding: 8px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          background-color: ${C.hover};
          color: ${C.text};
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s;
        }
        .dtb-icon-btn:hover { background-color: ${C.borderStrong}; }

        @media (min-width: 1024px) {
          .dtb-form-panel {
            position: sticky;
            top: 80px;
            max-height: calc(100vh - 100px);
            overflow-y: auto;
          }
        }
      `}</style>

      <div style={{ flex: 1, minHeight: 0, maxWidth: 1032, margin: '0 auto', padding: '16px 24px', width: '100%', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', justifyContent: mode === 'view' ? 'center' : 'stretch', transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        {/* Navigation bar inside content */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12, flexShrink: 0,
        }}>
          <div style={{
            display: 'flex', gap: 2, padding: 3, borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)',
            backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            border: '1px solid rgba(255,255,255,0.25)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}>
            <button
              onClick={() => setMode('edit')}
              style={{
                padding: '6px 14px', borderRadius: 9, fontSize: 12, border: 'none', cursor: 'pointer',
                backgroundColor: mode === 'edit' ? 'rgba(255,255,255,0.28)' : 'transparent',
                color: mode === 'edit' ? C.text : C.textMid,
                fontWeight: mode === 'edit' ? 600 : 500,
                display: 'flex', alignItems: 'center', gap: 4,
                backdropFilter: mode === 'edit' ? 'blur(12px)' : 'none',
                boxShadow: mode === 'edit' ? '0 2px 8px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3)' : 'none',
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <Pencil size={11} />
              편집
            </button>
            <button
              onClick={() => { setMode('view'); closeEdit(); }}
              style={{
                padding: '6px 14px', borderRadius: 9, fontSize: 12, border: 'none', cursor: 'pointer',
                backgroundColor: mode === 'view' ? 'rgba(255,255,255,0.28)' : 'transparent',
                color: mode === 'view' ? C.text : C.textMid,
                fontWeight: mode === 'view' ? 600 : 500,
                display: 'flex', alignItems: 'center', gap: 4,
                backdropFilter: mode === 'view' ? 'blur(12px)' : 'none',
                boxShadow: mode === 'view' ? '0 2px 8px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3)' : 'none',
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <Eye size={11} />
              뷰
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setSelectedDate(d => shiftDate(d, -1))}
              style={{ background: C.hover, border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: C.text, display: 'flex', alignItems: 'center' }}
              title="이전 날짜"
            ><ChevronLeft size={16} /></button>
            <label style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={13} color={C.textMid} />
              <span style={{ fontSize: 13, color: isToday(selectedDate) ? C.text : C.accent, fontWeight: 600 }}>
                {formatDate(selectedDate)}
              </span>
              <input type="date" value={toDateString(selectedDate)}
                onChange={(e) => { const parts = e.target.value.split('-'); if (parts.length === 3) setSelectedDate(new Date(+parts[0], +parts[1] - 1, +parts[2])); }}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
              />
            </label>
            <button
              onClick={() => setSelectedDate(d => shiftDate(d, 1))}
              style={{ background: C.hover, border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: C.text, display: 'flex', alignItems: 'center' }}
              title="다음 날짜"
            ><ChevronRight size={16} /></button>
            {!isToday(selectedDate) && (
              <button onClick={() => setSelectedDate(new Date())}
                style={{ background: C.accent, border: 'none', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}
              >오늘</button>
            )}
          </div>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', color: C.textMid, padding: '80px 0' }}>불러오는 중...</div>
        ) : mode === 'edit' ? (
          <EditView
            C={C}
            boxes={boxes}
            isViewingToday={isToday(selectedDate)}
            displayRange={displayRange}
            rangeConflicts={rangeConflicts}
            onSlotDown={onSlotDown}
            onSlotEnter={onSlotEnter}
            onSlotLeave={() => setHover(null)}
            onBoxMouseDown={onBoxMouseDown}
            boxDrag={boxDrag}
            sel={sel}
            editing={editing}
            fTitle={fTitle}
            setFTitle={(v) => { setFTitle(v); setError(''); }}
            fDesc={fDesc} setFDesc={setFDesc}
            fColor={fColor} setFColor={setFColor}
            fStart={fStart} setFStart={(v) => { setFStart(v); setError(''); }}
            fEnd={fEnd} setFEnd={(v) => { setFEnd(v); setError(''); }}
            fTasks={fTasks}
            addTask={addTask}
            addTaskAfter={addTaskAfter}
            updateTaskText={updateTaskText}
            toggleTask={toggleTask}
            removeTask={removeTask}
            error={error}
            pendingClick={pendingClick}
            onSave={doSave}
            onDelete={doDelete}
            onCancel={closeEdit}
          />
        ) : (
          <ViewMode
            C={C}
            viewRef={viewRef}
            boxes={boxes}
            sw={sw}
            tw={tw}
            onScroll={onScroll}
            toggleTaskInBox={toggleTaskInBox}
            isViewingToday={isToday(selectedDate)}
            selectedDate={selectedDate}
          />
        )}
      </div>
      <MusicPlayer appColors={C} />
      {/* Share button — above settings */}
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', bottom: 76, right: 20, zIndex: 51 }}>
        <button
          onClick={() => setShareOpen(v => !v)}
          title="공유하기"
          style={{
            width: 48, height: 48, borderRadius: 999,
            border: `1px solid ${C.border}`, cursor: 'pointer',
            backgroundColor: C.card, color: C.text,
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <Share2 size={18} />
        </button>
        {/* Share popup */}
        <div style={{
          position: 'absolute', bottom: 56, right: 0,
          width: 200, padding: 8, borderRadius: 12,
          backgroundColor: C.card, border: `1px solid ${C.border}`,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          opacity: shareOpen ? 1 : 0,
          visibility: shareOpen ? 'visible' : 'hidden',
          transform: shareOpen ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(10px)',
          transformOrigin: 'bottom right',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textMid, padding: '4px 8px 8px', letterSpacing: '0.05em' }}>공유하기</div>
          {[
            { label: copied ? '복사 완료!' : '링크 복사', icon: <Link size={14} />, onClick: async () => {
              try { await navigator.clipboard.writeText('https://timebox.im'); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) {}
            }},
            { label: 'SMS 보내기', icon: <MessageCircle size={14} />, onClick: () => {
              const msg = encodeURIComponent('Daily Time Boxing으로 하루를 계획해보세요!\nhttps://timebox.im');
              window.open(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? `sms:?body=${msg}` : `sms:?body=${msg}`, '_blank');
              setShareOpen(false);
            }},
          ].map((item, i) => (
            <button key={i} onClick={item.onClick} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 8, border: 'none',
              backgroundColor: 'transparent', color: C.text, cursor: 'pointer',
              fontSize: 13, fontWeight: 500, textAlign: 'left',
              transition: 'all 0.15s',
            }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = C.hover}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = C.text; }}
              onMouseDown={(e) => { e.currentTarget.style.backgroundColor = C.accent; e.currentTarget.style.color = '#fff'; }}
              onMouseUp={(e) => { e.currentTarget.style.backgroundColor = C.hover; e.currentTarget.style.color = C.text; }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Settings button — fixed, right of music button */}
      <button
        onClick={() => setSettingsOpen(true)}
        title="설정"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 51,
          width: 48, height: 48, borderRadius: 999,
          border: `1px solid ${C.border}`, cursor: 'pointer',
          backgroundColor: C.card, color: C.text,
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <Settings size={20} />
      </button>
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} themeId={themeId} onChangeTheme={changeTheme} opacity={opacity} onChangeOpacity={changeOpacity} />
    </div>
  );
}

function EditView({
  C, boxes, isViewingToday, displayRange, rangeConflicts, onSlotDown, onSlotEnter, onSlotLeave, onBoxMouseDown, boxDrag,
  sel, editing, fTitle, setFTitle, fDesc, setFDesc, fColor, setFColor,
  fStart, setFStart, fEnd, setFEnd,
  fTasks, addTask, addTaskAfter, updateTaskText, toggleTask, removeTask,
  error, pendingClick, onSave, onDelete, onCancel
}) {
  const boxLeft = TIME_LABEL_WIDTH + ROW_HORIZONTAL_MARGIN;
  const scrollRef = useRef(null);
  const [nowMin, setNowMin] = useState(() => getCurrentMin());

  useEffect(() => {
    const i = setInterval(() => setNowMin(getCurrentMin()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const y = (getCurrentMin() / MIN_PER_SLOT) * SLOT_HEIGHT;
    el.scrollTop = Math.max(0, y - el.clientHeight / 2);
  }, []);

  const nowTop = (nowMin / MIN_PER_SLOT) * SLOT_HEIGHT;

  const formatTimeOnBlur = (which) => {
    const val = which === 'start' ? fStart : fEnd;
    const m = timeToMin(val);
    if (m !== null) {
      (which === 'start' ? setFStart : setFEnd)(minToTime(m));
    }
  };

  const validDuration = (() => {
    const s = timeToMin(fStart);
    const e = timeToMin(fEnd);
    if (s !== null && e !== null && e > s) return e - s;
    return null;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'dtb-fade-in 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }}>
      {/* Timeline */}
      <div style={{ flex: 1, minHeight: 0, backgroundColor: C.card, borderRadius: '12px 12px 0 0', border: `1px solid ${C.border}`, borderBottom: 'none', padding: 12, userSelect: 'none' }}>
        <div ref={scrollRef} style={{ height: '100%', overflowY: 'auto', paddingRight: 4 }}>
          <div style={{ position: 'relative' }}>
            {Array.from({ length: SLOTS_PER_DAY }).map((_, slot) => {
              const isHour = slot % 2 === 0;
              const slotStart = slot * MIN_PER_SLOT;
              const slotEnd = (slot + 1) * MIN_PER_SLOT;
              const isHovered = displayRange && !(displayRange.end <= slotStart || displayRange.start >= slotEnd);
              return (
                <div
                  key={slot}
                  onMouseDown={(e) => onSlotDown(slot, e)}
                  onMouseEnter={() => onSlotEnter(slot)}
                  onMouseLeave={onSlotLeave}
                  style={{ display: 'flex', alignItems: 'stretch', height: SLOT_HEIGHT, cursor: 'pointer' }}
                >
                  <div className="dtb-tnum" style={{
                    width: TIME_LABEL_WIDTH, flexShrink: 0, display: 'flex', alignItems: 'flex-start',
                    fontSize: 11, color: isHour ? C.text : C.textMid, fontWeight: isHour ? 600 : 400,
                    lineHeight: 1, paddingTop: 0,
                  }}>
                    {minToTime(slotStart)}
                  </div>
                  <div style={{
                    flex: 1, borderRadius: 6, marginLeft: ROW_HORIZONTAL_MARGIN, marginRight: ROW_HORIZONTAL_MARGIN,
                    marginTop: ROW_VERTICAL_MARGIN, marginBottom: ROW_VERTICAL_MARGIN,
                    backgroundColor: isHovered ? 'transparent' : C.slotBg,
                    transition: 'background-color 0.15s'
                  }} />
                </div>
              );
            })}

            {/* Selection overlay */}
            {displayRange && (
              <div
                style={{
                  position: 'absolute',
                  top: (displayRange.start / MIN_PER_SLOT) * SLOT_HEIGHT + ROW_VERTICAL_MARGIN,
                  height: ((displayRange.end - displayRange.start) / MIN_PER_SLOT) * SLOT_HEIGHT - ROW_VERTICAL_MARGIN * 2,
                  left: boxLeft,
                  right: ROW_HORIZONTAL_MARGIN,
                  borderRadius: 6,
                  backgroundColor: rangeConflicts ? C.indicatorSoft : 'rgba(217,119,87,0.22)',
                  outline: `2px solid ${rangeConflicts ? C.indicator : C.accent}`,
                  outlineOffset: -2,
                  pointerEvents: 'none',
                  zIndex: 5,
                  transition: 'top 0.1s, height 0.1s'
                }}
              >
                <div className="dtb-tnum" style={{
                  position: 'absolute', top: 6, left: 10, fontSize: 10, fontWeight: 700,
                  color: rangeConflicts ? C.indicator : C.accent
                }}>
                  {rangeConflicts ? '⚠ 기존 박스와 겹침' : `${formatRange(displayRange.start, displayRange.end)} · ${displayRange.end - displayRange.start}분`}
                </div>
              </div>
            )}

            {/* Time boxes */}
            {boxes.map(box => {
              const txt = getContrastText(box.color);
              const dragging = boxDrag && boxDrag.id === box.id && boxDrag.moved;
              const offset = dragging ? boxDrag.offset : 0;
              const effStart = box.start + offset;
              const effEnd = box.end + offset;
              const height = ((box.end - box.start) / MIN_PER_SLOT) * SLOT_HEIGHT - ROW_VERTICAL_MARGIN * 2;
              const top = (effStart / MIN_PER_SLOT) * SLOT_HEIGHT + ROW_VERTICAL_MARGIN;
              const isEditing = editing?.id === box.id;
              const taskCount = box.tasks?.length || 0;
              const doneCount = box.tasks?.filter(t => t.done).length || 0;
              const conflict = dragging && boxDrag.conflict;
              return (
                <div
                  key={box.id}
                  onMouseDown={(e) => onBoxMouseDown(box, e)}
                  style={{
                    position: 'absolute',
                    top, height, left: boxLeft, right: ROW_HORIZONTAL_MARGIN,
                    backgroundColor: box.color,
                    color: txt,
                    borderRadius: 6,
                    padding: '8px 12px',
                    boxShadow: dragging ? '0 6px 16px rgba(0,0,0,0.22)' : '0 1px 2px rgba(0,0,0,0.12)',
                    cursor: dragging ? 'grabbing' : 'grab',
                    overflow: 'hidden',
                    zIndex: dragging ? 20 : 10,
                    opacity: dragging ? 0.92 : 1,
                    outline: conflict ? `2px solid ${C.indicator}` : (isEditing ? `2px solid ${C.text}` : 'none'),
                    outlineOffset: (conflict || isEditing) ? 2 : 0,
                    transition: dragging ? 'none' : 'box-shadow 0.15s, top 0.1s'
                  }}
                >
                  <div className="dtb-tnum" style={{ fontSize: 10, opacity: 0.9, fontWeight: 500 }}>
                    {formatRange(effStart, effEnd)}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.25, marginTop: 2 }}>
                    {box.title}
                  </div>
                  {taskCount > 0 && (
                    <div style={{ fontSize: 10, opacity: 0.92, fontWeight: 600, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>☐</span>
                      <span className="dtb-tnum">{doneCount}/{taskCount}</span>
                    </div>
                  )}
                  {box.description && height > 90 && (
                    <div style={{
                      fontSize: 11, marginTop: 4, opacity: 0.88, lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: Math.max(1, Math.floor((height - 75) / 16)),
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {box.description}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Current time indicator */}
            {isViewingToday && (
            <div
              style={{
                position: 'absolute',
                top: nowTop,
                left: TIME_LABEL_WIDTH - 6,
                right: ROW_HORIZONTAL_MARGIN,
                height: 0,
                pointerEvents: 'none',
                zIndex: 15,
              }}
            >
              <div className="dtb-tnum" style={{
                position: 'absolute', left: -TIME_LABEL_WIDTH + 6, top: -8,
                width: TIME_LABEL_WIDTH - 8, textAlign: 'right',
                fontSize: 10, fontWeight: 700, color: C.indicator,
                letterSpacing: '-0.02em'
              }}>
                {minToTime(Math.floor(nowMin))}
              </div>
              <div style={{
                position: 'absolute', left: 0, top: -4,
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: C.indicator,
                boxShadow: `0 0 0 2px ${C.card}, 0 0 0 3px ${C.indicator}55`
              }} />
              <div style={{
                position: 'absolute', left: 4, right: 0, top: -0.5,
                height: 1.5, backgroundColor: C.indicator, opacity: 0.85,
              }} />
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Form panel — fixed at bottom */}
      <div
        style={{
          flexShrink: 0,
          backgroundColor: C.card, borderRadius: '0 0 12px 12px', border: `1px solid ${C.border}`,
          borderTop: `1px solid ${C.border}`,
          padding: '16px 20px', maxHeight: '45vh', overflowY: 'auto',
        }}
      >
        {sel ? (
          <>
            <label style={{ display: 'block', fontSize: 11, color: C.textMid, marginBottom: 6, fontWeight: 600 }}>시간 범위</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, minWidth: 0 }}>
              <input
                type="text"
                value={fStart}
                onChange={(e) => setFStart(e.target.value)}
                onBlur={() => formatTimeOnBlur('start')}
                placeholder="HH:MM"
                className="dtb-time-input"
                style={{ flex: '1 1 0', minWidth: 0, width: '100%' }}
                inputMode="numeric"
              />
              <span style={{ color: C.textMid, fontSize: 14, fontWeight: 500, flexShrink: 0 }}>—</span>
              <input
                type="text"
                value={fEnd}
                onChange={(e) => setFEnd(e.target.value)}
                onBlur={() => formatTimeOnBlur('end')}
                placeholder="HH:MM"
                className="dtb-time-input"
                style={{ flex: '1 1 0', minWidth: 0, width: '100%' }}
                inputMode="numeric"
              />
            </div>
            <div className="dtb-tnum" style={{ fontSize: 11, color: C.textMid, marginBottom: 18 }}>
              {validDuration !== null ? `${validDuration}분` : '시간을 입력하세요'}
            </div>

            <label style={{ display: 'block', fontSize: 11, color: C.textMid, marginBottom: 6, fontWeight: 600 }}>제목</label>
            <input
              value={fTitle}
              onChange={(e) => setFTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }}
              placeholder="예: 운동, 회의, 학습..."
              autoFocus
              className="dtb-input"
              style={{ marginBottom: 16 }}
            />

            <label style={{ display: 'block', fontSize: 11, color: C.textMid, marginBottom: 6, fontWeight: 600 }}>설명 (선택)</label>
            <textarea
              value={fDesc}
              onChange={(e) => setFDesc(e.target.value)}
              placeholder="메모..."
              className="dtb-input"
              style={{ marginBottom: 16, height: 70, resize: 'none' }}
            />

            <label style={{ display: 'block', fontSize: 11, color: C.textMid, marginBottom: 6, fontWeight: 600 }}>
              세부 Task
              {fTasks.filter(t => t.text.trim()).length > 0 && (
                <span className="dtb-tnum" style={{ marginLeft: 8, color: C.textDim, fontWeight: 500 }}>
                  {fTasks.filter(t => t.done && t.text.trim()).length}/{fTasks.filter(t => t.text.trim()).length}
                </span>
              )}
            </label>
            <div style={{ marginBottom: 8 }}>
              {fTasks.map((task, idx) => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <button
                    type="button"
                    onClick={() => toggleTask(task.id)}
                    style={{
                      width: 18, height: 18, flexShrink: 0,
                      border: `2px solid ${task.done ? C.accent : C.borderStrong}`,
                      borderRadius: 4,
                      backgroundColor: task.done ? C.accent : 'transparent',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0, transition: 'all 0.15s'
                    }}
                  >
                    {task.done && <Check size={11} color="white" strokeWidth={3.5} />}
                  </button>
                  <input
                    id={`task-input-${task.id}`}
                    value={task.text}
                    onChange={(e) => updateTaskText(task.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTaskAfter(idx);
                      }
                    }}
                    placeholder="세부 Task 입력 (Optional)"
                    className="dtb-task-input"
                    style={{
                      textDecoration: task.done ? 'line-through' : 'none',
                      color: task.done ? C.textDim : C.text
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeTask(task.id)}
                    title="삭제"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 4, color: C.textMid, display: 'flex', alignItems: 'center',
                      borderRadius: 4, transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = C.textMid; }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addTask}
              className="dtb-add-task-btn"
              style={{ marginBottom: 18 }}
            >
              <Plus size={13} />
              Task 추가
            </button>

            <label style={{ display: 'block', fontSize: 11, color: C.textMid, marginBottom: 6, fontWeight: 600 }}>색상</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {CLAUDE_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setFColor(c)}
                  style={{
                    width: 26, height: 26, borderRadius: '50%', backgroundColor: c,
                    border: 'none', cursor: 'pointer',
                    outline: fColor === c ? `2px solid ${C.text}` : 'none',
                    outlineOffset: 2,
                    transition: 'transform 0.1s'
                  }}
                  title={c}
                />
              ))}
              <label style={{
                width: 26, height: 26, borderRadius: '50%',
                border: `1px dashed ${C.borderStrong}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', position: 'relative', overflow: 'hidden',
                backgroundColor: C.inputBg
              }} title="사용자 지정 색상">
                <Plus size={12} color={C.textMid} />
                <input
                  type="color"
                  value={fColor}
                  onChange={(e) => setFColor(e.target.value)}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: fColor }} />
              <span className="dtb-tnum" style={{ fontSize: 11, color: C.textMid }}>{fColor.toUpperCase()}</span>
            </div>

            {error && (
              <div style={{
                marginBottom: 12, padding: '8px 12px',
                backgroundColor: C.indicatorSoft, border: `1px solid ${C.indicator}40`,
                color: C.indicator, fontSize: 12, borderRadius: 6, fontWeight: 500
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onSave} className="dtb-save-btn" type="button">
                <Save size={15} strokeWidth={2.5} />
                <span style={{ color: '#FFFFFF', fontWeight: 700 }}>저장</span>
              </button>
              {editing && (
                <button onClick={onDelete} className="dtb-delete-btn" type="button" title="삭제">
                  <Trash2 size={15} />
                </button>
              )}
              <button onClick={onCancel} className="dtb-cancel-btn" type="button">
                취소
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏱️</div>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>시간 범위를 선택하세요</p>
            <p style={{ fontSize: 11, color: C.textMid, lineHeight: 1.6 }}>
              왼쪽 타임라인에서 드래그하거나<br/>시작 슬롯 클릭 → 종료 슬롯 클릭
            </p>
            {pendingClick !== null && (
              <div style={{
                marginTop: 16, padding: '8px 12px',
                backgroundColor: `${C.accent}1A`, color: C.accent,
                fontSize: 12, borderRadius: 6, fontWeight: 600
              }}>
                시작: <span className="dtb-tnum">{minToTime(pendingClick * MIN_PER_SLOT)}</span><br/>
                <span style={{ fontSize: 10, opacity: 0.8, fontWeight: 500 }}>종료 슬롯을 클릭하세요</span>
              </div>
            )}
            {error && (
              <div style={{
                marginTop: 16, padding: '8px 12px',
                backgroundColor: C.indicatorSoft, border: `1px solid ${C.indicator}40`,
                color: C.indicator, fontSize: 12, borderRadius: 6
              }}>
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ViewMode({ C, viewRef, boxes, sw, tw, onScroll, toggleTaskInBox, isViewingToday, selectedDate }) {
  const timer = isViewingToday ? getTimerInfo(boxes) : { type: 'idle' };
  const urgent = !!timer.urgent && (timer.type === 'current' || timer.type === 'next');
  const urgentColor = C.indicator;
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const onDragStart = (e) => {
    const el = e.currentTarget;
    dragRef.current = { active: true, startX: e.clientX, scrollLeft: el.scrollLeft };
    el.style.cursor = 'grabbing';
  };
  const onDragMove = (e) => {
    if (!dragRef.current.active) return;
    e.preventDefault();
    const dx = e.clientX - dragRef.current.startX;
    e.currentTarget.scrollLeft = dragRef.current.scrollLeft - dx;
  };
  const onDragEnd = (e) => {
    dragRef.current.active = false;
    e.currentTarget.style.cursor = 'grab';
  };

  return (
    <div style={{ backgroundColor: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden', animation: 'dtb-fade-in 0.5s cubic-bezier(0.4, 0, 0.2, 1)', minHeight: 520 }}>
      <style>{`
        @keyframes dtb-urgent-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        .dtb-urgent { animation: dtb-urgent-pulse 1s ease-in-out infinite; }
      `}</style>
      {/* Pomodoro timer */}
      <div style={{ padding: '60px 24px 40px', textAlign: 'center', minHeight: 280 }}>
        {timer.type === 'current' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: urgent ? urgentColor : timer.box.color }} />
              <div style={{ fontSize: 11, color: urgent ? urgentColor : C.textMid, textTransform: 'uppercase', letterSpacing: '0.25em', fontWeight: 700 }}>
                {urgent ? '⚠ 곧 종료 · 5분 이내' : '진행 중'}
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 32, color: urgent ? urgentColor : C.text }}>
              {timer.box.title}
            </div>
            <div className={`dtb-tnum${urgent ? ' dtb-urgent' : ''}`} style={{
              fontSize: 'clamp(4.5rem, 13vw, 9rem)', fontWeight: 900,
              letterSpacing: '-0.04em', color: urgent ? urgentColor : C.text, lineHeight: 1
            }}>
              {formatHMS(timer.remaining)}
            </div>
            <div style={{ fontSize: 13, color: urgent ? urgentColor : C.textMid, marginTop: 20, fontWeight: 600 }}>남은 시간</div>
            <div style={{ marginTop: 24, maxWidth: 480, margin: '24px auto 0', height: 6, backgroundColor: C.hover, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${timer.progress * 100}%`, backgroundColor: timer.box.color, transition: 'width 0.3s' }} />
            </div>
            <div className="dtb-tnum" style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 480, margin: '6px auto 0', fontSize: 10, color: C.textMid, fontWeight: 500 }}>
              <span>{minToTime(timer.box.start)}</span>
              <span>{minToTime(timer.box.end)}</span>
            </div>

            {timer.box.tasks && timer.box.tasks.length > 0 && (
              <div style={{ marginTop: 40, maxWidth: 480, margin: '40px auto 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 12px' }}>
                  <span style={{ fontSize: 11, color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 600 }}>
                    세부 Task
                  </span>
                  <span className="dtb-tnum" style={{ fontSize: 11, color: C.textMid, fontWeight: 600 }}>
                    {timer.box.tasks.filter(t => t.done).length} / {timer.box.tasks.length}
                  </span>
                </div>
                <div>
                  {timer.box.tasks.map(task => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleTaskInBox(timer.box.id, task.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px', borderRadius: 8, border: 'none',
                        background: 'transparent', cursor: 'pointer', textAlign: 'left',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = C.cardAlt}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div style={{
                        width: 22, height: 22, flexShrink: 0,
                        border: `2px solid ${task.done ? timer.box.color : C.textDim}`,
                        borderRadius: 6,
                        backgroundColor: task.done ? timer.box.color : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s'
                      }}>
                        {task.done && <Check size={14} color="white" strokeWidth={3.5} />}
                      </div>
                      <span style={{
                        fontSize: 15, flex: 1,
                        textDecoration: task.done ? 'line-through' : 'none',
                        color: task.done ? C.textDim : C.text,
                        fontWeight: task.done ? 400 : 500
                      }}>
                        {task.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {timer.type === 'next' && (
          <>
            <div style={{ fontSize: 11, color: urgent ? urgentColor : C.textMid, textTransform: 'uppercase', letterSpacing: '0.25em', fontWeight: 700, marginBottom: 12 }}>
              {urgent ? '⚠ 곧 시작 · 5분 이내' : '다음 일정까지'}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 32, color: urgent ? urgentColor : C.textMid, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: urgent ? urgentColor : timer.box.color }} />
              {timer.box.title}
            </div>
            <div className={`dtb-tnum${urgent ? ' dtb-urgent' : ''}`} style={{
              fontSize: 'clamp(4.5rem, 13vw, 9rem)', fontWeight: 900,
              letterSpacing: '-0.04em', color: urgent ? urgentColor : C.text, lineHeight: 1
            }}>
              {formatHMS(timer.remaining)}
            </div>
            <div className="dtb-tnum" style={{ fontSize: 13, color: urgent ? urgentColor : C.textMid, marginTop: 20, fontWeight: 600 }}>
              {minToTime(timer.box.start)} 시작 예정
            </div>
          </>
        )}
        {timer.type === 'idle' && (
          <>
            <div style={{ fontSize: 11, color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.25em', fontWeight: 600, marginBottom: 12 }}>
              {isViewingToday ? '여유 시간' : formatDate(selectedDate)}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 32, color: C.textMid }}>
              {isViewingToday ? '예정된 일정이 없습니다' : (boxes.length > 0 ? `${boxes.length}개의 타임박스` : '예정된 일정이 없습니다')}
            </div>
            {isViewingToday && (
              <>
                <div className="dtb-tnum" style={{
                  fontSize: 'clamp(4.5rem, 13vw, 9rem)', fontWeight: 900,
                  letterSpacing: '-0.04em', color: C.text, lineHeight: 1
                }}>
                  {currentTimeHMS()}
                </div>
                <div style={{ fontSize: 13, color: C.textMid, marginTop: 20, fontWeight: 600 }}>현재 시각</div>
              </>
            )}
          </>
        )}
      </div>

      {/* Timeline at bottom */}
      <div style={{ borderTop: `1px solid ${C.border}`, backgroundColor: C.cardAlt, padding: '16px 24px 20px' }}>
        <div style={{ fontSize: 10, color: C.textMid, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          <span>타임라인</span>
          <span style={{ opacity: 0.7, textTransform: 'none', letterSpacing: 'normal', fontWeight: 500 }}>마우스 휠로 좌우 스크롤 · 5초 후 자동 복귀</span>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 48, background: `linear-gradient(to right, ${C.cardAlt} 0%, ${C.cardAlt}cc 50%, transparent 100%)`, pointerEvents: 'none', zIndex: 10 }} />
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 48, background: `linear-gradient(to left, ${C.cardAlt} 0%, ${C.cardAlt}cc 50%, transparent 100%)`, pointerEvents: 'none', zIndex: 10 }} />

          {/* Current time indicator - RED */}
          {isViewingToday && (
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 0, height: 108, zIndex: 20, pointerEvents: 'none' }}>
            <div style={{
              position: 'absolute', top: -24, left: '50%', transform: 'translateX(-50%)',
              backgroundColor: C.indicator, color: 'white', fontSize: 9, padding: '2px 8px',
              borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.1em', textTransform: 'uppercase',
              boxShadow: `0 1px 3px ${C.indicator}66`
            }}>
              지금
            </div>
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: 12, height: 12, borderRadius: '50%', backgroundColor: C.indicator,
              boxShadow: `0 0 0 3px ${C.card}, 0 0 0 5px ${C.indicator}40`
            }} />
            <div style={{
              width: 2, height: '100%', backgroundColor: C.indicator, margin: '0 auto',
              boxShadow: `0 0 0 1px ${C.card}40`
            }} />
          </div>
          )}

          <div
            ref={viewRef}
            onScroll={onScroll}
            onMouseDown={onDragStart}
            onMouseMove={onDragMove}
            onMouseUp={onDragEnd}
            onMouseLeave={onDragEnd}
            className="dtb-no-scrollbar"
            style={{ overflowX: 'auto', overflowY: 'hidden', width: '100%', cursor: 'grab' }}
          >
            <div style={{ position: 'relative', width: tw, height: 144 }}>
              {sw > 0 && (
              <>
              {Array.from({ length: SLOTS_PER_DAY }).map((_, i) => {
                const isHour = i % 2 === 0;
                return (
                  <div
                    key={`slot-${i}`}
                    style={{
                      position: 'absolute',
                      left: i * sw, width: sw, top: 6, height: 84,
                      backgroundColor: C.slotBg,
                      borderLeft: isHour ? `1px solid ${C.border}` : `1px dashed ${C.border}80`
                    }}
                  />
                );
              })}

              {boxes.map(box => {
                const w = ((box.end - box.start) / MIN_PER_SLOT) * sw;
                const left = (box.start / MIN_PER_SLOT) * sw;
                const txt = getContrastText(box.color);
                const taskCount = box.tasks?.length || 0;
                const doneCount = box.tasks?.filter(t => t.done).length || 0;
                return (
                  <div
                    key={box.id}
                    style={{
                      position: 'absolute',
                      left: left + 3, top: 6,
                      width: w - 6, height: 84,
                      backgroundColor: box.color, color: txt,
                      borderRadius: 6, padding: 8,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                      overflow: 'hidden'
                    }}
                  >
                    <div className="dtb-tnum" style={{ fontSize: 9, opacity: 0.9, lineHeight: 1.2, fontWeight: 500 }}>
                      {formatRange(box.start, box.end)}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 12, marginTop: 2, lineHeight: 1.25 }}>{box.title}</div>
                    {taskCount > 0 && (
                      <div className="dtb-tnum" style={{ fontSize: 10, opacity: 0.9, fontWeight: 600, marginTop: 3 }}>
                        ☐ {doneCount}/{taskCount}
                      </div>
                    )}
                  </div>
                );
              })}

              {Array.from({ length: SLOTS_PER_DAY + 1 }).map((_, i) => {
                const isHour = i % 2 === 0;
                return (
                  <div key={`tick-${i}`} style={{
                    position: 'absolute', left: i * sw - 0.5, top: 98,
                    width: 1, height: isHour ? 6 : 3,
                    backgroundColor: C.textMid, opacity: isHour ? 0.6 : 0.3
                  }} />
                );
              })}

              {Array.from({ length: 25 }).map((_, h) => (
                <div key={`lab-${h}`} className="dtb-tnum" style={{
                  position: 'absolute', left: h * 2 * sw, top: 112,
                  transform: 'translateX(-50%)', fontSize: 10,
                  color: C.text, fontWeight: 500, whiteSpace: 'nowrap'
                }}>
                  {pad2(h)}:00
                </div>
              ))}
              </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMid }}>
        <div>전체 <span style={{ color: C.text, fontWeight: 700 }}>{boxes.length}</span>개의 타임박스</div>
        <div>
          채워진 시간: <span style={{ color: C.text, fontWeight: 700 }}>
            {(() => {
              const t = boxes.reduce((s, b) => s + (b.end - b.start), 0);
              return `${Math.floor(t/60)}시간 ${t%60}분`;
            })()}
          </span>
        </div>
      </div>
    </div>
  );
}
