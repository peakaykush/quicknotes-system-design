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
 * Reusable fetch wrapper that checks response.ok, throws descriptive errors,
 * and returns the parsed payload alongside HTTP status code.
 * @param {string} url - Target URL.
 * @param {RequestInit} [options={}] - Fetch configuration options.
 * @returns {Promise<{data: any, status: number}>} Payload and HTTP status.
 */
async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
  }

  // Handle empty responses (such as 204 No Content)
  if (response.status === 204) {
    return { data: null, status: 204 };
  }

  const data = await response.json();
  return { data, status: response.status };
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
    const { data } = await request(`${API_URL}?_limit=10`);
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

/**
 * Creates a new note via POST with client-side validation.
 * @param {Event} event - Submit event.
 */
async function createNote(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  // Validation: Title required and max 100 characters
  if (!title) {
    setStatus("Validation error: Title is required.", "error");
    titleInput.focus();
    return;
  }

  if (title.length > 100) {
    setStatus("Validation error: Title must be 100 characters or fewer.", "error");
    titleInput.focus();
    return;
  }

  submitBtn.disabled = true;
  setStatus("Creating note on server...", "loading");

  try {
    const { data, status } = await request(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        title,
        body,
        userId: 1,
      }),
    });

    // Prepend newly created note to top of the list
    notes.unshift(data);
    renderNotes();

    // Success feedback showing status code and new id
    setStatus(`Note created (status ${status}, id ${data.id}).`, "success");

    // Clear form inputs
    noteForm.reset();
  } catch (error) {
    setStatus(`Failed to create note: ${error.message}`, "error");
  } finally {
    submitBtn.disabled = false;
  }
}

// Event Listeners
loadBtn.addEventListener("click", loadNotes);
noteForm.addEventListener("submit", createNote);
