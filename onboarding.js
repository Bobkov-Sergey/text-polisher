document.addEventListener('DOMContentLoaded', () => {
  const dots = document.querySelectorAll('.dot');
  const steps = document.querySelectorAll('.step');
  const providerSelect = document.getElementById('providerSelect');
  const apiKeyInput = document.getElementById('apiKeyInput');
  document.getElementById('toStep2').addEventListener('click', () => { chrome.storage.sync.set({ provider: providerSelect.value }); document.getElementById('step1').classList.remove('active'); document.getElementById('step2').classList.add('active'); dots[0].classList.remove('active'); dots[1].classList.add('active'); });
  document.getElementById('toStep3').addEventListener('click', () => { const key = apiKeyInput.value.trim(); if (!key) { alert('Пожалуйста, введите API-ключ.'); return; } chrome.storage.sync.set({ apiKey: key }, () => { document.getElementById('step2').classList.remove('active'); document.getElementById('step3').classList.add('active'); dots[1].classList.remove('active'); dots[2].classList.add('active'); }); });
  document.getElementById('finishOnboarding').addEventListener('click', () => { window.close(); });
});