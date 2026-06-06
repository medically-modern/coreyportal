import { useEffect } from 'react';

let initialized = false;

export function initFocusBlur() {
  if (initialized) return;
  initialized = true;

  let dwellTimer = null;

  document.addEventListener('mouseenter', (e) => {
    const item = e.target.closest('[data-focus-item]');
    if (!item) return;
    const group = item.closest('[data-focus-group]');
    if (!group) return;
    if (dwellTimer) clearTimeout(dwellTimer);
    group.classList.remove('focus-dwell');
    dwellTimer = setTimeout(() => {
      group.classList.add('focus-dwell');
    }, 3000);
  }, true);

  document.addEventListener('mouseleave', (e) => {
    const item = e.target.closest('[data-focus-item]');
    if (!item) return;
    const group = item.closest('[data-focus-group]');
    if (!group) return;
    if (dwellTimer) clearTimeout(dwellTimer);
    group.classList.remove('focus-dwell');
  }, true);
}

export default initFocusBlur;
