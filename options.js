document.addEventListener("DOMContentLoaded", () => {
  const providerSelect = document.getElementById("provider");
  const apiKeyInput = document.getElementById("apiKey");
  const saveBtn = document.getElementById("saveBtn");
  const clearKeyBtn = document.getElementById("clearKeyBtn");
  const testConnBtn = document.getElementById("testConnBtn");
  const testConnIcon = document.getElementById("testConnIcon");
  const testConnSpinner = document.getElementById("testConnSpinner");
  const styleSelect = document.getElementById("style");
  const saveStyleBtn = document.getElementById("saveStyleBtn");
  const historyEnabledCheck = document.getElementById("historyEnabled");
  const soundEnabledCheck = document.getElementById("soundEnabled");
  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const historySearch = document.getElementById("historySearch");
  const exportCSVBtn = document.getElementById("exportCSVBtn");
  const exportJSONBtn = document.getElementById("exportJSONBtn");
  const statsContainer = document.getElementById("statsContainer");
  const feedbackBtn = document.getElementById("feedbackBtn");
  const pinBtn = document.getElementById("pinExtensionBtn");

  const tabButtons = document.querySelectorAll(".sidebar-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      tabButtons.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(tabId).classList.add("active");
      if (tabId === "historyTab") loadHistory();
      if (tabId === "statsTab") loadStats();
    });
  });

  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  function showToast(content) {
    const existing = document.querySelector('.toast-message');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    if (typeof content === 'string' && content.includes('<')) {
      toast.innerHTML = content;
    } else {
      toast.textContent = content;
    }
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px;
      background: ${isDarkMode ? '#3a3a3c' : '#f1f3f4'};
      color: ${isDarkMode ? '#e8eaed' : '#202124'};
      padding: 10px 20px; border-radius: 8px;
      font-size: 14px; font-weight: 400; z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      opacity: 0; transition: opacity 0.3s;
      border: 1px solid ${isDarkMode ? '#5f6368' : '#dadce0'};
      display: flex; align-items: center; gap: 8px;
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.style.opacity = '1');
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  chrome.storage.sync.get(["provider", "apiKey", "style", "historyEnabled", "soundEnabled", "groqApiKey"], (res) => {
    if (!res.provider && !res.apiKey && res.groqApiKey) {
      providerSelect.value = "groq"; apiKeyInput.value = res.groqApiKey;
      chrome.storage.sync.set({ provider: "groq", apiKey: res.groqApiKey });
      chrome.storage.sync.remove("groqApiKey"); return;
    }
    if (res.provider) providerSelect.value = res.provider;
    if (res.apiKey) apiKeyInput.value = res.apiKey;
    if (res.style) styleSelect.value = res.style;
    historyEnabledCheck.checked = res.historyEnabled !== false;
    soundEnabledCheck.checked = res.soundEnabled !== false;
  });

  saveBtn.addEventListener("click", () => {
    const provider = providerSelect.value; const key = apiKeyInput.value.trim();
    chrome.storage.sync.set({ provider, apiKey: key }, () => {
      showToast("API ключ сохранён");
    });
  });

  clearKeyBtn.addEventListener("click", () => {
    apiKeyInput.value = "";
    chrome.storage.sync.remove("apiKey", () => {
      showToast("Ключ удалён");
    });
  });

  testConnBtn.addEventListener("click", () => {
    const provider = providerSelect.value; const apiKey = apiKeyInput.value.trim();
    if (!apiKey) { showToast("Введите API ключ для проверки"); return; }
    testConnIcon.style.display = "none"; testConnSpinner.style.display = "inline-block"; testConnBtn.disabled = true;
    let url, headers;
    if (provider === "groq" || provider === "openai" || provider === "deepseek") {
      url = provider === "groq" ? "https://api.groq.com/openai/v1/models" : provider === "openai" ? "https://api.openai.com/v1/models" : "https://api.deepseek.com/v1/models";
      headers = { "Authorization": `Bearer ${apiKey}` };
    } else if (provider === "gemini") {
      url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    }
    fetch(url, { headers }).then(resp => {
      if (resp.ok) showToast("Соединение успешно!");
      else showToast(`Ошибка: ${resp.status}`);
    }).catch(err => showToast(`Ошибка сети: ${err.message}`))
    .finally(() => { testConnIcon.style.display = "inline"; testConnSpinner.style.display = "none"; testConnBtn.disabled = false; });
  });

  saveStyleBtn.addEventListener("click", () => {
    const style = styleSelect.value;
    chrome.storage.sync.set({ style }, () => {
      showToast("Стиль сохранён");
    });
  });

  historyEnabledCheck.addEventListener("change", () => chrome.storage.sync.set({ historyEnabled: historyEnabledCheck.checked }));
  soundEnabledCheck.addEventListener("change", () => chrome.storage.sync.set({ soundEnabled: soundEnabledCheck.checked }));

  let historyData = [];
  function showHistorySkeleton() { historyList.innerHTML = '<div class="skeleton skeleton-line long"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div>'; }
  function loadHistory() { showHistorySkeleton(); chrome.storage.local.get(["history"], (res) => { historyData = res.history || []; renderHistory(); }); }
  function renderHistory() {
    const query = (historySearch.value || "").toLowerCase();
    const filtered = historyData.filter(item => item.original.toLowerCase().includes(query) || item.rephrased.toLowerCase().includes(query) || (item.provider && item.provider.toLowerCase().includes(query)));
    if (!filtered.length) { historyList.innerHTML = '<p style="color:#5f6368;">История пуста.</p>'; return; }
    historyList.innerHTML = filtered.map(item => `
      <div class="history-item" data-timestamp="${item.timestamp}">
        <button class="favorite-btn ${item.isFavorite ? 'active' : ''}" data-timestamp="${item.timestamp}">
          <svg viewBox="0 0 24 24">
            <path d="${item.isFavorite ? 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z' : 'M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z'}"/>
          </svg>
        </button>
        <div class="history-content"><div class="history-meta">${new Date(item.timestamp).toLocaleString()} · ${item.provider}</div><div><strong>Исходный:</strong> ${escapeHTML(item.original)}</div><div><strong>Перефразированный:</strong> ${escapeHTML(item.rephrased)}</div></div>
      </div>`).join("");
    document.querySelectorAll(".favorite-btn").forEach(btn => btn.addEventListener("click", () => toggleFavorite(Number(btn.dataset.timestamp))));
  }
  function toggleFavorite(ts) { const item = historyData.find(i => i.timestamp === ts); if (!item) return; item.isFavorite = !item.isFavorite; chrome.storage.local.set({ history: historyData }, () => renderHistory()); }
  historySearch.addEventListener("input", renderHistory);
  clearHistoryBtn.addEventListener("click", () => { chrome.storage.local.remove("history", () => { historyData = []; renderHistory(); }); });
  function downloadFile(content, filename, mimeType) { const blob = new Blob([content], { type: mimeType }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href); }
  exportCSVBtn.addEventListener("click", () => { const csv = "timestamp,provider,original,rephrased\n" + historyData.map(i => `"${new Date(i.timestamp).toISOString()}","${i.provider}","${i.original.replace(/"/g,'""')}","${i.rephrased.replace(/"/g,'""')}"`).join("\n"); downloadFile(csv, "text-polisher-history.csv", "text/csv"); });
  exportJSONBtn.addEventListener("click", () => { downloadFile(JSON.stringify(historyData, null, 2), "text-polisher-history.json", "application/json"); });

  function loadStats() { chrome.storage.local.get(["stats"], (res) => { const stats = res.stats || {}; const total = stats.total || 0; const providers = stats.providers || {}; const styles = stats.styles || {}; const pNames = { groq:"Groq", openai:"OpenAI", deepseek:"DeepSeek", gemini:"Gemini" }; const sNames = { corporate:"Корпоративный", neutral:"Нейтральный", friendly:"Дружеский", concise:"Лаконичный", persuasive:"Убедительный" }; let html = `<p>Всего: <strong>${total}</strong></p>`; if (Object.keys(providers).length) { html += "<p><strong>По провайдерам:</strong></p><ul>"; for (const [k,v] of Object.entries(providers)) html += `<li>${pNames[k]||k}: ${v}</li>`; html += "</ul>"; } if (Object.keys(styles).length) { html += "<p><strong>По стилям:</strong></p><ul>"; for (const [k,v] of Object.entries(styles)) html += `<li>${sNames[k]||k}: ${v}</li>`; html += "</ul>"; } statsContainer.innerHTML = html || "<p>Статистика пока пуста.</p>"; }); }
  if (feedbackBtn) feedbackBtn.addEventListener("click", () => chrome.tabs.create({ url: "https://github.com/Bobkov-Sergey/text-polisher" }));
  function escapeHTML(str) { const div = document.createElement("div"); div.textContent = str; return div.innerHTML; }

  if (pinBtn) {
    pinBtn.addEventListener('click', () => {
      const puzzleIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8h3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-3.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/></svg>`;
      showToast(`${puzzleIcon} Нажмите на значок пазла на панели инструментов и закрепите Text Polisher`);
    });
  }
});