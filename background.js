const MENU_ID = "rephrase-text";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Перефразировать в официальном стиле",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && info.selectionText) {
    const selectedText = info.selectionText.trim();
    if (!selectedText) return;

    chrome.storage.sync.get(["groqApiKey"], (result) => {
      const apiKey = result.groqApiKey;
      if (!apiKey) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icon48.png",
          title: "API ключ отсутствует",
          message: "Пожалуйста, укажите ваш Groq API ключ в настройках расширения."
        });
        return;
      }
      rephraseText(apiKey, selectedText, tab.id);
    });
  }
});

async function rephraseText(apiKey, text, tabId) {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "Ты профессиональный редактор. Перефразируй текст в корпоративном официальном стиле, сохраняя смысл. Отвечай ТОЛЬКО перефразированным текстом без кавычек, пояснений и дополнительной информации."
          },
          { role: "user", content: text }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API error: ${response.status} ${errorData?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const rephrased = data.choices[0].message.content.trim();

    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: replaceSelection,
      args: [rephrased]
    });
  } catch (error) {
    console.error("Rephrase error:", error);
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon48.png",
      title: "Ошибка перефразирования",
      message: error.message || "Не удалось выполнить запрос."
    });
  }
}

function replaceSelection(newText) {
  const activeEl = document.activeElement;

  if (
    activeEl &&
    (activeEl.tagName === "TEXTAREA" ||
      (activeEl.tagName === "INPUT" && activeEl.type === "text"))
  ) {
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