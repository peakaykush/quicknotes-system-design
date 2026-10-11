# QuickNotes System Design & Cloud API Client

**QuickNotes System Design** represents the comprehensive engineering blueprint and frontend prototype transforming QuickNotes from a local browser-only tool into a scalable, enterprise-grade cloud service supporting 1 million users. 

This repository contains two core deliverables:
1. **Interactive API Prototype (`index.html`, `api.js`, `style.css`)**: A working, resilient web client demonstrating asynchronous REST API communication (GET, POST, DELETE) with real-time UI state feedback, validation, and error handling.
2. **System Architecture & Design Documents (`docs/`)**: Detailed technical documentation specifying the REST API contracts, relational database schema, load calculations, and high-availability architecture designed for backend implementation.

---

## Technical Documentation Links

The system design specifications are organized inside the `docs/` folder:

- 📄 **[API Design Specification](docs/api-design.md)**: Defines the production REST API contracts, endpoints, request/response JSON payloads, and standardized HTTP error code handling (400, 401, 403, 404, 500).
- 🗄️ **[Data Model Specification](docs/data-model.md)**: Outlines the four core entities (`users`, `notes`, `tags`, `note_tags`), relational mapping, complete SQL DDL statements, indexing strategies, and SQL vs. NoSQL justification.
- 🏗️ **[System Architecture Blueprint](docs/architecture.md)**: Details capacity estimations for 1 million users, ASCII architecture diagrams, end-to-end request flows (`GET` and `POST`), architectural trade-offs, and Single Point of Failure (SPOF) mitigation strategies.

---

## How to Run the API Client Locally

The interactive API client prototype communicates with a mock cloud backend (JSONPlaceholder) to demonstrate live asynchronous API interactions. No bundlers or dependencies are required.

### 1. Clone the Repository
```bash
git clone https://github.com/peakaykush/quicknotes-system-design.git
cd quicknotes-system-design
```

### 2. Launch in Browser
- Simply double-click `index.html` to open it in any modern web browser (Chrome, Firefox, Safari, Edge).
- Alternatively, serve it via any static local HTTP server:
  ```bash
  # Using Python 3
  python -m http.server 8000

  # Or using Node.js npx
  npx serve .
  ```
- Navigate to `http://localhost:8000` in your web browser.

### 3. Test Core Operations
- **Load Notes (GET):** Click the "Load notes" button to fetch 10 posts from the remote API. Notice the loading spinner state and success count.
- **Create a Note (POST):** Enter a title and optional body in the form, then click "Create Note". Notice the validation checks (max 100 characters), button disabling, and newly prepended note card showing the returned HTTP 201 status and ID.
- **Delete a Note (DELETE):** Click the "Delete" button on any note card to trigger a DELETE request. The item is removed from the view with confirmation status.

---

## What I Learned

1. **Designing for Cloud Scale & Traffic Asymmetry:**
   Calculating concrete capacity estimates for 1 million users highlighted the stark 10:1 read-to-write ratio inherent in productivity apps. This underscored why prioritizing in-memory caching (Redis) and database read replicas is essential to offload 90%+ of queries before they ever touch the primary database.

2. **Decoupling Heavy Workloads via Asynchronous Messaging:**
   Learned the architectural necessity of separating synchronous user-facing API requests from asynchronous background tasks. Offloading tasks like search indexing and notifications to message queues (RabbitMQ) ensures API response times stay under 200 ms regardless of workload complexity.

3. **Resilient Frontend API Client Architecture:**
   Developed a robust fetch abstraction layer featuring centralized error handling, explicit HTTP status checks, button disabling during in-flight requests, and strict DOM rendering using `textContent` to eliminate XSS vulnerabilities.
