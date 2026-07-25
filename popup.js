document.addEventListener('DOMContentLoaded', () => {
  const dailyCountEl = document.getElementById('dailyCount');
  const favoriteProviderEl = document.getElementById('favoriteProvider');
  const favoriteStyleEl = document.getElementById('favoriteStyle');
  const openSettingsLink = document.getElementById('openSettings');

  const providerNames = { groq: "Groq", openai: "OpenAI", deepseek: "DeepSeek", gemini: "Gemini" };
  const styleNames = { corporate: "Корпоративный", neutral: "Нейтральный", friendly: "Дружеский", concise: "Лаконичный", persuasive: "Убедительный" };

  // Загружаем статистику из local storage
  chrome.storage.local.get(["stats"], (res) => {
    const stats = res.stats || {};
    const today = new Date().toDateString();
    const dailyCount = (stats.lastDate === today) ? (stats.dailyCount || 0) : 0;
    dailyCountEl.textContent = dailyCount;

    // Любимый провайдер и стиль – по наибольшему количеству
    const providers = stats.providers || {};
    const styles = stats.styles || {};
    const maxProvider = Object.entries(providers).sort((a,b) => b[1] - a[1])[0];
    const maxStyle = Object.entries(styles).sort((a,b) => b[1] - a[1])[0];
    favoriteProviderEl.textContent = maxProvider ? (providerNames[maxProvider[0]] || maxProvider[0]) : '—';
    favoriteStyleEl.textContent = maxStyle ? (styleNames[maxStyle[0]] || maxStyle[0]) : '—';
  });

  openSettingsLink.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});