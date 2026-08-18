/* =========================================================
   ЗАПИС — голосові нотатки
   Дані зберігаються локально на пристрої (localStorage)
   ========================================================= */

const STORE_KEY = "zapys:notes";
const TAGS = ["Ідеї", "Завдання", "Особисте", "Робота"];

const Store = {
  get() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  },
  set(notes) { localStorage.setItem(STORE_KEY, JSON.stringify(notes)); },
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function fmtDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("uk-UA", { day: "numeric", month: "short" }) + " · " +
    d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateLong(iso) {
  return new Date(iso).toLocaleString("uk-UA", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

/* =========================================================
   Стан і фільтри
   ========================================================= */

let activeTag = null;
let searchQuery = "";

const viewEl = document.getElementById("view");
const tagFiltersEl = document.getElementById("tagFilters");

function renderTagFilters() {
  let html = `<button class="tag-chip ${activeTag === null ? "active" : ""}" data-tag="">Усі</button>`;
  TAGS.forEach(t => {
    html += `<button class="tag-chip ${activeTag === t ? "active" : ""}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`;
  });
  tagFiltersEl.innerHTML = html;
  tagFiltersEl.querySelectorAll(".tag-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      activeTag = chip.dataset.tag || null;
      renderTagFilters();
      renderNotes();
    });
  });
}

function getFilteredNotes() {
  let notes = Store.get().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (activeTag) notes = notes.filter(n => n.tag === activeTag);
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    notes = notes.filter(n => n.text.toLowerCase().includes(q));
  }
  return notes;
}

function renderNotes() {
  const notes = getFilteredNotes();

  if (notes.length === 0) {
    const allEmpty = Store.get().length === 0;
    viewEl.innerHTML = `
      <div class="empty">
        <div class="empty-mic">
          <svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2z"/></svg>
        </div>
        <div class="empty-title">${allEmpty ? "Ще немає нотаток" : "Нічого не знайдено"}</div>
        <p>${allEmpty ? "Натисни мікрофон унизу і наговори свою першу думку — вона стане текстом." : "Спробуй інший запит або скинь фільтр."}</p>
      </div>
    `;
    return;
  }

  let html = "";
  notes.forEach(n => {
    html += `
      <div class="note-card" data-id="${n.id}">
        ${n.viaVoice ? `<div class="note-voice-mark"><svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2z"/></svg></div>` : ""}
        <div class="note-card-head">
          <span class="note-date">${fmtDate(n.createdAt)}</span>
        </div>
        <div class="note-preview">${escapeHtml(n.text) || "<em>Порожня нотатка</em>"}</div>
        ${n.tag ? `<div class="note-tags"><span class="note-tag">${escapeHtml(n.tag)}</span></div>` : ""}
      </div>
    `;
  });
  viewEl.innerHTML = html;

  viewEl.querySelectorAll(".note-card").forEach(card => {
    card.addEventListener("click", () => openNoteDetail(card.dataset.id));
  });
}

/* =========================================================
   Пошук
   ========================================================= */

document.getElementById("searchToggle").addEventListener("click", () => {
  const bar = document.getElementById("searchBar");
  bar.hidden = !bar.hidden;
  if (!bar.hidden) document.getElementById("searchInput").focus();
  else { searchQuery = ""; document.getElementById("searchInput").value = ""; renderNotes(); }
});
document.getElementById("searchInput").addEventListener("input", (e) => {
  searchQuery = e.target.value;
  renderNotes();
});

/* =========================================================
   Створення / редагування нотатки
   ========================================================= */

function saveNewNote(text, viaVoice) {
  text = text.trim();
  if (!text) { toast("Нотатка порожня — нічого не збережено"); return null; }
  const note = {
    id: uid(),
    text,
    tag: null,
    viaVoice: !!viaVoice,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const notes = Store.get();
  notes.unshift(note);
  Store.set(notes);
  renderNotes();
  return note;
}

function openNoteDetail(id) {
  const notes = Store.get();
  const note = notes.find(n => n.id === id);
  if (!note) return;

  const modalBody = openModal(`
    <div class="modal-date">${fmtDateLong(note.createdAt)}${note.viaVoice ? " · голосом" : ""}</div>
    <textarea class="note-textarea" id="detailText">${escapeHtml(note.text)}</textarea>
    <div class="tag-select" id="detailTags"></div>
    <div class="modal-actions">
      <button class="btn danger" id="detailDelete">Видалити</button>
      <button class="btn" id="detailSave">Зберегти</button>
    </div>
  `);

  const tagSelect = document.getElementById("detailTags");
  TAGS.forEach(t => {
    const chip = document.createElement("button");
    chip.className = "tag-option" + (note.tag === t ? " selected" : "");
    chip.textContent = t;
    chip.dataset.tag = t;
    chip.addEventListener("click", () => {
      note.tag = note.tag === t ? null : t;
      tagSelect.querySelectorAll(".tag-option").forEach(c => c.classList.toggle("selected", c.dataset.tag === note.tag));
    });
    tagSelect.appendChild(chip);
  });

  document.getElementById("detailSave").addEventListener("click", () => {
    const newText = document.getElementById("detailText").value.trim();
    if (!newText) { toast("Текст не може бути порожнім"); return; }
    note.text = newText;
    note.updatedAt = new Date().toISOString();
    const all = Store.get();
    const idx = all.findIndex(n => n.id === id);
    all[idx] = note;
    Store.set(all);
    closeModal();
    renderNotes();
    toast("Нотатку збережено");
  });

  document.getElementById("detailDelete").addEventListener("click", () => {
    confirmDialog("Видалити нотатку?", "Цю дію не можна скасувати.", () => {
      Store.set(Store.get().filter(n => n.id !== id));
      closeModal();
      renderNotes();
      toast("Нотатку видалено");
    });
  });
}

document.getElementById("typeBtn").addEventListener("click", () => {
  const modalBody = openModal(`
    <div class="modal-date">Нова нотатка</div>
    <textarea class="note-textarea" id="newText" placeholder="Напиши свою думку..." autofocus></textarea>
    <div class="modal-actions">
      <button class="btn secondary" id="newCancel">Скасувати</button>
      <button class="btn" id="newSave">Зберегти</button>
    </div>
  `);
  document.getElementById("newText").focus();
  document.getElementById("newCancel").addEventListener("click", closeModal);
  document.getElementById("newSave").addEventListener("click", () => {
    const text = document.getElementById("newText").value;
    if (saveNewNote(text, false)) { closeModal(); toast("Нотатку збережено"); }
  });
});

/* =========================================================
   Голосове розпізнавання
   ========================================================= */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
let finalTranscript = "";
let listening = false;

const micBtn = document.getElementById("micBtn");
const overlay = document.getElementById("listenOverlay");
const transcriptEl = document.getElementById("listenTranscript");
const statusEl = document.getElementById("listenStatus");

micBtn.addEventListener("click", startListening);
document.getElementById("listenStop").addEventListener("click", finishListening);
document.getElementById("listenCancel").addEventListener("click", cancelListening);

function startListening() {
  if (!SpeechRecognition) {
    toast("Голосовий ввід не підтримується в цьому браузері. Спробуй Chrome, або напиши текстом.");
    return;
  }
  finalTranscript = "";
  transcriptEl.innerHTML = "";
  statusEl.textContent = "Слухаю…";
  statusEl.classList.remove("recording");
  overlay.hidden = false;

  recognizer = new SpeechRecognition();
  recognizer.lang = "uk-UA";
  recognizer.continuous = true;
  recognizer.interimResults = true;

  recognizer.onstart = () => {
    listening = true;
    statusEl.textContent = "Слухаю…";
    statusEl.classList.add("recording");
  };

  recognizer.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const chunk = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += chunk + " ";
      else interim += chunk;
    }
    transcriptEl.innerHTML = escapeHtml(finalTranscript) + `<span class="interim">${escapeHtml(interim)}</span>`;
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  };

  recognizer.onerror = (event) => {
    listening = false;
    statusEl.classList.remove("recording");
    if (event.error === "no-speech") {
      statusEl.textContent = "Не чую… говори ближче до мікрофона";
    } else if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      statusEl.textContent = "Немає доступу до мікрофона";
      toast("Дозволь доступ до мікрофона в налаштуваннях браузера");
    } else {
      statusEl.textContent = "Помилка розпізнавання";
    }
  };

  recognizer.onend = () => {
    listening = false;
    if (!overlay.hidden) {
      statusEl.textContent = "Пауза — натисни мікрофон, щоб продовжити, або «Готово»";
      statusEl.classList.remove("recording");
    }
  };

  try {
    recognizer.start();
  } catch (e) {
    toast("Не вдалося запустити розпізнавання мовлення");
    overlay.hidden = true;
  }
}

function finishListening() {
  if (recognizer) { try { recognizer.stop(); } catch (e) {} }
  overlay.hidden = true;
  const text = finalTranscript.trim();
  if (text) {
    saveNewNote(text, true);
    toast("Нотатку збережено");
  } else {
    toast("Не вдалося розпізнати текст");
  }
}

function cancelListening() {
  if (recognizer) { try { recognizer.stop(); } catch (e) {} }
  overlay.hidden = true;
}

/* =========================================================
   Резервна копія
   ========================================================= */

document.getElementById("backupToggle").addEventListener("click", openBackupModal);

function openBackupModal() {
  openModal(`
    <div class="modal-date" style="font-family:var(--font-display);font-size:19px;color:var(--text);margin-bottom:6px;">Резервна копія</div>
    <p style="color:var(--text-dim);font-size:13.5px;margin-top:0;">Нотатки зберігаються лише в цьому браузері. Збережи копію у файл, щоб не втратити їх або перенести на інший телефон.</p>
    <div class="modal-actions" style="margin-bottom:10px;">
      <button class="btn secondary" id="exportBtn">⬇ Зберегти копію</button>
      <button class="btn secondary" id="importBtnModal">⬆ Відновити</button>
    </div>
    <input type="file" id="importFile" accept="application/json" hidden>
  `);
  document.getElementById("exportBtn").addEventListener("click", exportBackup);
  document.getElementById("importBtnModal").addEventListener("click", () => document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", handleImportFile);
}

function handleImportFile(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); } catch (err) { toast("Файл пошкоджений або не є копією Запис"); return; }
    if (!data || !Array.isArray(data.notes)) { toast("Це не файл резервної копії Запис"); return; }
    const existing = Store.get();
    const existingIds = new Set(existing.map(n => n.id));
    const added = data.notes.filter(n => !existingIds.has(n.id));
    Store.set(existing.concat(added));
    closeModal();
    renderNotes();
    toast(`Додано нотаток: ${added.length}`);
  };
  reader.readAsText(file);
}

function exportBackup() {
  const data = { app: "zapys", version: 1, exportedAt: new Date().toISOString(), notes: Store.get() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zapys-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast("Файл копії збережено");
}

/* =========================================================
   Модальні вікна
   ========================================================= */

let modalRoot = null;

function openModal(innerHtml) {
  closeModal();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal" id="modalBody">${innerHtml}</div>`;
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
  document.body.appendChild(backdrop);
  modalRoot = backdrop;
  return document.getElementById("modalBody");
}
function closeModal() { if (modalRoot) { modalRoot.remove(); modalRoot = null; } }

function confirmDialog(title, msg, onConfirm) {
  openModal(`
    <div class="modal-date" style="font-family:var(--font-display);font-size:19px;color:var(--text);margin-bottom:6px;">${title}</div>
    <p style="color:var(--text-dim);font-size:14px;margin-top:0;">${msg}</p>
    <div class="modal-actions">
      <button class="btn secondary" id="confirmNo">Скасувати</button>
      <button class="btn danger" id="confirmYes" style="background:var(--red);color:#fff;">Так, видалити</button>
    </div>
  `);
  document.getElementById("confirmNo").addEventListener("click", closeModal);
  document.getElementById("confirmYes").addEventListener("click", () => { closeModal(); onConfirm(); });
}

/* =========================================================
   PWA: встановлення та service worker
   ========================================================= */

let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById("installBtn").hidden = false;
});
document.getElementById("installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) { toast("Відкрий меню браузера → «Додати на головний екран»"); return; }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById("installBtn").hidden = true;
});
window.addEventListener("appinstalled", () => {
  document.getElementById("installBtn").hidden = true;
  toast("Додаток встановлено");
});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}

/* ---------------- Init ---------------- */
renderTagFilters();
renderNotes();
