// ==========================================
// QuickNotes API Client
// ==========================================

const API_URL = "https://jsonplaceholder.typicode.com/posts";

// DOM Elements
const loadBtn = document.getElementById("load-btn");
const submitBtn = document.getElementById("submit-btn");
const noteForm = document.getElementById("note-form");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const statusEl = document.getElementById("status");
const notesList = document.getElementById("notes-list");

// In-memory notes state
let notes = [];

/**
 * Updates the UI status message with optional semantic type.
 * @param {string} message - Message text to display.
 * @param {'loading'|'success'|'error'|'ready'} [type='ready'] - Status visual state.
 */
function setStatus(message, type = "ready") {
  statusEl.textContent = message;
  statusEl.className = type;
}

/**
 * Reusable fetch wrapper that checks response.ok and throws descriptive errors.
 * @param {string} url - Target URL.
 * @param {RequestInit} [options={}] - Fetch configuration options.
 * @returns {Promise<any>} Parsed JSON response.
 */
async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
  }

  // Handle empty responses (such as 204 No Content)
  if (response.status === 204) {
    return null;
  }

  return await response.json();
}

/**
 * Renders the notes array to the DOM using createElement and textContent exclusively.
 */
function renderNotes() {
  notesList.textContent = "";

  if (notes.length === 0) {
    const emptyLi = document.createElement("li");
    emptyLi.className = "empty-message";
    emptyLi.textContent = "No notes available. Click 'Load notes' or create one above.";
    notesList.appendChild(emptyLi);
    return;
  }

  notes.forEach((note) => {
    const li = document.createElement("li");
    li.className = "note-item";
    li.dataset.id = note.id;

    const contentDiv = document.createElement("div");
    contentDiv.className = "note-content";

    const titleEl = document.createElement("h3");
    titleEl.className = "note-title";
    titleEl.textContent = note.title;

    const bodyEl = document.createElement("p");
    bodyEl.className = "note-body";
    bodyEl.textContent = note.body || "";

    contentDiv.appendChild(titleEl);
    contentDiv.appendChild(bodyEl);
    li.appendChild(contentDiv);

    notesList.appendChild(li);
  });
}

/**
 * Loads 10 notes from the remote JSONPlaceholder API via GET.
 */
async function loadNotes() {
  loadBtn.disabled = true;
  setStatus("Loading notes...", "loading");

  try {
    const data = await request(`${API_URL}?_limit=10`);
    notes = data;
    renderNotes();
    setStatus(`Loaded ${notes.length} notes from the server.`, "success");
  } catch (error) {
    setStatus(`Failed to load notes: ${error.message}`, "error");
    renderNotes();
  } finally {
    loadBtn.disabled = false;
  }
}

// Event Listeners
loadBtn.addEventListener("click", loadNotes);
