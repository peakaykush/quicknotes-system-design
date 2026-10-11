# QuickNotes Backend API Specification

This document details the production REST API specification for the cloud-native **QuickNotes** backend service. It defines resource endpoints, authentication protocols, request/response contracts, and standard error handling to guide the backend engineering team.

---

## 1. Global API Conventions

- **Base URL:** `https://api.quicknotes.io/api/v1`
- **Transport Security:** Strict HTTPS (TLS 1.3)
- **Data Format:** JSON (`Content-Type: application/json; charset=utf-8`)
- **Authentication:** HTTP Bearer Authentication with JWT tokens passed in the header:
  ```http
  Authorization: Bearer <jwt_access_token>
  ```
- **Idempotency & Pagination:** Collection endpoints support limit-offset pagination via `page` and `limit` query parameters with standard envelope metadata.

---

## 2. Resource Endpoints

| Method | Path | Description | Success Status |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notes` | Retrieves a paginated list of notes owned by the authenticated user. | `200 OK` |
| `GET` | `/api/v1/notes/:id` | Retrieves full details of a single note by its unique identifier. | `200 OK` |
| `POST` | `/api/v1/notes` | Creates a new note record associated with the authenticated user. | `201 Created` |
| `PUT` | `/api/v1/notes/:id` | Completely replaces/updates an existing note record. | `200 OK` |
| `PATCH` | `/api/v1/notes/:id` | Partially modifies selected attributes of an existing note (e.g., pinned status). | `200 OK` |
| `DELETE` | `/api/v1/notes/:id` | Permanently deletes a note belonging to the authenticated user. | `204 No Content` |
| `GET` | `/api/v1/tags` | Lists all tags associated with the authenticated user's notes. | `200 OK` |

---

## 3. Core Request & Response Examples

### A. Creating a Note (`POST /api/v1/notes`)

#### Request
```http
POST /api/v1/notes HTTP/1.1
Host: api.quicknotes.io
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "title": "System Architecture Review Meeting",
  "body": "Discuss load balancer redundancy, Redis caching layers, and database replica failover with the infrastructure team.",
  "category": "work",
  "tags": ["architecture", "backend", "scalability"]
}
```

#### Response
```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /api/v1/notes/c8f2b1d9-5a4e-4f77-98e3-0b1a9c3d4e5f

{
  "id": "c8f2b1d9-5a4e-4f77-98e3-0b1a9c3d4e5f",
  "userId": "usr_99812a4b",
  "title": "System Architecture Review Meeting",
  "body": "Discuss load balancer redundancy, Redis caching layers, and database replica failover with the infrastructure team.",
  "category": "work",
  "tags": [
    { "id": 12, "name": "architecture" },
    { "id": 14, "name": "backend" },
    { "id": 19, "name": "scalability" }
  ],
  "isPinned": false,
  "createdAt": "2026-10-11T20:15:30.000Z",
  "updatedAt": "2026-10-11T20:15:30.000Z"
}
```

---

### B. Listing Notes (`GET /api/v1/notes`)

#### Request
```http
GET /api/v1/notes?page=1&limit=2&search=architecture HTTP/1.1
Host: api.quicknotes.io
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "data": [
    {
      "id": "c8f2b1d9-5a4e-4f77-98e3-0b1a9c3d4e5f",
      "userId": "usr_99812a4b",
      "title": "System Architecture Review Meeting",
      "body": "Discuss load balancer redundancy, Redis caching layers, and database replica failover with the infrastructure team.",
      "category": "work",
      "tags": ["architecture", "backend", "scalability"],
      "isPinned": true,
      "createdAt": "2026-10-11T20:15:30.000Z",
      "updatedAt": "2026-10-11T20:15:30.000Z"
    },
    {
      "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      "userId": "usr_99812a4b",
      "title": "Architecture Books to Read",
      "body": "1. Designing Data-Intensive Applications\n2. Clean Architecture",
      "category": "study",
      "tags": ["architecture", "books"],
      "isPinned": false,
      "createdAt": "2026-10-09T14:22:10.000Z",
      "updatedAt": "2026-10-10T11:05:40.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "limit": 2,
    "totalItems": 24,
    "totalPages": 12,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## 4. Error Status Codes & Response Payloads

All error responses return standard HTTP 4xx or 5xx status codes along with a structured JSON error body:

```json
{
  "error": {
    "status": 400,
    "code": "ERROR_CODE_STRING",
    "message": "Human readable summary.",
    "details": []
  }
}
```

### 1. `400 Bad Request`
- **When it occurs:** Client input fails validation (e.g. missing required `title`, title exceeds 100 characters, or invalid JSON payload).
- **Example Response:**
  ```json
  {
    "error": {
      "status": 400,
      "code": "VALIDATION_ERROR",
      "message": "Invalid request parameters.",
      "details": [
        {
          "field": "title",
          "issue": "Title is required and must not exceed 100 characters."
        }
      ]
    }
  }
  ```

### 2. `401 Unauthorized`
- **When it occurs:** The request lacks a valid Bearer JWT token, or the token has expired/failed signature verification.
- **Example Response:**
  ```json
  {
    "error": {
      "status": 401,
      "code": "UNAUTHORIZED",
      "message": "Authentication token is missing, expired, or invalid."
    }
  }
  ```

### 3. `403 Forbidden`
- **When it occurs:** The authenticated user is authenticated but does not have permission to view, edit, or delete the target note (e.g., trying to access note `c8f2b1d9` owned by another user).
- **Example Response:**
  ```json
  {
    "error": {
      "status": 403,
      "code": "FORBIDDEN",
      "message": "You do not have permission to access or modify this note."
    }
  }
  ```

### 4. `404 Not Found`
- **When it occurs:** The requested resource URI does not exist or the provided note ID does not match any record in the system.
- **Example Response:**
  ```json
  {
    "error": {
      "status": 404,
      "code": "RESOURCE_NOT_FOUND",
      "message": "Note with ID 'c8f2b1d9-5a4e-4f77-98e3-0b1a9c3d4e5f' was not found."
    }
  }
  ```

### 5. `500 Internal Server Error`
- **When it occurs:** Unhandled server exceptions, database connection timeouts, or unexpected infrastructure failures.
- **Example Response:**
  ```json
  {
    "error": {
      "status": 500,
      "code": "INTERNAL_SERVER_ERROR",
      "message": "An unexpected error occurred on our servers. Our engineering team has been notified."
    }
  }
  ```
