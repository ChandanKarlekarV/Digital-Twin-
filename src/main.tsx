import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// Kick off OBJ model download ASAP — before any React rendering completes.
// This means the model is already partially or fully downloaded by the time
// the 3D canvas mounts, eliminating the blank-model delay on first load.
import { rigModelCache } from './services/RigModelCache';
rigModelCache.preload('/models/untitled.obj').catch(() => {/* silent */});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

