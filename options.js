document.addEventListener("DOMContentLoaded", () => {
  // Элементы настроек
  const providerSelect = document.getElementById("provider");
  const apiKeyInput = document.getElementById("apiKey");
  const saveBtn = document.getElementById("saveBtn");
  const clearKeyBtn = document.getElementById("clearKeyBtn");
  const testConnBtn = document.getElementById("testConnBtn");
  const testConnText = document.getElementById("testConnText");
  const testConnSpinner = document.getElementById("testConnSpinner");
  const apiStatusDiv = document.getElementById("apiStatus");
  const styleSelect = document.getElementById("style");
  const saveStyleBtn = document.getElementById("saveStyleBtn");
  const styleStatusDiv = document.getElementById("styleStatus");
  const historyEnabledCheck = document.getElementById("historyEnabled");
  const soundEnabledCheck = document.getElementById("soundEnabled");
  const feedbackBtn = document.getElementById("feedbackBtn");

  // История
  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const historySearch = document.getElementById("historySearch");
  const exportCSVBtn = document.getElementById("exportCSVBtn");
  const exportJSONBtn = document.getElementById("exportJSONBtn");

  // Статистика
  const statsContainer = document.getElementById("statsContainer");

  // Вкладки
  const tabButtons = document.querySelectorAll(".tab-btn");
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

  function showApiStatus(msg, isError = false) {
    apiStatusDiv.textContent = msg;
    apiStatusDiv.style.color = isError ? "#ff3b30" : "#34c759";
    apiStatusDiv.classList.add("visible");
    setTimeout(() => apiStatusDiv.classList.remove("visible"), 3000);
  }

  function showStyleStatus(msg) {
    styleStatusDiv.textContent = msg;
    styleStatusDiv.style.color = "#34c759";
    styleStatusDiv.classList.add("visible");
    setTimeout(() => styleStatusDiv.classList.remove("visible"), 3000);
  }

  // Загрузка настроек
  chrome.storage.sync.get(
    ["provider", "apiKey", "style", "historyEnabled", "soundEnabled", "groqApiKey"],
    (res) => {
      if (!res.provider && !res.apiKey && res.groqApiKey) {
        providerSelect.value = "groq";
        apiKeyInput.value = res.groqApiKey;
        chrome.storage.sync.set({ provider: "groq", apiKey: res.groqApiKey });
        chrome.storage.sync.remove("groqApiKey");
        return;
      }
      if (res.provider) providerSelect.value = res.provider;
      if (res.apiKey) apiKeyInput.value = res.apiKey;
      if (res.style) styleSelect.value = res.style;
      historyEnabledCheck.checked = res.historyEnabled !== false;
      soundEnabledCheck.checked = res.soundEnabled !== false;
    }
  );

  saveBtn.addEventListener("click", () => {
    const provider = providerSelect.value;
    const key = apiKeyInput.value.trim();
    chrome.storage.sync.set({ provider, apiKey: key }, () => showApiStatus("Настройки сохранены!"));
  });

  clearKeyBtn.addEventListener("click", () => {
    apiKeyInput.value = "";
    chrome.storage.sync.remove("apiKey", () => showApiStatus("Ключ удалён."));
  });

  testConnBtn.addEventListener("click", () => {
    const provider = providerSelect.value;
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) { showApiStatus("Введите API ключ для проверки.", true); return; }
    testConnText.style.display = "none";
    testConnSpinner.style.display = "inline-block";
    testConnBtn.disabled = true;
    let url, headers;
    if (provider === "groq" || provider === "openai" || provider === "deepseek") {
      url = provider === "groq" ? "https://api.groq.com/openai/v1/models" :
            provider === "openai" ? "https://api.openai.com/v1/models" :
            "https://api.deepseek.com/v1/models";
      headers = { "Authorization": `Bearer ${apiKey}` };
    } else if (provider === "gemini") {
      url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    }
    fetch(url, { headers })
      .then(resp => {
        if (resp.ok) showApiStatus("Соединение успешно!");
        else showApiStatus(`Ошибка: ${resp.status}`, true);
      })
      .catch(err => showApiStatus(`Ошибка сети: ${err.message}`, true))
      .finally(() => {
        testConnText.style.display = "inline";
        testConnSpinner.style.display = "none";
        testConnBtn.disabled = false;
      });
  });

  saveStyleBtn.addEventListener("click", () => {
    const style = styleSelect.value;
    chrome.storage.sync.set({ style }, () => showStyleStatus("Стиль сохранён."));
  });

  historyEnabledCheck.addEventListener("change", () => {
    chrome.storage.sync.set({ historyEnabled: historyEnabledCheck.checked });
  });

  soundEnabledCheck.addEventListener("change", () => {
    chrome.storage.sync.set({ soundEnabled: soundEnabledCheck.checked });
  });

  // История
  let historyData = [];
  function loadHistory() {
    chrome.storage.local.get(["history"], (res) => {
      historyData = res.history || [];
      renderHistory();
    });
  }

  function renderHistory() {
    const query = (historySearch.value || "").toLowerCase();
    const filtered = historyData.filter(item =>
      item.original.toLowerCase().includes(query) ||
      item.rephrased.toLowerCase().includes(query) ||
      (item.provider && item.provider.toLowerCase().includes(query))
    );
    if (!filtered.length) {
      historyList.innerHTML = '<p style="color:#86868b;">История пуста.</p>';
      return;
    }
    historyList.innerHTML = filtered.map(item => `
      <div class="history-item" data-timestamp="${item.timestamp}">
        <button class="favorite-btn ${item.isFavorite ? 'active' : ''}" data-timestamp="${item.timestamp}">★</button>
        <div class="history-content">
          <div class="history-meta">${new Date(item.timestamp).toLocaleString()} · ${item.provider}</div>
          <div><strong>Исходный:</strong> ${escapeHTML(item.original)}</div>
          <div><strong>Перефразированный:</strong> ${escapeHTML(item.rephrased)}</div>
        </div>
      </div>
    `).join("");

    // Обработчики звездочек
    document.querySelectorAll(".favorite-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const ts = Number(btn.dataset.timestamp);
        toggleFavorite(ts);
      });
    });
  }

  function toggleFavorite(timestamp) {
    const item = historyData.find(i => i.timestamp === timestamp);
    if (!item) return;
    item.isFavorite = !item.isFavorite;
    chrome.storage.local.set({ history: historyData }, () => renderHistory());
  }

  historySearch.addEventListener("input", renderHistory);

  clearHistoryBtn.addEventListener("click", () => {
    chrome.storage.local.remove("history", () => {
      historyData = [];
      renderHistory();
    });
  });

  // Экспорт
  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportCSVBtn.addEventListener("click", () => {
    const csv = "timestamp,provider,original,rephrased\n" +
      historyData.map(i => `"${new Date(i.timestamp).toISOString()}","${i.provider}","${i.original.replace(/"/g,'""')}","${i.rephrased.replace(/"/g,'""')}"`).join("\n");
    downloadFile(csv, "text-polisher-history.csv", "text/csv");
  });

  exportJSONBtn.addEventListener("click", () => {
    const json = JSON.stringify(historyData, null, 2);
    downloadFile(json, "text-polisher-history.json", "application/json");
  });

  // Статистика
  function loadStats() {
    chrome.storage.local.get(["stats"], (res) => {
      const stats = res.stats || {};
      const total = stats.total || 0;
      const providers = stats.providers || {};
      const styles = stats.styles || {};

      const providerNames = { groq: "Groq", openai: "OpenAI", deepseek: "DeepSeek", gemini: "Gemini" };
      const styleNames = { corporate: "Корпоративный", neutral: "Нейтральный", friendly: "Дружеский", concise: "Лаконичный", persuasive: "Убедительный" };

      let html = `<p>Всего перефразирований: <strong>${total}</strong></p>`;
      if (Object.keys(providers).length) {
        html += "<p><strong>По провайдерам:</strong></p><ul>";
        for (const [key, count] of Object.entries(providers)) {
          html += `<li>${providerNames[key] || key}: ${count}</li>`;
        }
        html += "</ul>";
      }
      if (Object.keys(styles).length) {
        html += "<p><strong>По стилям:</strong></p><ul>";
        for (const [key, count] of Object.entries(styles)) {
          html += `<li>${styleNames[key] || key}: ${count}</li>`;
        }
        html += "</ul>";
      }
      statsContainer.innerHTML = html || "<p>Статистика пока пуста.</p>";
    });
  }

  feedbackBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://github.com/Bobkov-Sergey/text-polisher" });
  });

  // Вспомогательная функция
  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
});