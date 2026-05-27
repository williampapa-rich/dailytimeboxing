import { useState, useEffect } from 'react';
import { useI18n } from './i18n.js';

const STEPS_KO = [
  { emoji: '👋', title: '환영합니다!', desc: 'Daily Time Boxing으로\n하루를 타임박스로 계획하세요.' },
  { emoji: '✏️', title: '편집 모드', desc: '뷰 화면에서 우하단 ✏️ 버튼을 누르면\n편집 모드로 전환됩니다.\n타임라인에서 드래그하여 시간 블록을 만들고\n제목, 색상, 세부 Task를 지정하세요.' },
  { emoji: '👀', title: '뷰 모드', desc: '편집 화면에서 우하단 👀 버튼을 누르면\n뷰 모드로 전환됩니다.\n현재 진행 중인 일정과 남은 시간을\n한눈에 확인할 수 있어요.' },
  { emoji: '⚙️', title: '설정', desc: '테마, 언어, 투명도를\n원하는 대로 커스터마이즈하세요.' },
  { emoji: '🎵', title: '음악', desc: 'Spotify와 YouTube로\n집중 음악을 들으며 작업하세요.\n(데스크톱 전용)' },
  { emoji: '🚀', title: '시작하기', desc: '지금 바로 첫 타임박스를 만들어보세요!\nGoogle 로그인하면 여러 기기에서 동기화됩니다.' },
];

const STEPS_EN = [
  { emoji: '👋', title: 'Welcome!', desc: 'Plan your day with\nDaily Time Boxing.' },
  { emoji: '✏️', title: 'Edit Mode', desc: 'In view mode, tap ✏️ at bottom-right\nto switch to edit mode.\nDrag on the timeline to create time blocks.\nSet title, color, and subtasks.' },
  { emoji: '👀', title: 'View Mode', desc: 'In edit mode, tap 👀 at bottom-right\nto switch to view mode.\nSee your current schedule\nand remaining time at a glance.' },
  { emoji: '⚙️', title: 'Settings', desc: 'Customize themes, language,\nand opacity to your liking.' },
  { emoji: '🎵', title: 'Music', desc: 'Listen to focus music with\nSpotify and YouTube.\n(Desktop only)' },
  { emoji: '🚀', title: 'Get Started', desc: 'Create your first timebox now!\nSign in with Google to sync across devices.' },
];

const STEPS_ZH = [
  { emoji: '👋', title: '欢迎！', desc: '用Daily Time Boxing\n规划你的一天。' },
  { emoji: '✏️', title: '编辑模式', desc: '在查看模式下，点击右下角 ✏️\n即可切换到编辑模式。\n在时间线上拖动创建时间块\n设置标题、颜色和子任务。' },
  { emoji: '👀', title: '查看模式', desc: '在编辑模式下，点击右下角 👀\n即可切换到查看模式。\n一目了然地查看当前日程\n和剩余时间。' },
  { emoji: '⚙️', title: '设置', desc: '自定义主题、语言\n和不透明度。' },
  { emoji: '🎵', title: '音乐', desc: '用Spotify和YouTube\n播放专注音乐。\n（仅限桌面端）' },
  { emoji: '🚀', title: '开始', desc: '立即创建第一个时间盒！\n用Google登录可在多设备同步。' },
];

const STEPS_ES = [
  { emoji: '👋', title: '¡Bienvenido!', desc: 'Planifica tu día con\nDaily Time Boxing.' },
  { emoji: '✏️', title: 'Modo edición', desc: 'En modo vista, toca ✏️ abajo a la derecha\npara cambiar al modo edición.\nArrastra en la línea de tiempo para crear bloques.\nDefine título, color y subtareas.' },
  { emoji: '👀', title: 'Modo vista', desc: 'En modo edición, toca 👀 abajo a la derecha\npara cambiar al modo vista.\nVe tu horario actual\ny el tiempo restante de un vistazo.' },
  { emoji: '⚙️', title: 'Ajustes', desc: 'Personaliza temas, idioma\ny opacidad a tu gusto.' },
  { emoji: '🎵', title: 'Música', desc: 'Escucha música de concentración\ncon Spotify y YouTube.\n(Solo escritorio)' },
  { emoji: '🚀', title: 'Empezar', desc: '¡Crea tu primer timebox ahora!\nInicia sesión con Google para sincronizar.' },
];

const STEPS_JA = [
  { emoji: '👋', title: 'ようこそ！', desc: 'Daily Time Boxingで\n一日を計画しましょう。' },
  { emoji: '✏️', title: '編集モード', desc: 'ビューモードで右下の ✏️ をタップすると\n編集モードに切り替わります。\nタイムラインでドラッグして時間ブロックを作成。\nタイトル、色、サブタスクを設定。' },
  { emoji: '👀', title: 'ビューモード', desc: '編集モードで右下の 👀 をタップすると\nビューモードに切り替わります。\n現在のスケジュールと残り時間を\n一目で確認できます。' },
  { emoji: '⚙️', title: '設定', desc: 'テーマ、言語、不透明度を\nお好みにカスタマイズ。' },
  { emoji: '🎵', title: '音楽', desc: 'SpotifyとYouTubeで\n集中音楽を聴きながら作業。\n（デスクトップ専用）' },
  { emoji: '🚀', title: '始めましょう', desc: '今すぐ最初のタイムボックスを作成！\nGoogleログインで複数デバイスと同期。' },
];

const ALL_STEPS = { ko: STEPS_KO, en: STEPS_EN, zh: STEPS_ZH, es: STEPS_ES, ja: STEPS_JA };

const SPOTLIGHTS = [
  null,
  { bottom: 20, right: 20 + 48 + 8 + 48 + 8, size: 56 },
  { bottom: 20, right: 20 + 48 + 8 + 48 + 8, size: 56 },
  { bottom: 20, right: 20 + 48 + 8, size: 56 },
  { bottom: 20, left: 20, size: 56 },
  null,
];

export default function Tutorial({ isOpen, onClose, C }) {
  const { lang, t } = useI18n();
  const [step, setStep] = useState(0);
  const steps = ALL_STEPS[lang] || ALL_STEPS.en;
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const spot = SPOTLIGHTS[step] || null;

  useEffect(() => { if (isOpen) setStep(0); }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: spot ? 'transparent' : 'rgba(0,0,0,0.6)',
        backdropFilter: spot ? 'none' : 'blur(8px)', WebkitBackdropFilter: spot ? 'none' : 'blur(8px)',
      }} />
      {/* Spotlight ring */}
      {spot && (
        <div style={{
          position: 'fixed', zIndex: 300,
          bottom: spot.bottom - 6, ...(spot.left != null ? { left: spot.left - 6 } : {}), ...(spot.right != null ? { right: spot.right - 6 } : {}),
          width: spot.size + 12, height: spot.size + 12,
          borderRadius: 999,
          boxShadow: `0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 4px ${C.accent}88`,
          pointerEvents: 'none',
        }} />
      )}
      <div onClick={(e) => e.stopPropagation()} style={{
        position: 'fixed', inset: 0, zIndex: 301,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          width: 'min(400px, 88vw)', padding: '36px 28px 24px',
          backgroundColor: C.card, color: C.text,
          borderRadius: 20, border: `1px solid ${C.border}`,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          textAlign: 'center', pointerEvents: 'auto',
          animation: 'dtb-fade-in 0.3s ease',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{current.emoji}</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, color: C.text }}>{current.title}</div>
          <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.7, whiteSpace: 'pre-line', marginBottom: 28 }}>{current.desc}</div>

          {/* Progress dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
            {steps.map((_, i) => (
              <div key={i} onClick={() => setStep(i)} style={{
                width: i === step ? 20 : 6, height: 6, borderRadius: 3,
                backgroundColor: i === step ? C.accent : (C.hover),
                transition: 'all 0.3s ease', cursor: 'pointer',
              }} />
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => { onClose(); try { localStorage.setItem('dtb-tutorial-done', '1'); } catch(e){} }} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              backgroundColor: 'transparent', color: C.textMid, cursor: 'pointer',
              fontSize: 13, fontWeight: 500,
            }}>Skip</button>
            <button onClick={() => {
              if (isLast) { onClose(); try { localStorage.setItem('dtb-tutorial-done', '1'); } catch(e){} }
              else setStep(s => s + 1);
            }} style={{
              padding: '10px 24px', borderRadius: 10, border: 'none',
              backgroundColor: C.accent, color: '#fff', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
              transition: 'all 0.15s',
            }}>
              {isLast ? (t.confirm || 'OK') : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
