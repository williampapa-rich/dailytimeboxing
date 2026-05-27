import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { supabase, ensureSession, cloudStorage } from './supabase.js';
import * as spotify from './providers/spotify.js';
import * as youtube from './providers/youtube.js';

window.storage = cloudStorage;

const root = ReactDOM.createRoot(document.getElementById('root'));

function Loading({ msg }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#F5F4EE', color: '#6B6962', fontFamily: '-apple-system, system-ui, sans-serif',
      fontSize: 14
    }}>
      {msg}
    </div>
  );
}

root.render(<Loading msg="연결 중..." />);

async function handleOAuthCallbacks() {
  const params = new URLSearchParams(window.location.search);

  if (params.get('error_code')) {
    window.history.replaceState({}, '', window.location.pathname);
  }

  // Google ID token callback (from direct Google OAuth, not Supabase authorize)
  if (window.location.hash.includes('id_token=') && !window.location.hash.includes('youtube')) {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const idToken = hashParams.get('id_token');
    if (idToken) {
      try {
        const nonce = sessionStorage.getItem('dtb-google-nonce') || undefined;
        sessionStorage.removeItem('dtb-google-nonce');
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
          nonce,
        });
        if (error) {
          console.error('[google id_token]', error);
          window.history.replaceState({}, '', window.location.pathname);
        } else {
          window.location.replace(window.location.pathname);
          return;
        }
      } catch (e) {
        console.error('[google id_token]', e);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }

  const state = params.get('state') || '';
  const code = params.get('code');
  if (code && state.startsWith('spotify:')) {
    try {
      await spotify.handleCallback(code, state);
    } catch (e) {
      console.error('[spotify callback]', e);
    } finally {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }
  if (window.location.hash.includes('access_token=') && window.location.hash.includes('youtube')) {
    try {
      await youtube.handleCallbackHash(window.location.hash);
    } catch (e) {
      console.error('[youtube callback]', e);
    } finally {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }
}

(async () => {
  try {
    await handleOAuthCallbacks();
    await ensureSession();
    root.render(<App />);
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    root.render(<Loading msg={`연결 실패: ${err.message || err}`} />);
  }
})();
