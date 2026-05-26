import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ensureSession, cloudStorage } from './supabase.js';

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

ensureSession()
  .then(() => root.render(<App />))
  .catch((err) => {
    console.error(err);
    root.render(<Loading msg={`연결 실패: ${err.message || err}`} />);
  });
