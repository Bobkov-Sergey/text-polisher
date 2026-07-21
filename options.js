document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("apiKey");
  const saveBtn = document.getElementById("saveBtn");
  const statusDiv = document.getElementById("status");

  chrome.storage.sync.get(["groqApiKey"], (result) => {
    if (result.groqApiKey) {
      apiKeyInput.value = result.groqApiKey;
    }
  });

  saveBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    chrome.storage.sync.set({ groqApiKey: key }, () => {
      statusDiv.textContent = "Ключ сохранён!";
      setTimeout(() => (statusDiv.textContent = ""), 2000);
    });
  });
});