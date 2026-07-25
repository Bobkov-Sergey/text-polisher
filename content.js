(function() {
  let floatBtn = null;
  let previewTooltip = null;
  let previewTimeout = null;
  let ctrlPreviewBox = null;
  let ctrlKeyDown = false;

  const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let isDark = darkMediaQuery.matches;

  function applyThemeToFloatElements() {
    if (!floatBtn) return;
    floatBtn.style.background = isDark ? '#0a84ff' : '#007aff';
  }

  darkMediaQuery.addEventListener('change', (e) => {
    isDark = e.matches;
    applyThemeToFloatElements();
  });

  function createFloatButton() {
    if (floatBtn) return;
    floatBtn = document.createElement('div');
    floatBtn.id = '__textPolisherFloatBtn';
    Object.assign(floatBtn.style, {
      position: 'fixed',
      display: 'none',
      zIndex: '2147483647',
      background: '#007aff',
      color: 'white',
      borderRadius: '8px',
      padding: '6px 12px',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      fontSize: '13px',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      transition: 'opacity 0.2s',
      userSelect: 'none',
      whiteSpace: 'nowrap'
    });
    floatBtn.textContent = 'Перефразировать';
    document.body.appendChild(floatBtn);

    floatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (!text) return;
      hideFloatButton();
      chrome.runtime.sendMessage({ action: "rephrase", text });
    });

    floatBtn.addEventListener('mouseenter', () => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (!text) return;
      previewTimeout = setTimeout(() => {
        chrome.runtime.sendMessage({ action: "preview", text }, (response) => {
          if (response?.success && response.text) {
            showPreviewTooltip(response.text);
          } else {
            showPreviewTooltip('⚠️ ' + (response?.error?.includes('API key') ? '🔑 Введите API-ключ' : 'Ошибка загрузки'));
          }
        });
      }, 300);
    });

    floatBtn.addEventListener('mouseleave', () => {
      clearTimeout(previewTimeout);
      hidePreviewTooltip();
    });

    applyThemeToFloatElements();
  }

  function showPreviewTooltip(text) {
    if (!previewTooltip) {
      previewTooltip = document.createElement('div');
      Object.assign(previewTooltip.style, {
        position: 'fixed',
        zIndex: '2147483647',
        background: '#333',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '8px',
        fontSize: '13px',
        maxWidth: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        pointerEvents: 'none',
        lineHeight: '1.4'
      });
      document.body.appendChild(previewTooltip);
    }
    previewTooltip.textContent = text;
    const rect = floatBtn.getBoundingClientRect();
    previewTooltip.style.left = rect.left + 'px';
    previewTooltip.style.top = (rect.bottom + 5) + 'px';
    previewTooltip.style.display = 'block';
  }

  function hidePreviewTooltip() {
    if (previewTooltip) previewTooltip.style.display = 'none';
  }

  function positionFloatButton(selection) {
    if (!floatBtn) createFloatButton();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      floatBtn.style.display = 'none';
      return;
    }
    floatBtn.style.display = 'block';
    floatBtn.style.left = Math.min(rect.right + 5, window.innerWidth - 150) + 'px';
    floatBtn.style.top = Math.min(rect.top - 30, window.innerHeight - 40) + 'px';
  }

  function hideFloatButton() {
    if (floatBtn) floatBtn.style.display = 'none';
  }

  // Индикатор выполнения
  let progressBar = null;
  window.addEventListener('message', (event) => {
    if (event.data.type === 'TEXT_POLISHER_PROGRESS') {
      if (event.data.visible) showProgressBar();
      else hideProgressBar();
    }
  });

  function showProgressBar() {
    if (progressBar) return;
    progressBar = document.createElement('div');
    progressBar.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 3px;
      background: #007aff; z-index: 2147483647;
      animation: textPolisherProgress 2s ease-in-out infinite;
    `;
    const style = document.createElement('style');
    style.textContent = '@keyframes textPolisherProgress { 0% { width: 0; } 50% { width: 70%; } 100% { width: 100%; } }';
    document.head.appendChild(style);
    document.body.appendChild(progressBar);
  }

  function hideProgressBar() {
    if (progressBar) { progressBar.remove(); progressBar = null; }
  }

  // Ctrl‑предпросмотр
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Control' || e.key === 'Meta') {
      ctrlKeyDown = true;
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Control' || e.key === 'Meta') {
      ctrlKeyDown = false;
      hideCtrlPreview();
    }
  });

  function showCtrlPreview(text) {
    if (!ctrlPreviewBox) {
      ctrlPreviewBox = document.createElement('div');
      Object.assign(ctrlPreviewBox.style, {
        position: 'fixed',
        zIndex: '2147483647',
        background: '#333',
        color: 'white',
        padding: '10px 14px',
        borderRadius: '10px',
        fontSize: '14px',
        maxWidth: '400px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        pointerEvents: 'none',
        lineHeight: '1.5'
      });
      document.body.appendChild(ctrlPreviewBox);
    }
    ctrlPreviewBox.textContent = text;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      ctrlPreviewBox.style.left = Math.min(rect.right + 8, window.innerWidth - 420) + 'px';
      ctrlPreviewBox.style.top = Math.min(rect.bottom + 5, window.innerHeight - 60) + 'px';
    }
    ctrlPreviewBox.style.display = 'block';
  }

  function hideCtrlPreview() {
    if (ctrlPreviewBox) ctrlPreviewBox.style.display = 'none';
  }

  // Слушаем выделение мыши
  document.addEventListener('mouseup', (e) => {
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        hideFloatButton();
        return;
      }
      const activeEl = document.activeElement;
      const isEditable = activeEl && (activeEl.tagName === 'TEXTAREA' ||
                          (activeEl.tagName === 'INPUT' && activeEl.type === 'text') ||
                          activeEl.isContentEditable);
      if (!isEditable) {
        hideFloatButton();
        return;
      }

      if (ctrlKeyDown) {
        hideFloatButton();
        const text = selection.toString().trim();
        chrome.runtime.sendMessage({ action: "preview", text }, (response) => {
          if (response?.success && response.text) {
            showCtrlPreview(response.text);
          } else {
            showCtrlPreview('⚠️ Ошибка предпросмотра');
          }
        });
      } else {
        positionFloatButton(selection);
      }
    }, 10);
  });

  document.addEventListener('mousedown', (e) => {
    if (floatBtn && !floatBtn.contains(e.target)) {
      hideFloatButton();
    }
  });

  window.addEventListener('blur', () => {
    ctrlKeyDown = false;
    hideCtrlPreview();
  });
})();