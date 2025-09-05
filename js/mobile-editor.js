(function () {
  const mq = window.matchMedia('(max-width: 768px)');
  const toolbar = document.getElementById('mobile-toolbar');
  const drawer = document.getElementById('mobile-settings-drawer');
  const drawerContent = document.getElementById('mobile-settings-content');
  const settingsToggle = document.getElementById('mobile-settings-toggle');
  const settingsClose = document.getElementById('mobile-settings-close');

  // Map mobile buttons to your existing tool triggers.
  // Update selectors on the right to match your real buttons or tabs.
  const TOOL_SELECTORS = {
    select:  ['[data-tool="select"]',  '#tool-select',  '.btn-select'],
    move:    ['[data-tool="move"]',    '#tool-move',    '.btn-move'],
    shapes:  ['[data-tool="shapes"]',  '#tool-shapes',  '.btn-shapes', '.tab-shapes'],
    draw:    ['[data-tool="draw"]',    '#tool-draw',    '.btn-draw', '.tab-draw'],
    text:    ['[data-tool="text"]',    '#tool-text',    '.btn-text', '.tab-text'],
    layers:  ['[data-tool="layers"]',  '#tool-layers',  '.btn-layers', '.tab-layers']
  };

  // Try to find an element by a list of selectors
  function findOne(selectors) {
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  // Find your existing settings panel
  const SETTINGS_CANDIDATES = ['#tool-settings', '.tool-settings', '[data-panel="tool-settings"]'];
  function findSettingsPanel() {
    return findOne(SETTINGS_CANDIDATES);
  }

  // Track where settings originally lived so we can restore on desktop
  let settingsOriginalParent = null;
  let settingsPlaceholder = null;

  function toMobileLayout() {
    if (!toolbar) return;

    toolbar.style.display = 'flex';

    // Move settings into drawer
    const panel = findSettingsPanel();
    if (panel && !settingsOriginalParent) {
      settingsOriginalParent = panel.parentElement;
      settingsPlaceholder = document.createElement('div');
      settingsPlaceholder.style.display = 'none';
      settingsOriginalParent.insertBefore(settingsPlaceholder, panel);
      drawerContent.appendChild(panel);
    }
  }

  function toDesktopLayout() {
    if (!toolbar) return;

    toolbar.style.display = 'none';
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    settingsToggle.setAttribute('aria-expanded', 'false');

    // Restore settings panel
    if (settingsOriginalParent && settingsPlaceholder) {
      const panel = findSettingsPanel();
      if (panel) settingsOriginalParent.insertBefore(panel, settingsPlaceholder);
      settingsPlaceholder.remove();
      settingsPlaceholder = null;
      settingsOriginalParent = null;
    }
  }

  function handleChange(e) {
    if (e.matches) toMobileLayout(); else toDesktopLayout();
  }

  // Wire tool buttons: clicking mobile button triggers your real button
  function wireTools() {
    document.querySelectorAll('#mobile-toolbar .lb-tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool');
        const target = findOne(TOOL_SELECTORS[tool] || []);
        if (target) {
          // Try click
          target.click?.();

          // Mark active in mobile bar
          document.querySelectorAll('#mobile-toolbar .lb-tool-btn').forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
        }
      });
    });
  }

  // Drawer controls
  function openDrawer() {
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    settingsToggle.setAttribute('aria-expanded', 'true');
  }
  function closeDrawer() {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    settingsToggle.setAttribute('aria-expanded', 'false');
  }

  function wireDrawer() {
    settingsToggle?.addEventListener('click', () => {
      const open = drawer.classList.contains('is-open');
      if (open) closeDrawer(); else openDrawer();
    });
    settingsClose?.addEventListener('click', closeDrawer);

    // Close when tapping outside drawer content area
    drawer.addEventListener('click', (e) => {
      if (e.target === drawer) closeDrawer();
    });

    // Escape key closes
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
    });
  }

  // Init
  wireTools();
  wireDrawer();
  handleChange(mq);
  mq.addEventListener('change', handleChange);

  // Safety: if your app hot-swaps settings panel, watch for it and remount on mobile
  const mo = new MutationObserver(() => {
    if (mq.matches) {
      const inDrawer = drawerContent.contains(findSettingsPanel());
      if (!inDrawer) {
        const p = findSettingsPanel();
        if (p) drawerContent.appendChild(p);
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
