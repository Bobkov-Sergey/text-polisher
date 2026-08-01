const MENU_ID = "rephrase-text";

// Стили
const STYLES = {
  corporate: "Ты профессиональный редактор. Перефразируй следующий текст в корпоративном официальном стиле, строго сохраняя его исходный смысл. НЕ добавляй новых идей, не предлагай решений, не комментируй. Отвечай ТОЛЬКО перефразированным текстом без кавычек, пояснений и дополнительной информации.",
  neutral: "Ты профессиональный редактор. Перефразируй следующий текст в нейтральном, спокойном стиле, избегая крайностей, строго сохраняя его исходный смысл. НЕ добавляй новых идей, не предлагай решений, не комментируй. Отвечай ТОЛЬКО перефразированным текстом без кавычек, пояснений и дополнительной информации.",
  friendly: "Ты профессиональный редактор. Перефразируй следующий текст в дружеском, но деловом стиле, сохраняя профессионализм и исходный смысл. НЕ добавляй новых идей, не предлагай решений, не комментируй. Отвечай ТОЛЬКО перефразированным текстом без кавычек, пояснений и дополнительной информации.",
  concise: "Ты профессиональный редактор. Сделай следующий текст максимально лаконичным, убери лишние слова, строго сохранив его исходный смысл. НЕ добавляй новых идей, не предлагай решений, не комментируй. Отвечай ТОЛЬКО перефразированным текстом без кавычек, пояснений и дополнительной информации.",
  persuasive: "Ты профессиональный редактор. Перефразируй следующий текст убедительно, с акцентом на выгоду и действие, но строго сохраняя его исходный смысл. НЕ добавляй новых идей, не предлагай решений, не комментируй. Отвечай ТОЛЬКО перефразированным текстом без кавычек, пояснений и дополнительной информации."
};

const STYLE_NAMES = {
  corporate: "Корпоративный",
  neutral: "Нейтральный",
  friendly: "Дружеский",
  concise: "Лаконичный",
  persuasive: "Убедительный"
};

const PROVIDERS = {
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    headers: (apiKey) => ({ "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }),
    buildBody: (text, stylePrompt) => ({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "system", content: stylePrompt }, { role: "user", content: text }],
      temperature: 0.3, max_tokens: 2000
    }),
    parseResponse: (data) => data.choices[0].message.content.trim()
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    headers: (apiKey) => ({ "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }),
    buildBody: (text, stylePrompt) => ({
      model: "gpt-3.5-turbo",
      messages: [{ role: "system", content: stylePrompt }, { role: "user", content: text }],
      temperature: 0.3, max_tokens: 2000
    }),
    parseResponse: (data) => data.choices[0].message.content.trim()
  },
  deepseek: {
    url: "https://api.deepseek.com/v1/chat/completions",
    headers: (apiKey) => ({ "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }),
    buildBody: (text, stylePrompt) => ({
      model: "deepseek-chat",
      messages: [{ role: "system", content: stylePrompt }, { role: "user", content: text }],
      temperature: 0.3, max_tokens: 2000
    }),
    parseResponse: (data) => data.choices[0].message.content.trim()
  },
  gemini: {
    buildUrl: (apiKey) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    headers: () => ({ "Content-Type": "application/json" }),
    buildBody: (text, stylePrompt) => ({
      contents: [{ parts: [{ text: `${stylePrompt}\n\nТекст для перефразирования:\n${text}` }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2000 }
    }),
    parseResponse: (data) => data.candidates[0].content.parts[0].text.trim()
  }
};

async function getSettings() {
  const res = await chrome.storage.sync.get(["provider", "apiKey", "style", "soundEnabled"]);
  return {
    provider: res.provider || "groq",
    apiKey: res.apiKey,
    style: res.style || "corporate",
    soundEnabled: res.soundEnabled !== false
  };
}

async function ensureContextMenu() {
  try {
    const { style } = await getSettings();
    const styleName = STYLE_NAMES[style] || "Корпоративный";
    chrome.contextMenus.update(MENU_ID, { title: `Перефразировать (${styleName})` }, () => {
      if (chrome.runtime.lastError) {
        chrome.contextMenus.create({
          id: MENU_ID,
          title: `Перефразировать (${styleName})`,
          contexts: ["selection"]
        });
      }
    });
  } catch (e) {}
}

chrome.runtime.onInstalled.addListener((details) => {
  ensureContextMenu();
  chrome.action.setBadgeBackgroundColor({ color: "#007aff" });
  updateDailyBadge();
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  }
});

chrome.runtime.onStartup.addListener(() => {
  ensureContextMenu();
  updateDailyBadge();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.style || changes.provider)) {
    ensureContextMenu();
  }
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === "missing-api-key" && buttonIndex === 0) {
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "rephrase") {
    processTextForContentScript(request.text, sender?.tab?.id, sendResponse);
    return true;
  }
  if (request.action === "preview") {
    previewText(request.text, sender?.tab?.id)
      .then(preview => sendResponse({ success: true, text: preview }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (request.action === "showProgress") {
    if (sender?.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, { action: "showProgress", visible: request.visible }).catch(() => {});
    }
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && info.selectionText) {
    const text = info.selectionText.trim();
    if (!text) return;
    processTextWithScripting(text, tab.id);
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "rephrase") {
    chrome.scripting.executeScript(
      { target: { tabId: tab.id }, func: () => window.getSelection()?.toString() || "" },
      (results) => {
        const text = (results?.[0]?.result || "").trim();
        if (text) processTextWithScripting(text, tab.id);
        else {
          chrome.notifications.create({
            type: "basic", iconUrl: "icon48.png",
            title: "Нет выделенного текста",
            message: "Пожалуйста, выделите текст перед перефразированием."
          });
        }
      }
    );
  } else if (command === "undo") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const orig = window._textPolisherOriginal;
        if (!orig) return false;
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "TEXTAREA" || (activeEl.tagName === "INPUT" && activeEl.type === "text"))) {
          const start = activeEl.selectionStart;
          const end = activeEl.selectionEnd;
          activeEl.setRangeText(orig, start, end, "select");
          activeEl.dispatchEvent(new Event("input", { bubbles: true }));
          delete window._textPolisherOriginal;
          return true;
        }
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(orig));
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
          delete window._textPolisherOriginal;
          return true;
        }
        return false;
      }
    });
  }
});

async function processTextForContentScript(text, tabId, sendResponse) {
  const settings = await getSettings();
  if (!settings.apiKey) {
    chrome.notifications.create("missing-api-key", {
      type: "basic", iconUrl: "icon48.png",
      title: "API ключ не указан",
      message: "Для работы расширения необходимо добавить API ключ в настройках.",
      buttons: [{ title: "Открыть настройки" }],
      requireInteraction: true
    });
    chrome.runtime.openOptionsPage();
    sendResponse({ success: false, error: "API key missing" });
    return;
  }

  const stylePrompt = STYLES[settings.style] || STYLES.corporate;
  const provider = PROVIDERS[settings.provider];
  if (!provider) {
    sendResponse({ success: false, error: "Unknown provider" });
    return;
  }

  if (tabId) {
    chrome.tabs.sendMessage(tabId, { action: "showProgress", visible: true }).catch(() => {});
  }

  try {
    const url = provider.buildUrl ? provider.buildUrl(settings.apiKey) : provider.url;
    const response = await fetch(url, {
      method: "POST",
      headers: provider.headers ? provider.headers(settings.apiKey) : provider.headers(),
      body: JSON.stringify(provider.buildBody(text, stylePrompt))
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(`API error: ${response.status} ${errData?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const rephrased = provider.parseResponse(data);

    sendResponse({ success: true, text: rephrased, playSound: settings.soundEnabled });

    saveToHistory(text, rephrased, settings.provider);
    updateStatistics(settings.provider, settings.style);

  } catch (error) {
    console.error("Rephrase error:", error);
    chrome.notifications.create({
      type: "basic", iconUrl: "icon48.png",
      title: "Ошибка перефразирования",
      message: error.message || "Не удалось выполнить запрос."
    });
    sendResponse({ success: false, error: error.message });
  } finally {
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { action: "showProgress", visible: false }).catch(() => {});
    }
  }
}

async function processTextWithScripting(text, tabId) {
  const settings = await getSettings();
  if (!settings.apiKey) {
    chrome.notifications.create("missing-api-key", {
      type: "basic", iconUrl: "icon48.png",
      title: "API ключ не указан",
      message: "Для работы расширения необходимо добавить API ключ в настройках.",
      buttons: [{ title: "Открыть настройки" }],
      requireInteraction: true
    });
    chrome.runtime.openOptionsPage();
    return;
  }

  const stylePrompt = STYLES[settings.style] || STYLES.corporate;
  const provider = PROVIDERS[settings.provider];
  if (!provider) return;

  chrome.tabs.sendMessage(tabId, { action: "showProgress", visible: true }).catch(() => {});

  try {
    const url = provider.buildUrl ? provider.buildUrl(settings.apiKey) : provider.url;
    const response = await fetch(url, {
      method: "POST",
      headers: provider.headers ? provider.headers(settings.apiKey) : provider.headers(),
      body: JSON.stringify(provider.buildBody(text, stylePrompt))
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(`API error: ${response.status} ${errData?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const rephrased = provider.parseResponse(data);

    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => { const sel = window.getSelection(); window._textPolisherOriginal = sel ? sel.toString() : ""; }
    });

    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: replaceSelection,
      args: [rephrased]
    });

    chrome.notifications.create({
      type: "basic", iconUrl: "icon48.png",
      title: "Готово", message: "Текст успешно перефразирован."
    });

    if (settings.soundEnabled) {
      chrome.scripting.executeScript({ target: { tabId: tabId }, func: playCompletionSound });
    }

    saveToHistory(text, rephrased, settings.provider);
    updateStatistics(settings.provider, settings.style);

  } catch (error) {
    console.error("Rephrase error:", error);
    chrome.notifications.create({
      type: "basic", iconUrl: "icon48.png",
      title: "Ошибка перефразирования",
      message: error.message || "Не удалось выполнить запрос."
    });
  } finally {
    chrome.tabs.sendMessage(tabId, { action: "showProgress", visible: false }).catch(() => {});
  }
}

async function previewText(text, tabId) {
  const settings = await getSettings();
  if (!settings.apiKey) throw new Error("API key missing");
  const stylePrompt = STYLES[settings.style] || STYLES.corporate;
  const provider = PROVIDERS[settings.provider];
  const url = provider.buildUrl ? provider.buildUrl(settings.apiKey) : provider.url;
  const response = await fetch(url, {
    method: "POST",
    headers: provider.headers ? provider.headers(settings.apiKey) : provider.headers(),
    body: JSON.stringify(provider.buildBody(text, stylePrompt))
  });
  if (!response.ok) {
    const errData = await response.json();
    throw new Error(`API error: ${response.status}`);
  }
  const data = await response.json();
  return provider.parseResponse(data);
}

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

async function saveToHistory(original, rephrased, provider) {
  const { historyEnabled } = await chrome.storage.sync.get(["historyEnabled"]);
  if (historyEnabled === false) return;
  const { history = [] } = await chrome.storage.local.get(["history"]);
  history.unshift({ original, rephrased, provider, timestamp: Date.now(), isFavorite: false });
  if (history.length > 100) history.length = 100;
  await chrome.storage.local.set({ history });
}

async function updateStatistics(provider, style) {
  const { stats = {} } = await chrome.storage.local.get(["stats"]);
  stats.total = (stats.total || 0) + 1;
  stats.providers = stats.providers || {};
  stats.providers[provider] = (stats.providers[provider] || 0) + 1;
  stats.styles = stats.styles || {};
  stats.styles[style] = (stats.styles[style] || 0) + 1;
  const today = new Date().toDateString();
  if (stats.lastDate !== today) { stats.dailyCount = 1; stats.lastDate = today; }
  else { stats.dailyCount = (stats.dailyCount || 0) + 1; }
  await chrome.storage.local.set({ stats });
  updateDailyBadge(stats.dailyCount);
}

function updateDailyBadge(count) {
  if (count === undefined) {
    chrome.storage.local.get(["stats"], (res) => {
      const stats = res.stats || {};
      const today = new Date().toDateString();
      const daily = (stats.lastDate === today) ? (stats.dailyCount || 0) : 0;
      chrome.action.setBadgeText({ text: daily > 0 ? String(daily) : "" });
    });
  } else {
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  }
}