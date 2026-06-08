const GAS_API_URL = "https://script.google.com/macros/s/AKfycbx0sqRtjVr1X7tNjUTGFtdbV3B9KGuM0qnjJ-DLADircAqqUj-WbIot_3A-MYQI9n-FdA/exec";

let notes = [];
let currentId = null;
let saveTimer = null;
let recognition = null;
let isRecording = false;
let saving = false;

const listScreen = document.getElementById("listScreen");
const editScreen = document.getElementById("editScreen");
const pinnedNotes = document.getElementById("pinnedNotes");
const normalNotes = document.getElementById("normalNotes");
const searchInput = document.getElementById("searchInput");
const addBtn = document.getElementById("addBtn");
const backBtn = document.getElementById("backBtn");
const micBtn = document.getElementById("micBtn");
const pinBtn = document.getElementById("pinBtn");
const deleteBtn = document.getElementById("deleteBtn");
const titleInput = document.getElementById("titleInput");
const bodyInput = document.getElementById("bodyInput");

function jsonp(action, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = "jsonpCallback_" + Date.now() + "_" + Math.floor(Math.random() * 100000);

    window[callbackName] = data => {
      delete window[callbackName];
      script.remove();
      resolve(data);
    };

    const url = new URL(GAS_API_URL);
    url.searchParams.set("action", action);
    url.searchParams.set("callback", callbackName);

    Object.keys(params).forEach(key => {
      url.searchParams.set(key, params[key]);
    });

    const script = document.createElement("script");
    script.src = url.toString();

    script.onerror = () => {
      delete window[callbackName];
      script.remove();
      reject(new Error("JSONP通信失敗"));
    };

    document.body.appendChild(script);
  });
}

async function apiGetNotes() {
  const data = await jsonp("getNotes");

  if (!data.success) {
    throw new Error(data.message || "読み込み失敗");
  }

  notes = data.notes || [];
  renderNotes();
}

async function apiSaveNote(note) {
  if (saving) return;

  saving = true;

  try {
    const data = await jsonp("saveNote", {
      note: JSON.stringify(note)
    });

    if (!data.success) {
      throw new Error(data.message || "保存失敗");
    }

    note.id = data.id;
    note.createdAt = data.createdAt;
    note.updatedAt = data.updatedAt;
    currentId = data.id;

    renderNotes();
  } finally {
    saving = false;
  }
}

async function apiDeleteNote(id) {
  const data = await jsonp("deleteNote", {
    id: id
  });

  if (!data.success) {
    throw new Error(data.message || "削除失敗");
  }

  notes = notes.filter(note => note.id !== id);
  renderNotes();
}

function createNote() {
  const note = {
    id: "",
    title: "",
    body: "",
    pinned: false,
    deleted: false,
    createdAt: "",
    updatedAt: ""
  };

  notes.unshift(note);
  openEditor(note);
}

function openEditor(note) {
  currentId = note.id || "";

  titleInput.value = note.title || "";
  bodyInput.value = note.body || "";
  pinBtn.textContent = note.pinned ? "固定解除" : "固定";

  listScreen.classList.remove("active");
  editScreen.classList.add("active");

  setTimeout(() => bodyInput.focus(), 120);
}

function getCurrentNote() {
  if (currentId) {
    const found = notes.find(note => note.id === currentId);
    if (found) return found;
  }

  return notes[0];
}

function closeEditor() {
  autoSaveNow();
  stopVoiceInput();

  editScreen.classList.remove("active");
  listScreen.classList.add("active");

  renderNotes();
}

function autoSaveNow() {
  const note = getCurrentNote();

  if (!note) return;

  note.title = titleInput.value.trim();
  note.body = bodyInput.value.trim();

  apiSaveNote(note).catch(error => {
    console.error(error);
    alert("保存失敗: " + error.message);
  });
}

function scheduleAutoSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(autoSaveNow, 1200);
}

function togglePin() {
  const note = getCurrentNote();

  if (!note) return;

  note.pinned = !note.pinned;

  pinBtn.textContent = note.pinned ? "固定解除" : "固定";

  apiSaveNote(note).catch(error => {
    console.error(error);
    alert("固定保存失敗: " + error.message);
  });
}

function deleteCurrentNote() {
  const note = getCurrentNote();

  if (!note) return;

  if (!note.id) {
    notes = notes.filter(n => n !== note);
    closeEditor();
    return;
  }

  apiDeleteNote(note.id).catch(error => {
    console.error(error);
    alert("削除失敗: " + error.message);
  });

  closeEditor();
}

function renderNotes() {
  const keyword = searchInput.value.trim().toLowerCase();

  const visible = notes
    .filter(note => !note.deleted)
    .filter(note => {
      const text = `${note.title || ""} ${note.body || ""}`.toLowerCase();
      return text.includes(keyword);
    })
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  pinnedNotes.innerHTML = "";
  normalNotes.innerHTML = "";

  visible.filter(note => note.pinned).forEach(note => {
    pinnedNotes.appendChild(createCard(note));
  });

  visible.filter(note => !note.pinned).forEach(note => {
    normalNotes.appendChild(createCard(note));
  });
}

function createCard(note) {
  const card = document.createElement("article");
  card.className = "noteCard";
  card.onclick = () => openEditor(note);

  const title = document.createElement("div");
  title.className = "noteTitle";
  title.textContent = note.title || "無題";

  const body = document.createElement("div");
  body.className = "noteBody";
  body.textContent = note.body || "メモなし";

  card.appendChild(title);
  card.appendChild(body);

  return card;
}

function insertTextToBody(text) {
  const cleanText = text.trim();

  if (!cleanText) return;

  const before = bodyInput.value.trim();

  bodyInput.value = before
    ? before + "\n" + cleanText
    : cleanText;

  bodyInput.focus();
  scheduleAutoSave();
}

function setupVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    micBtn.disabled = true;
    micBtn.textContent = "×";
    alert("このブラウザは音声入力に対応していません");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "ja-JP";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isRecording = true;
    micBtn.classList.add("recording");
    micBtn.textContent = "■";
  };

  recognition.onend = () => {
    isRecording = false;
    micBtn.classList.remove("recording");
    micBtn.textContent = "🎤";
  };

  recognition.onerror = event => {
    console.log("音声入力エラー", event.error);
    isRecording = false;
    micBtn.classList.remove("recording");
    micBtn.textContent = "🎤";
  };

  recognition.onresult = event => {
    let finalText = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;

      if (result.isFinal) {
        finalText += transcript;
      }
    }

    if (finalText.trim()) {
      insertTextToBody(finalText);
    }
  };
}

function startVoiceInput() {
  if (!recognition) {
    alert("音声入力機能が使えません");
    return;
  }

  bodyInput.focus();

  try {
    recognition.start();
  } catch (e) {
    console.log(e);
  }
}

function stopVoiceInput() {
  if (recognition && isRecording) {
    recognition.stop();
  }
}

function toggleVoiceInput() {
  if (isRecording) {
    stopVoiceInput();
  } else {
    startVoiceInput();
  }
}

addBtn.addEventListener("click", createNote);
backBtn.addEventListener("click", closeEditor);
micBtn.addEventListener("click", toggleVoiceInput);
pinBtn.addEventListener("click", togglePin);
deleteBtn.addEventListener("click", deleteCurrentNote);
searchInput.addEventListener("input", renderNotes);
titleInput.addEventListener("input", scheduleAutoSave);
bodyInput.addEventListener("input", scheduleAutoSave);

setupVoiceInput();

apiGetNotes().catch(error => {
  console.error(error);
  alert("読み込み失敗: " + error.message);
});
