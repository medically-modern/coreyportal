let initialized = false;

export function initFocusBlur() {
  if (initialized) return;
  initialized = true;

  let dwellTimer = null;
  let deepTimer = null;
  let currentGroup = null;

  document.addEventListener('mouseenter', (e) => {
    const item = e.target.closest('[data-focus-item]');
    if (!item) return;
    const group = item.closest('[data-focus-group]');
    if (!group) return;

    // Clear any existing timers
    if (dwellTimer) clearTimeout(dwellTimer);
    if (deepTimer) clearTimeout(deepTimer);
    group.classList.remove('focus-dwell', 'focus-deep');
    currentGroup = group;

    // After 2 seconds resting, apply light blur
    dwellTimer = setTimeout(() => {
      group.classList.add('focus-dwell');

      // After 5 seconds total (3 more), deepen blur
      deepTimer = setTimeout(() => {
        group.classList.add('focus-deep');
      }, 3000);
    }, 2000);
  }, true);

  document.addEventListener('mouseleave', (e) => {
    const item = e.target.closest('[data-focus-item]');
    if (!item) return;
    const group = item.closest('[data-focus-group]');
    if (!group) return;

    if (dwellTimer) clearTimeout(dwellTimer);
    if (deepTimer) clearTimeout(deepTimer);
    group.classList.remove('focus-dwell', 'focus-deep');
    currentGroup = null;
  }, true);
}

export default initFocusBlur;
