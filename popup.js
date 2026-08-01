document.addEventListener('DOMContentLoaded', () => {
  const inputText = document.getElementById('inputText');
  const charCount = document.getElementById('charCount');
  const clearInputBtn = document.getElementById('clearInputBtn');
  const rephraseBtn = document.getElementById('rephraseFromPopupBtn');
  const pasteBtn = document.getElementById('pasteFromClipboardBtn');
  const copyBtn = document.getElementById('copyResultBtn');
  const copyIcon = document.getElementById('copyIcon');
  const resultContainer = document.getElementById('resultContainer');
  const openSettingsLink = document.getElementById('openSettings');

  inputText.addEventListener('input', () => {
    charCount.textContent = `${inputText.value.length} / 5000`;
  });

  clearInputBtn.addEventListener('click', () => {
    inputText.value = '';
    inputText.focus();
    charCount.textContent = '0 / 5000';
  });

  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      inputText.value = text;
      inputText.dispatchEvent(new Event('input'));
    } catch (err) {
      inputText.value = 'Не удалось прочитать буфер обмена.';
    }
  });

  rephraseBtn.addEventListener('click', () => {
    const text = inputText.value.trim();
    if (!text) return;

    resultContainer.innerHTML = `<div class="loading-text"><span class="spinner"></span> Перефразируем...</div>`;

    chrome.runtime.sendMessage({ action: "rephrase", text }, (response) => {
      if (chrome.runtime.lastError) {
        resultContainer.textContent = 'Ошибка: нет соединения с расширением.';
        return;
      }
      if (response?.success && response.text) {
        resultContainer.textContent = response.text;
      } else {
        resultContainer.textContent = 'Ошибка: ' + (response?.error || 'неизвестно');
      }
    });
  });

  copyBtn.addEventListener('click', async () => {
    const text = resultContainer.textContent;
    if (!text || text === 'Перефразированный текст появится здесь' || resultContainer.querySelector('.loading-text')) return;
    try {
      await navigator.clipboard.writeText(text);
      copyIcon.innerHTML = '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>';
      copyBtn.style.color = '#0f9d58';
      setTimeout(() => {
        copyIcon.innerHTML = '<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>';
        copyBtn.style.color = '';
      }, 2000);
    } catch (err) {
      copyIcon.innerHTML = '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>';
      copyBtn.style.color = '#ea4335';
      setTimeout(() => {
        copyIcon.innerHTML = '<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>';
        copyBtn.style.color = '';
      }, 2000);
    }
  });

  openSettingsLink.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});