const STORAGE_KEY = "left_keep_memo_v1";

let notes = [];
let currentId = null;
let saveTimer = null;
let recognition = null;
let isRecording = false;

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

function loadNotes(){
  const raw = localStorage.getItem(STORAGE_KEY);
  notes = raw ? JSON.parse(raw) : [];
}

function saveNotes(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function createNote(){
  const now = new Date().toISOString();

  const note = {
    id: crypto.randomUUID(),
    title: "",
    body: "",
    pinned: false,
    deleted: false,
    createdAt: now,
    updatedAt: now
  };

  notes.unshift(note);
  saveNotes();
  openEditor(note.id);
}

function openEditor(id){
  currentId = id;

  const note = notes.find(n => n.id === id);
  if(!note) return;

  titleInput.value = note.title;
  bodyInput.value = note.body;
  pinBtn.textContent = note.pinned ? "固定解除" : "固定";

  listScreen.classList.remove("active");
  editScreen.classList.add("active");

  setTimeout(() => bodyInput.focus(), 120);
}

function closeEditor(){
  autoSaveNow();
  stopVoiceInput();

  editScreen.classList.remove("active");
  listScreen.classList.add("active");

  currentId = null;
  renderNotes();
}

function autoSaveNow(){
  if(!currentId) return;

  const note = notes.find(n => n.id === currentId);
  if(!note) return;

  note.title = titleInput.value.trim();
  note.body = bodyInput.value.trim();
  note.updatedAt = new Date().toISOString();

  saveNotes();
}

function scheduleAutoSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(autoSaveNow, 600);
}

function togglePin(){
  const note = notes.find(n => n.id === currentId);
  if(!note) return;

  note.pinned = !note.pinned;
  note.updatedAt = new Date().toISOString();

  pinBtn.textContent = note.pinned ? "固定解除" : "固定";
  saveNotes();
}

function deleteCurrentNote(){
  const note = notes.find(n => n.id === currentId);
  if(!note) return;

  note.deleted = true;
  note.updatedAt = new Date().toISOString();

  saveNotes();
  closeEditor();
}

function renderNotes(){
  const keyword = searchInput.value.trim().toLowerCase();

  const visible = notes
    .filter(note => !note.deleted)
    .filter(note => {
      const text = `${note.title} ${note.body}`.toLowerCase();
      return text.includes(keyword);
    })
    .sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  pinnedNotes.innerHTML = "";
  normalNotes.innerHTML = "";

  visible.filter(n => n.pinned).forEach(note => {
    pinnedNotes.appendChild(createCard(note));
  });

  visible.filter(n => !n.pinned).forEach(note => {
    normalNotes.appendChild(createCard(note));
  });
}

function createCard(note){
  const card = document.createElement("article");
  card.className = "noteCard";
  card.onclick = () => openEditor(note.id);

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

function setupVoiceInput(){
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if(!SpeechRecognition){
    micBtn.disabled = true;
    micBtn.textContent = "×";
    alert("このブラウザは音声入力に対応していません");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "ja-JP";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    isRecording = true;
    micBtn.classList.add("recording");
    micBtn.textContent = "■";
    console.log("音声入力開始");
  };

  recognition.onend = () => {
    isRecording = false;
    micBtn.classList.remove("recording");
    micBtn.textContent = "🎤";
    console.log("音声入力終了");
  };

  recognition.onerror = event => {
    console.log("音声入力エラー", event.error);
    stopVoiceInput();
  };

  recognition.onresult = event => {
    let finalText = "";
    let interimText = "";

    for(let i = event.resultIndex; i < event.results.length; i++){
      const text = event.results[i][0].transcript;

      if(event.results[i].isFinal){
        finalText += text;
      }else{
        interimText += text;
      }
    }

    console.log("途中:", interimText);
    console.log("確定:", finalText);

    if(finalText){
      const before = bodyInput.value.trim();

      bodyInput.value = before
        ? before + "\n" + finalText
        : finalText;

      scheduleAutoSave();
    }
  };
}

function startVoiceInput(){
  if(!recognition){
    alert("音声入力機能が使えません");
    return;
  }

  bodyInput.focus();

  try{
    recognition.start();
  }catch(e){
    console.log("start error", e);
  }
}

function stopVoiceInput(){
  if(recognition && isRecording){
    recognition.stop();
  }
}

function toggleVoiceInput(){
  if(isRecording){
    stopVoiceInput();
  }else{
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

loadNotes();
renderNotes();
setupVoiceInput();
