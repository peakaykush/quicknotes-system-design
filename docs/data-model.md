# QuickNotes Data Model Specification

This document details the relational data architecture, entity relationships, database schema definitions, and indexing strategies for the cloud-native **QuickNotes** service.

---

## 1. Entities & Schema Overview

The database design comprises four core entities:

```
 +-------------+       1:N       +-------------+       1:N       +---------------+
 |    users    |----------------<|    notes    |----------------<|   note_tags   |
 +-------------+                 +-------------+                 +---------------+
                                                                         |
                                                                        M:1
                                                                         v
                                                                 +---------------+
                                                                 |     tags      |
                                                                 +---------------+
```

### Entity Attributes

1. **`users`**
   - `id`: `VARCHAR(36)` / `UUID` — Primary Key. Unique identifier for each user.
   - `username`: `VARCHAR(50)` — Not Null, Unique. Alphanumeric display name.
   - `email`: `VARCHAR(255)` — Not Null, Unique. Account email address for login.
   - `password_hash`: `VARCHAR(255)` — Not Null. Cryptographic salted password hash (e.g. bcrypt/Argon2).
   - `created_at`: `TIMESTAMP WITH TIME ZONE` — Not Null, default current timestamp.

2. **`notes`**
   - `id`: `VARCHAR(36)` / `UUID` — Primary Key. Unique identifier for each note.
   - `user_id`: `VARCHAR(36)` — Foreign Key referencing `users(id)` `ON DELETE CASCADE`.
   - `title`: `VARCHAR(100)` — Not Null. Title of the note (strictly 1–100 characters).
   - `body`: `TEXT` — Nullable. Main markdown or plain text note content.
   - `category`: `VARCHAR(30)` — Not Null, default `'personal'`. Domain category (`personal`, `work`, `study`).
   - `is_pinned`: `BOOLEAN` — Not Null, default `FALSE`. Quick access priority flag.
   - `created_at`: `TIMESTAMP WITH TIME ZONE` — Not Null, creation timestamp.
   - `updated_at`: `TIMESTAMP WITH TIME ZONE` — Not Null, last modified timestamp.

3. **`tags`**
   - `id`: `SERIAL` / `INTEGER` — Primary Key. Unique tag ID.
   - `name`: `VARCHAR(50)` — Not Null, Unique. Tag name (stored lowercased, e.g. `'architecture'`).
   - `created_at`: `TIMESTAMP WITH TIME ZONE` — Not Null, creation timestamp.

4. **`note_tags`**
   - `note_id`: `VARCHAR(36)` — Foreign Key referencing `notes(id)` `ON DELETE CASCADE`.
   - `tag_id`: `INTEGER` — Foreign Key referencing `tags(id)` `ON DELETE CASCADE`.
   - `PRIMARY KEY (note_id, tag_id)` — Composite Primary Key ensuring unique tag associations per note.

---

## 2. Relationships Explained

- **One-to-Many (`1:N`): `users` → `notes`**
  - A single user owns zero, one, or many notes.
  - Every note belongs strictly to one authenticated user (`notes.user_id`).
  - Deleting a user automatically cascades and deletes all associated notes.

- **Many-to-Many (`M:N`): `notes` ↔ `tags`**
  - A note can be associated with multiple tags (e.g., `#work`, `#architecture`).
  - A single tag can categorize multiple different notes across the system.
  - This Many-to-Many relationship is decoupled through the associative junction table **`note_tags`**, transforming the M:N relationship into two atomic One-to-Many relationships (`notes` → `note_tags` and `tags` → `note_tags`).

---

## 3. SQL DDL Statements (`CREATE TABLE`)

```sql
-- Enable UUID extension if using PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Notes Table
CREATE TABLE notes (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(100) NOT NULL,
    body TEXT,
    category VARCHAR(30) NOT NULL DEFAULT 'personal',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notes_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Tags Table
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Note Tags Junction Table
CREATE TABLE note_tags (
    note_id VARCHAR(36) NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    CONSTRAINT fk_note_tags_note FOREIGN KEY (note_id) 
        REFERENCES notes(id) ON DELETE CASCADE,
    CONSTRAINT fk_note_tags_tag FOREIGN KEY (tag_id) 
        REFERENCES tags(id) ON DELETE CASCADE
);
```

---

## 4. Example SQL Queries

### Query 1: Fetch a User's Notes with Aggregated Tags (`JOIN`)
Retrieves all notes for a specific user, ordered with pinned notes first, aggregating tags into an array:
```sql
SELECT 
    n.id,
    n.title,
    n.body,
    n.category,
    n.is_pinned,
    n.created_at,
    COALESCE(ARRAY_AGG(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
FROM notes n
LEFT JOIN note_tags nt ON n.id = nt.note_id
LEFT JOIN tags t ON nt.tag_id = t.id
WHERE n.user_id = 'usr_99812a4b'
GROUP BY n.id
ORDER BY n.is_pinned DESC, n.updated_at DESC
LIMIT 20 OFFSET 0;
```

### Query 2: Search Notes by Keyword for an Authenticated User
Filters notes belonging to a specific user containing a search keyword in either the title or body:
```sql
SELECT 
    id,
    title,
    body,
    category,
    updated_at
FROM notes
WHERE user_id = 'usr_99812a4b'
  AND (title ILIKE '%architecture%' OR body ILIKE '%architecture%')
ORDER BY updated_at DESC;
```

### Query 3: Count Notes per Tag for a Specific User
Counts how many notes a user has assigned to each tag:
```sql
SELECT 
    t.name AS tag_name,
    COUNT(n.id) AS note_count
FROM tags t
JOIN note_tags nt ON t.id = nt.tag_id
JOIN notes n ON nt.note_id = n.id
WHERE n.user_id = 'usr_99812a4b'
GROUP BY t.id, t.name
ORDER BY note_count DESC;
```

---

## 5. Indexing Strategy & Justification

To ensure high-performance querying under high traffic, the following indexes are implemented:

1. **Composite Index on User Notes:**
   ```sql
   CREATE INDEX idx_notes_user_created ON notes (user_id, is_pinned DESC, updated_at DESC);
   ```
   - **Reasoning:** In a note-taking application, the single most frequent database operation is querying the authenticated user's active list of notes (`WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC`). Without this index, every note listing triggers an expensive full table scan and filesort. A composite B-tree index allows the database engine to perform an index seek directly to the user's partition and read pre-sorted rows with zero sorting overhead.

2. **Foreign Key Index on `note_tags`:**
   ```sql
   CREATE INDEX idx_note_tags_tag_id ON note_tags (tag_id);
   ```
   - **Reasoning:** While the composite primary key `(note_id, tag_id)` automatically indexes lookups starting with `note_id`, filtering notes by a tag (`WHERE tag_id = ?`) cannot utilize that index efficiently. An explicit index on `tag_id` speeds up reverse tag lookups and tag deletion cascades from $O(N)$ to $O(\log N)$.

---

## 6. Architectural Decision: SQL vs. NoSQL

For QuickNotes, a relational **SQL database (specifically PostgreSQL)** is chosen over NoSQL document stores (such as MongoDB or DynamoDB). 

**Justification:**
QuickNotes features strictly structured, relational entities with defined ownership and categorization requirements. Relational foreign key constraints with `ON DELETE CASCADE` guarantee that deleting a user or note immediately purges related records and junction table rows, preventing orphaned data anomalies. Furthermore, SQL's ACID transactions guarantee data consistency during critical multi-table updates (e.g., creating a note while associating multiple tags within an atomic transaction). While NoSQL document databases are suitable for unstructured data, modeling Many-to-Many tag relationships in document stores requires either data duplication (embedding tags inside notes and updating thousands of documents on a rename) or manual application-level joins. PostgreSQL provides the ideal combination of relational rigor, robust B-tree and GIN indexing for text search, and the ability to scale reads horizontally via read replicas.
