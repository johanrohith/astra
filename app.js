(() => {
  "use strict";

  const KEYS = {
    chats: "astra_chats_v1",
    memory: "astra_memory_v1",
    notes: "astra_notes_v1",
    includeMemory: "astra_include_memory_v1",
    speakResponses: "astra_speak_responses_v1",
    accessToken: "astra_access_token_v1"
  };

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const safeRead = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  };
  const safeWrite = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { notify("Browser storage is unavailable or full. Export anything important.", true); return false; }
  };

  const state = {
    view: "core",
    chats: Array.isArray(safeRead(KEYS.chats, [])) ? safeRead(KEYS.chats, []) : [],
    activeId: null,
    memory: safeRead(KEYS.memory, ""),
    notes: Array.isArray(safeRead(KEYS.notes, [])) ? safeRead(KEYS.notes, []) : [],
    includeMemory: safeRead(KEYS.includeMemory, true) !== false,
    speakResponses: safeRead(KEYS.speakResponses, false) === true,
    accessToken: "",
    busy: false,
    recognition: null,
    listening: false,
    startedAt: Date.now(),
    lastResponse: "—",
    apiState: "not-tested"
  };

  const els = {
    sidebar: $("#sidebar"), backdrop: $("#sidebarBackdrop"), chatView: $("#chatView"),
    dataView: $("#dataView"), systemsView: $("#systemsView"), messages: $("#messages"),
    welcome: $("#welcome"), promptGrid: $("#promptGrid"), input: $("#messageInput"),
    composer: $("#composer"), sendBtn: $("#sendBtn"), typing: $("#typingIndicator"),
    history: $("#historyList"), chatCount: $("#chatCount"), toast: $("#toast"),
    connectionBadge: $("#connectionBadge"), connectionLabel: $("#connectionLabel"),
    topTitle: $("#topTitle"), heroTitle: $("#heroTitle"), heroKicker: $("#heroKicker"),
    heroSubtitle: $("#heroSubtitle"), modeLabel: $("#modeLabel"), railMode: $("#railMode"),
    memoryText: $("#memoryText"), includeMemory: $("#includeMemory"), memoryCount: $("#memoryCount"),
    memoryStatus: $("#memoryStatus"), notesList: $("#notesList"), emptyNotes: $("#emptyNotes"),
    settingsDialog: $("#settingsDialog"), accessToken: $("#accessToken"),
    speakResponses: $("#speakResponses"), apiStatus: $("#apiStatus"),
    lastResponseStatus: $("#lastResponseStatus"), voiceStatus: $("#voiceStatus"),
    storageStatus: $("#storageStatus"), systemChatCount: $("#systemChatCount"),
    systemNoteCount: $("#systemNoteCount"), sidebarStatus: $("#sidebarStatus")
  };

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function notify(message, isError) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.toggle("error", Boolean(isError));
    els.toast.classList.add("show");
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => els.toast.classList.remove("show"), 3200);
  }

  function saveChats() {
    safeWrite(KEYS.chats, state.chats.slice(-80));
    updateSystemCounts();
    renderHistory();
  }

  function currentChat() {
    return state.chats.find(chat => chat.id === state.activeId) || null;
  }

  function createChat(silent) {
    const chat = { id: makeId(), title: "New conversation", mode: state.view === "research" ? "research" : "core", messages: [], updatedAt: Date.now() };
    state.chats.push(chat);
    state.activeId = chat.id;
    saveChats();
    renderMessages();
    if (!silent) {
      setView("core");
      closeSidebar();
      els.input.focus();
    }
    return chat;
  }

  function chooseChat(id) {
    const chat = state.chats.find(item => item.id === id);
    if (!chat) return;
    state.activeId = id;
    state.view = chat.mode === "research" ? "research" : "core";
    setView(state.view);
    renderMessages();
    renderHistory();
    closeSidebar();
  }

  function deleteChat(id) {
    const chat = state.chats.find(item => item.id === id);
    if (!chat) return;
    if (!window.confirm("Delete this conversation from this browser?")) return;
    state.chats = state.chats.filter(item => item.id !== id);
    if (state.activeId === id) {
      state.activeId = state.chats.length ? state.chats[state.chats.length - 1].id : null;
    }
    saveChats();
    if (!state.activeId) createChat(true);
    renderMessages();
    notify("Conversation deleted.");
  }

  function renderHistory() {
    if (!els.history) return;
    els.history.replaceChildren();
    const chats = state.chats.slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 40);
    $("#chatCount").textContent = String(chats.length);
    if (!chats.length) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "Your conversations will appear here.";
      els.history.appendChild(empty);
      return;
    }
    chats.forEach(chat => {
      const row = document.createElement("div");
      row.className = "history-item" + (chat.id === state.activeId ? " current" : "");
      const open = document.createElement("button");
      open.type = "button";
      open.className = "history-open";
      open.textContent = chat.title || "New conversation";
      open.title = chat.title || "New conversation";
      open.addEventListener("click", () => chooseChat(chat.id));
      const del = document.createElement("button");
      del.type = "button";
      del.className = "history-delete";
      del.textContent = "×";
      del.title = "Delete conversation";
      del.setAttribute("aria-label", "Delete " + (chat.title || "conversation"));
      del.addEventListener("click", () => deleteChat(chat.id));
      row.append(open, del);
      els.history.appendChild(row);
    });
  }

  function createSourceLinks(sources, container) {
    if (!Array.isArray(sources) || !sources.length) return;
    const wrap = document.createElement("div");
    wrap.className = "message-sources";
    const label = document.createElement("div");
    label.className = "source-label";
    label.textContent = "SOURCES";
    wrap.appendChild(label);
    sources.slice(0, 6).forEach(source => {
      if (!source || typeof source.url !== "string" || !/^https?:\/\//i.test(source.url)) return;
      const anchor = document.createElement("a");
      anchor.className = "source-link";
      anchor.href = source.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = (source.title || source.url).slice(0, 180);
      wrap.appendChild(anchor);
    });
    if (wrap.querySelector("a")) container.appendChild(wrap);
  }

  function renderMessage(message) {
    const row = document.createElement("article");
    row.className = "message " + (message.role === "user" ? "user" : "assistant");
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = message.role === "user" ? "J" : "✳";
    const body = document.createElement("div");
    body.className = "message-body";
    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent = message.role === "user" ? "YOU" : "ASTRA";
    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent = message.content || "";
    body.append(label, content);
    if (message.role !== "user" && message.content) {
      const tools = document.createElement("div");
      tools.className = "message-tools";
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "message-tool";
      copy.textContent = "Copy";
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(message.content);
          notify("Reply copied.");
        } catch (_) { notify("Clipboard permission is unavailable.", true); }
      });
      tools.appendChild(copy);
      const speak = document.createElement("button");
      speak.type = "button";
      speak.className = "message-tool";
      speak.textContent = "Speak";
      speak.addEventListener("click", () => speakText(message.content));
      tools.appendChild(speak);
      body.appendChild(tools);
      createSourceLinks(message.sources, body);
    }
    row.append(avatar, body);
    return row;
  }

  function renderMessages() {
    const chat = currentChat();
    els.messages.replaceChildren();
    if (!chat) {
      els.welcome.classList.remove("hidden");
      renderHistory();
      return;
    }
    chat.messages.forEach(message => els.messages.appendChild(renderMessage(message)));
    els.welcome.classList.toggle("hidden", chat.messages.length > 0);
    if (chat.messages.length) els.messages.scrollTop = els.messages.scrollHeight;
    renderHistory();
  }

  function updateConnection(label, kind) {
    els.connectionLabel.textContent = label;
    els.connectionBadge.classList.remove("disconnected", "error");
    if (kind === "disconnected") els.connectionBadge.classList.add("disconnected");
    if (kind === "error") els.connectionBadge.classList.add("error");
    els.sidebarStatus.textContent = label;
    state.apiState = kind || "ready";
    if (els.apiStatus) {
      els.apiStatus.textContent = label;
      els.apiStatus.classList.toggle("ok", kind === "ok");
      els.apiStatus.classList.toggle("bad", kind === "error");
    }
  }

  function setView(view) {
    state.view = view;
    $$(".nav-link").forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const isChat = view === "core" || view === "research";
    els.chatView.classList.toggle("hidden", !isChat);
    els.dataView.classList.toggle("hidden", view !== "data");
    els.systemsView.classList.toggle("hidden", view !== "systems");
    const title = view === "core" ? "Companion" : view === "research" ? "Research" : view === "data" ? "Memory & notes" : "Systems";
    els.topTitle.textContent = title;
    els.railMode.textContent = title;
    els.heroTitle.innerHTML = view === "research" ? "Let's look closer<span class=\"title-period\">.</span>" : "I'm Astra<span class=\"title-period\">.</span>";
    els.heroKicker.textContent = view === "research" ? "LIVE WEB RESEARCH" : "YOUR PERSONAL COMPANION";
    els.heroSubtitle.textContent = view === "research"
      ? "Bring me a question. I'll look for current sources and show you where the answer comes from."
      : "A little imagination. A lot of intelligence. Always ready to think with you.";
    els.modeLabel.textContent = view === "research" ? "RESEARCH MODE" : "COMPANION MODE";
    els.promptGrid.querySelectorAll("[data-prompt]").forEach((button, index) => {
      const prompts = view === "research"
        ? [
            ["Search for current information about a technology and compare trustworthy sources.", "Find current information"],
            ["Research the latest developments in AI and summarise what matters.", "Explore a topic"],
            ["Compare three approaches to building a personal AI assistant.", "Compare approaches"],
            ["Verify a claim and show me reliable sources for the answer.", "Check a claim"]
          ]
        : [
            ["Help me plan my day around my priorities.", "Plan my day"],
            ["Help me understand a difficult concept step by step.", "Learn something"],
            ["Let's brainstorm an interesting project I could build.", "Build an idea"],
            ["Let's have a thoughtful conversation about something interesting.", "Just talk"]
          ];
      const prompt = prompts[index];
      const titleElement = button.querySelector(".prompt-title");
      const descElement = button.querySelector(".prompt-desc");
      if (titleElement) titleElement.textContent = prompt[1];
      if (descElement && view === "research") {
        const descriptions = ["Use live web search and inspect the sources.", "Get an evidence-led overview, not just a guess.", "Lay out trade-offs with references.", "Separate what is supported from what is uncertain."];
        descElement.textContent = descriptions[index];
      } else if (descElement) {
        const descriptions = ["Turn a noisy to-do list into a clear next step.", "Make a difficult concept feel simple.", "Explore possibilities and make a real plan.", "A conversation without needing a reason."];
        descElement.textContent = descriptions[index];
      }
      button.dataset.prompt = prompt[0];
    });
    if (view === "data") {
      els.memoryText.value = state.memory || "";
      els.includeMemory.checked = state.includeMemory;
      updateMemoryCount();
      renderNotes();
    }
    if (view === "systems") updateSystemCounts();
    closeSidebar();
  }

  function closeSidebar() {
    els.sidebar.classList.remove("open");
    els.backdrop.classList.remove("visible");
    els.backdrop.setAttribute("aria-hidden", "true");
  }

  function openSidebar() {
    els.sidebar.classList.add("open");
    els.backdrop.classList.add("visible");
    els.backdrop.setAttribute("aria-hidden", "false");
  }

  function setBusy(busy) {
    state.busy = busy;
    els.sendBtn.disabled = busy;
    els.input.disabled = busy;
    els.typing.classList.toggle("hidden", !busy);
    els.sendBtn.querySelector("span:first-child").textContent = busy ? "Thinking" : "Send";
  }

  async function sendMessage(rawText) {
    const text = String(rawText || "").trim();
    if (!text || state.busy) return;
    if (state.view !== "core" && state.view !== "research") setView("core");
    let chat = currentChat();
    if (!chat) chat = createChat(true);
    chat.mode = state.view === "research" ? "research" : "core";
    if (!chat.messages.length || chat.title === "New conversation") chat.title = text.replace(/\s+/g, " ").slice(0, 36) || "New conversation";
    chat.messages.push({ role: "user", content: text, createdAt: Date.now() });
    chat.updatedAt = Date.now();
    els.input.value = "";
    els.input.style.height = "auto";
    renderMessages();
    saveChats();
    setBusy(true);
    updateConnection("Connecting…", "disconnected");

    try {
      const payload = {
        mode: state.view === "research" ? "research" : "core",
        messages: chat.messages.slice(-24).map(item => ({ role: item.role, content: item.content })),
        memory: state.includeMemory ? (state.memory || "") : ""
      };
      const headers = { "Content-Type": "application/json" };
      if (state.accessToken) headers.Authorization = "Bearer " + state.accessToken;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      let data = {};
      try { data = await response.json(); } catch (_) { data = {}; }
      if (!response.ok) {
        if (response.status === 401) throw new Error("Access denied. Check the private access token in Preferences.");
        const baseError = data.error || ("The AI service returned status " + response.status + ".");
        const providerStatus = data.providerStatus ? " (Gemini HTTP " + data.providerStatus + ")" : "";
        const diagnostic = typeof data.diagnostic === "string" && data.diagnostic
          ? " Details: " + data.diagnostic
          : "";
        throw new Error(baseError + providerStatus + diagnostic);
      }
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("The AI service returned an empty response.");
      chat.messages.push({ role: "assistant", content: data.reply.trim(), sources: Array.isArray(data.sources) ? data.sources : [], createdAt: Date.now() });
      chat.updatedAt = Date.now();
      state.lastResponse = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      els.lastResponseStatus.textContent = state.lastResponse;
      updateConnection("AI connected", "ok");
      saveChats();
      renderMessages();
      if (state.speakResponses) speakText(data.reply);
    } catch (error) {
      const errorMessage = error && error.message ? error.message : "Something went wrong while contacting Astra.";
      chat.messages.push({ role: "assistant", content: "I couldn't complete that request.\n\n" + errorMessage + "\n\nCheck that this site is deployed with its /api/chat backend and that the required environment variables are configured.", createdAt: Date.now(), error: true });
      chat.updatedAt = Date.now();
      updateConnection("Connection issue", "error");
      saveChats();
      renderMessages();
      notify(errorMessage, true);
    } finally {
      setBusy(false);
      els.messages.scrollTop = els.messages.scrollHeight;
      els.input.focus();
    }
  }

  function updateMemoryCount() {
    els.memoryCount.textContent = String((els.memoryText.value || "").length) + " / 5000";
  }

  function saveMemory() {
    state.memory = els.memoryText.value.slice(0, 5000).trim();
    state.includeMemory = els.includeMemory.checked;
    safeWrite(KEYS.memory, state.memory);
    safeWrite(KEYS.includeMemory, state.includeMemory);
    els.memoryStatus.textContent = state.memory ? "Memory saved locally. It will be included in requests only while the toggle is on." : "Memory cleared. No personal context will be added.";
    notify("Your memory preferences were saved.");
  }

  function clearMemory() {
    if (!window.confirm("Delete your saved personal memory from this browser?")) return;
    state.memory = "";
    els.memoryText.value = "";
    safeWrite(KEYS.memory, "");
    updateMemoryCount();
    els.memoryStatus.textContent = "Memory deleted from this browser.";
    notify("Saved memory deleted.");
  }

  function renderNotes() {
    els.notesList.replaceChildren();
    els.emptyNotes.classList.toggle("hidden", state.notes.length > 0);
    state.notes.slice().sort((a, b) => b.createdAt - a.createdAt).forEach(note => {
      const item = document.createElement("article");
      item.className = "note-item";
      const content = document.createElement("div");
      content.className = "note-text";
      content.textContent = note.text;
      const meta = document.createElement("div");
      meta.className = "note-meta";
      const date = document.createElement("span");
      date.textContent = new Date(note.createdAt).toLocaleDateString();
      const actions = document.createElement("div");
      actions.className = "note-actions";
      const ask = document.createElement("button");
      ask.type = "button";
      ask.textContent = "Ask Astra";
      ask.addEventListener("click", () => {
        setView("core");
        els.input.value = "Help me work with this note:\n\n" + note.text;
        els.input.focus();
        notify("Your note is ready to send. Review it first.");
      });
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "Delete";
      del.addEventListener("click", () => {
        state.notes = state.notes.filter(entry => entry.id !== note.id);
        safeWrite(KEYS.notes, state.notes);
        renderNotes();
        updateSystemCounts();
      });
      actions.append(ask, del);
      meta.append(date, actions);
      item.append(content, meta);
      els.notesList.appendChild(item);
    });
    updateSystemCounts();
  }

  function addNote(event) {
    event.preventDefault();
    const input = $("#noteInput");
    const text = input.value.trim();
    if (!text) { notify("Write a note first.", true); input.focus(); return; }
    state.notes.push({ id: makeId(), text: text, createdAt: Date.now() });
    if (state.notes.length > 100) state.notes = state.notes.slice(-100);
    safeWrite(KEYS.notes, state.notes);
    input.value = "";
    renderNotes();
    notify("Note saved in this browser.");
  }

  function updateSystemCounts() {
    if (els.systemChatCount) els.systemChatCount.textContent = String(state.chats.length);
    if (els.systemNoteCount) els.systemNoteCount.textContent = String(state.notes.length);
    if (els.chatCount) els.chatCount.textContent = String(state.chats.length);
    if (els.storageStatus) {
      try {
        localStorage.setItem("astra_storage_test", "1");
        localStorage.removeItem("astra_storage_test");
        els.storageStatus.textContent = "Available";
        els.storageStatus.className = "system-value ok";
      } catch (_) {
        els.storageStatus.textContent = "Unavailable";
        els.storageStatus.className = "system-value bad";
      }
    }
  }

  function exportData() {
    const bundle = {
      exportedAt: new Date().toISOString(),
      chats: state.chats,
      memory: state.memory,
      notes: state.notes
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "astra-data-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify("Your Astra data export has been prepared.");
  }

  function openSettings() {
    els.accessToken.value = state.accessToken;
    els.speakResponses.checked = state.speakResponses;
    if (typeof els.settingsDialog.showModal === "function") els.settingsDialog.showModal();
    else notify("Preferences dialog is not supported in this browser.", true);
  }

  function saveSettings() {
    state.accessToken = els.accessToken.value.trim();
    state.speakResponses = els.speakResponses.checked;
    try {
      if (state.accessToken) sessionStorage.setItem(KEYS.accessToken, state.accessToken);
      else sessionStorage.removeItem(KEYS.accessToken);
    } catch (_) {}
    safeWrite(KEYS.speakResponses, state.speakResponses);
    els.settingsDialog.close();
    notify("Preferences saved for this browser session.");
  }

  function speakText(text) {
    if (!("speechSynthesis" in window)) {
      notify("Text-to-speech is not supported by this browser.", true);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text || "").slice(0, 4500));
    utterance.rate = 1;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(voice => /^en(-|_)/i.test(voice.lang));
    if (englishVoice) utterance.voice = englishVoice;
    window.speechSynthesis.speak(utterance);
  }

  function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      $("#micBtn").disabled = true;
      $("#micBtn").title = "Speech recognition is not supported in this browser";
      els.voiceStatus.textContent = "Not supported";
      els.voiceStatus.className = "system-value";
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    state.recognition = recognition;
    els.voiceStatus.textContent = "Supported";
    els.voiceStatus.className = "system-value ok";
    recognition.onstart = () => {
      state.listening = true;
      $("#micBtn").classList.add("listening");
      $("#micBtn").setAttribute("aria-label", "Stop dictation");
      notify("Listening. Speak your message.");
    };
    recognition.onresult = event => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      els.input.value = transcript;
      els.input.dispatchEvent(new Event("input"));
    };
    recognition.onerror = event => {
      const msg = event.error === "not-allowed" ? "Microphone permission was denied." : "Speech recognition stopped: " + event.error;
      notify(msg, true);
    };
    recognition.onend = () => {
      state.listening = false;
      $("#micBtn").classList.remove("listening");
      $("#micBtn").setAttribute("aria-label", "Dictate a message");
    };
  }

  async function testConnection() {
    if (state.busy) { notify("Wait until the current request finishes.", true); return; }
    $("#testConnection").disabled = true;
    $("#testConnection").textContent = "Testing…";
    try {
      const headers = { "Content-Type": "application/json" };
      if (state.accessToken) headers.Authorization = "Bearer " + state.accessToken;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ mode: "core", messages: [{ role: "user", content: "Reply with exactly: ASTRA_CONNECTION_OK" }], memory: "" })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || ("HTTP " + response.status));
      if (typeof data.reply !== "string") throw new Error("The backend response format was unexpected.");
      updateConnection("AI connected", "ok");
      els.lastResponseStatus.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      notify("Astra's AI connection is working.");
    } catch (error) {
      updateConnection("Connection issue", "error");
      notify(error.message || "Connection test failed.", true);
    } finally {
      $("#testConnection").disabled = false;
      $("#testConnection").textContent = "Test AI connection";
    }
  }

  function bindEvents() {
    $("#newChat").addEventListener("click", () => createChat(false));
    $("#menuBtn").addEventListener("click", openSidebar);
    els.backdrop.addEventListener("click", closeSidebar);
    $("#openSettings").addEventListener("click", openSettings);
    $("#sidebarSettings").addEventListener("click", () => { closeSidebar(); openSettings(); });
    $("#closeSettings").addEventListener("click", () => els.settingsDialog.close());
    $("#saveSettings").addEventListener("click", saveSettings);
    els.settingsDialog.addEventListener("click", event => {
      if (event.target === els.settingsDialog) els.settingsDialog.close();
    });
    $$(".nav-link").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
    els.composer.addEventListener("submit", event => {
      event.preventDefault();
      sendMessage(els.input.value);
    });
    els.input.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        sendMessage(els.input.value);
      }
    });
    els.input.addEventListener("input", () => {
      els.input.style.height = "auto";
      els.input.style.height = Math.min(els.input.scrollHeight, 180) + "px";
    });
    $$(".prompt-card").forEach(button => button.addEventListener("click", () => {
      if (state.busy) return;
      sendMessage(button.dataset.prompt);
    }));
    $$(".quick-action").forEach(button => button.addEventListener("click", () => {
      setView("core");
      els.input.value = button.dataset.quick;
      els.input.focus();
    }));
    $("#saveMemory").addEventListener("click", saveMemory);
    $("#clearMemory").addEventListener("click", clearMemory);
    $("#memoryText").addEventListener("input", updateMemoryCount);
    $("#includeMemory").addEventListener("change", () => {
      state.includeMemory = els.includeMemory.checked;
      safeWrite(KEYS.includeMemory, state.includeMemory);
      els.memoryStatus.textContent = state.includeMemory ? "Saved memory will be included in future requests." : "Saved memory will stay local and won't be sent with requests.";
    });
    $("#noteForm").addEventListener("submit", addNote);
    $("#exportData").addEventListener("click", exportData);
    $("#clearAllChats").addEventListener("click", () => {
      if (!state.chats.length) { notify("There are no conversations to delete."); return; }
      if (!window.confirm("Delete every saved conversation from this browser? This cannot be undone.")) return;
      state.chats = [];
      state.activeId = null;
      saveChats();
      createChat(true);
      renderMessages();
      notify("All saved conversations were deleted.");
    });
    $("#testConnection").addEventListener("click", testConnection);
    $("#speakToggle").addEventListener("click", () => {
      state.speakResponses = !state.speakResponses;
      safeWrite(KEYS.speakResponses, state.speakResponses);
      $("#speakToggle").style.color = state.speakResponses ? "var(--cyan)" : "";
      notify(state.speakResponses ? "Spoken responses enabled." : "Spoken responses disabled.");
    });
    $("#micBtn").addEventListener("click", () => {
      if (!state.recognition) { notify("Speech input is not supported in this browser.", true); return; }
      if (state.listening) { state.recognition.stop(); return; }
      try { state.recognition.start(); }
      catch (_) { notify("Speech recognition could not start. Try again.", true); }
    });
    document.addEventListener("keydown", event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        createChat(false);
      }
      if (event.key === "Escape") closeSidebar();
    });
    window.addEventListener("beforeunload", () => {
      if (state.recognition && state.listening) state.recognition.stop();
    });
  }

  function updateSessionClock() {
    const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const secs = String(elapsed % 60).padStart(2, "0");
    $("#sessionTime").textContent = mins + ":" + secs;
  }

  function init() {
    try { state.accessToken = sessionStorage.getItem(KEYS.accessToken) || ""; } catch (_) {}
    bindEvents();
    setupSpeechRecognition();
    els.includeMemory.checked = state.includeMemory;
    els.speakResponses.checked = state.speakResponses;
    els.memoryText.value = typeof state.memory === "string" ? state.memory : "";
    updateMemoryCount();
    if (!state.activeId || !state.chats.some(chat => chat.id === state.activeId)) {
      const saved = state.chats.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0];
      state.activeId = saved ? saved.id : null;
    }
    if (!currentChat()) createChat(true);
    renderHistory();
    renderMessages();
    renderNotes();
    updateSystemCounts();
    setView("core");
    updateConnection("Backend not tested", "disconnected");
    $("#speakToggle").style.color = state.speakResponses ? "var(--cyan)" : "";
    window.setInterval(updateSessionClock, 1000);
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
    }
  }

  init();
})();