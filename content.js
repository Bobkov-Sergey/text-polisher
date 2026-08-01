(function() {
  let floatBtn = null, previewTooltip = null, previewTimeout = null, ctrlPreviewBox = null, ctrlKeyDown = false;
  const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let isDark = darkMediaQuery.matches;

  function applyThemeToFloatElements() {
    if (!floatBtn) return;
    if (isDark) {
      floatBtn.style.background = 'linear-gradient(135deg, #0a84ff, #5e5ce6)';
      floatBtn.style.boxShadow = '0 4px 15px rgba(10, 132, 255, 0.4)';
    } else {
      floatBtn.style.background = 'linear-gradient(135deg, #007aff, #5856d6)';
      floatBtn.style.boxShadow = '0 4px 15px rgba(0, 122, 255, 0.3)';
    }
  }
  darkMediaQuery.addEventListener('change', (e) => { isDark = e.matches; applyThemeToFloatElements(); });

  function createFloatButton() {
    if (floatBtn) return;
    floatBtn = document.createElement('div');
    floatBtn.id = '__textPolisherFloatBtn';
    Object.assign(floatBtn.style, {
      position: 'fixed', display: 'none', zIndex: '2147483647',
      background: 'linear-gradient(135deg, #007aff, #5856d6)',
      color: 'white', borderRadius: '20px', padding: '8px 18px',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: '13px',
      cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,122,255,0.3)',
      transition: 'opacity 0.2s, transform 0.2s, box-shadow 0.2s',
      userSelect: 'none', whiteSpace: 'nowrap', fontWeight: '600',
      letterSpacing: '-0.2px'
    });
    floatBtn.textContent = '✨ Перефразировать';
    document.body.appendChild(floatBtn);

    floatBtn.addEventListener('mouseenter', () => {
      floatBtn.style.transform = 'scale(1.05)';
      floatBtn.style.boxShadow = isDark ? '0 6px 20px rgba(10,132,255,0.5)' : '0 6px 20px rgba(0,122,255,0.4)';
    });
    floatBtn.addEventListener('mouseleave', () => {
      floatBtn.style.transform = 'scale(1)';
      applyThemeToFloatElements();
    });

    floatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sel = window.getSelection(); const text = sel ? sel.toString().trim() : '';
      if (!text) return;
      hideFloatButton();
      chrome.runtime.sendMessage({ action: "rephrase", text }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response?.success && response.text) {
          replaceSelection(response.text);
          if (response.playSound) playCompletionSound();
        }
      });
    });

    floatBtn.addEventListener('mouseenter', () => {
      const sel = window.getSelection(); const text = sel ? sel.toString().trim() : '';
      if (!text) return;
      previewTimeout = setTimeout(() => {
        chrome.runtime.sendMessage({ action: "preview", text }, (response) => {
          if (response?.success && response.text) showPreviewTooltip(response.text);
          else showPreviewTooltip('⚠️ ' + (response?.error?.includes('API key') ? '🔑 Введите API-ключ' : 'Ошибка загрузки'));
        });
      }, 300);
    });
    floatBtn.addEventListener('mouseleave', () => { clearTimeout(previewTimeout); hidePreviewTooltip(); });
    applyThemeToFloatElements();
  }

  function showPreviewTooltip(text) {
    if (!previewTooltip) {
      previewTooltip = document.createElement('div');
      Object.assign(previewTooltip.style, {
        position: 'fixed', zIndex: '2147483647', background: '#333', color: 'white',
        padding: '8px 12px', borderRadius: '8px', fontSize: '13px', maxWidth: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)', pointerEvents: 'none', lineHeight: '1.4'
      });
      document.body.appendChild(previewTooltip);
    }
    previewTooltip.textContent = text;
    const rect = floatBtn.getBoundingClientRect();
    previewTooltip.style.left = rect.left + 'px';
    previewTooltip.style.top = (rect.bottom + 5) + 'px';
    previewTooltip.style.display = 'block';
  }
  function hidePreviewTooltip() { if (previewTooltip) previewTooltip.style.display = 'none'; }

  function positionFloatButton(selection) {
    if (!floatBtn) createFloatButton();
    const range = selection.getRangeAt(0); const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) { floatBtn.style.display = 'none'; return; }
    floatBtn.style.display = 'block';
    floatBtn.style.left = Math.min(rect.right + 10, window.innerWidth - 180) + 'px';
    floatBtn.style.top = Math.min(rect.top - 40, window.innerHeight - 50) + 'px';
  }
  function hideFloatButton() { if (floatBtn) floatBtn.style.display = 'none'; }

  let progressBar = null;
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "showProgress") {
      if (message.visible) showProgressBar(); else hideProgressBar();
    }
  });
  function showProgressBar() {
    if (progressBar) return;
    progressBar = document.createElement('div');
    progressBar.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 3px; background: #007aff;
      z-index: 2147483647; animation: textPolisherProgress 2s ease-in-out infinite;
    `;
    const style = document.createElement('style');
    style.textContent = '@keyframes textPolisherProgress { 0% { width: 0; } 50% { width: 70%; } 100% { width: 100%; } }';
    document.head.appendChild(style);
    document.body.appendChild(progressBar);
  }
  function hideProgressBar() { if (progressBar) { progressBar.remove(); progressBar = null; } }

  document.addEventListener('keydown', (e) => { if (e.key === 'Control' || e.key === 'Meta') ctrlKeyDown = true; });
  document.addEventListener('keyup', (e) => { if (e.key === 'Control' || e.key === 'Meta') { ctrlKeyDown = false; hideCtrlPreview(); } });

  function showCtrlPreview(text) {
    if (!ctrlPreviewBox) {
      ctrlPreviewBox = document.createElement('div');
      Object.assign(ctrlPreviewBox.style, {
        position: 'fixed', zIndex: '2147483647', background: '#333', color: 'white',
        padding: '10px 14px', borderRadius: '10px', fontSize: '14px', maxWidth: '400px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)', pointerEvents: 'none', lineHeight: '1.5'
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
  function hideCtrlPreview() { if (ctrlPreviewBox) ctrlPreviewBox.style.display = 'none'; }

  document.addEventListener('mouseup', (e) => {
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) { hideFloatButton(); return; }
      const activeEl = document.activeElement;
      const isEditable = activeEl && (activeEl.tagName === 'TEXTAREA' ||
                          (activeEl.tagName === 'INPUT' && activeEl.type === 'text') ||
                          activeEl.isContentEditable);
      if (!isEditable) { hideFloatButton(); return; }

      if (ctrlKeyDown) {
        hideFloatButton();
        const text = selection.toString().trim();
        chrome.runtime.sendMessage({ action: "preview", text }, (response) => {
          if (response?.success && response.text) showCtrlPreview(response.text);
          else showCtrlPreview('⚠️ Ошибка предпросмотра');
        });
      } else {
        positionFloatButton(selection);
      }
    }, 10);
  });

  document.addEventListener('mousedown', (e) => { if (floatBtn && !floatBtn.contains(e.target)) hideFloatButton(); });
  window.addEventListener('blur', () => { ctrlKeyDown = false; hideCtrlPreview(); });

  function replaceSelection(newText) {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "TEXTAREA" || (activeEl.tagName === "INPUT" && activeEl.type === "text"))) {
      const start = activeEl.selectionStart;
      const end = activeEl.selectionEnd;
      if (start != null && end != null && start !== end) {
        activeEl.setRangeText(newText, start, end, "select");
        activeEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(newText));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  function playCompletionSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.value = 800;
      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
  }
})();