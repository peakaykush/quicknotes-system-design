# QuickNotes System Architecture & Scaling Blueprint

This document specifies the system architecture, capacity estimations, component responsibilities, request execution flows, and fault-tolerance strategies for the **QuickNotes** cloud service designed to support 1 million users.

---

## 1. System Requirements

### Functional Requirements
1. **Note Management:** Authenticated users can create, read, update, categorize, tag, and delete notes.
2. **Real-Time Search & Filtering:** Users can search notes by keywords and filter by categories or tags with sub-second response times.
3. **Cross-Device Synchronization:** User notes must synchronize across web and mobile clients reliably.
4. **Offline Resilience & Drafts:** The client can cache drafts locally and synchronize with the cloud API upon reconnection.

### Non-Functional Requirements
1. **High Availability:** 99.9% uptime (maximum 8.76 hours of unplanned downtime per year).
2. **Low Latency:** P95 response times under 100 ms for read operations and under 250 ms for write operations.
3. **Scalability:** Horizontal scaling across stateless application tiers capable of handling traffic spikes up to 5× normal volume.
4. **Data Durability & Consistency:** Strong consistency for individual user notes; zero data loss (RPO < 1 minute, RTO < 5 minutes).
5. **Security & Privacy:** End-to-end TLS encryption, secure password hashing (Argon2), and scoped JWT authorization.

---

## 2. Load & Capacity Estimations (1 Million Users)

### Baseline Assumptions
- **Total Registered Accounts:** 1,000,000 users.
- **Daily Active Users (DAU):** 20% of registered base = **200,000 active users / day**.
- **Activity per Active User:**
  - **Reads:** 20 note list/detail views per day.
  - **Writes:** 2 new notes or edits per day.
- **Traffic Multiplier:** Peak traffic is estimated at **$5\times$** average traffic.
- **Average Note Payload Size:**
  - Title: ~80 bytes
  - Body: ~1,200 bytes
  - Metadata & Tags: ~220 bytes
  - **Total per note record:** $\approx 1.5 \text{ KB}$.

### A. Throughput Estimations

- **Write Operations (POST / PUT / DELETE):**
  - Daily writes: $200,000 \text{ DAU} \times 2 \text{ writes/day} = 400,000 \text{ writes/day}$
  - Average writes/second:
    $$\text{Avg Writes/sec} = \frac{400,000}{86,400} \approx 4.63 \text{ writes/sec} \approx 5 \text{ writes/sec}$$
  - Peak writes/second ($5\times$):
    $$\text{Peak Writes/sec} = 4.63 \times 5 \approx 23.1 \text{ writes/sec} \approx 24 \text{ writes/sec}$$

- **Read Operations (GET /notes):**
  - Daily reads: $200,000 \text{ DAU} \times 20 \text{ reads/day} = 4,000,000 \text{ reads/day}$
  - Average reads/second:
    $$\text{Avg Reads/sec} = \frac{4,000,000}{86,400} \approx 46.3 \text{ reads/sec} \approx 47 \text{ reads/sec}$$
  - Peak reads/second ($5\times$):
    $$\text{Peak Reads/sec} = 46.3 \times 5 \approx 231.5 \text{ reads/sec} \approx 232 \text{ reads/sec}$$

- **Read-to-Write Ratio:**
  $$\text{Ratio} = \frac{4,000,000 \text{ reads}}{400,000 \text{ writes}} = 10:1 \quad (\text{Read-heavy system})$$

### B. Storage Estimations (Per Year)
- **New Notes Ingested Annually:**
  $$400,000 \text{ writes/day} \times 365 \text{ days} = 146,000,000 \text{ notes/year}$$
- **Raw Data Storage per Year:**
  $$146,000,000 \times 1.5 \text{ KB} = 219,000,000 \text{ KB} \approx 219 \text{ GB / year}$$
- **Total Storage with Indexes and Transaction Logs ($2\times$ safety margin):**
  $$\text{Total Storage Requirement} \approx 438 \text{ GB / year}$$

---

## 3. High-Level Architecture Diagram

```
                              [ Client Devices ]
                             (Web / Mobile Apps)
                                      |
                                      v
                             +-----------------+
                             |    DNS Layer    |
                             |  (Cloudflare)   |
                             +-----------------+
                                      |
                         +------------+------------+
                         |                         |
               (Static Assets/UI)           (Dynamic API Requests)
                         v                         v
                 +---------------+        +------------------+
                 |   CDN Edge    |        |  Load Balancer   |
                 | (CloudFront)  |        |  (AWS ALB / NGINX|
                 +---------------+        +------------------+
                                                   |
                                     +-------------+-------------+
                                     |                           |
                                     v                           v
                           +-------------------+       +-------------------+
                           |   App Server 1    |       |   App Server 2    |
                           |    (Node.js)      |       |    (Node.js)      |
                           +-------------------+       +-------------------+
                                   |          \         /          |
                                   |           \       /           |
                                   |            \     /            |
                                   v             v   v             v
                           +---------------+   +---------------+   +---------------+
                           | In-Memory     |   | Message Queue |   |  Primary DB   |
                           | Cache (Redis) |   | (RabbitMQ)    |   | (PostgreSQL)  |
                           +---------------+   +---------------+   |    Writes     |
                                                      |            +---------------+
                                                      v                    |
                                              +---------------+            | Asynchronous
                                              | Background    |            | Replication
                                              | Worker Pool   |            v
                                              +---------------+    +---------------+
                                                                   | Read Replica  |
                                                                   | (PostgreSQL)  |
                                                                   |    Reads      |
                                                                   +---------------+
```

---

## 4. Component Responsibilities (One-Sentence Justifications)

1. **Client Devices:** Renders the interactive user interface and manages local optimistic updates and draft storage.
2. **DNS Layer (Cloudflare):** Resolves human-readable domain names to healthy server endpoints while providing global DDoS mitigation and Anycast routing.
3. **CDN (CloudFront / Cloudflare):** Caches and serves static web assets (HTML, CSS, JS, icons) globally with ultra-low latency, offloading traffic from origin servers.
4. **Load Balancer (AWS ALB / NGINX):** Distributes incoming dynamic HTTP traffic evenly across application instances and performs continuous health checks to reroute around failed servers.
5. **App Servers (App Server 1 & App Server 2):** Executes stateless business logic, validates API requests, verifies JWT authentication, and coordinates database and cache interactions.
6. **In-Memory Cache (Redis):** Caches active user timelines, note lists, and session tokens in RAM to serve frequent read queries in under 5 milliseconds.
7. **Primary Database (PostgreSQL Primary):** Enforces ACID transactional integrity, uniqueness constraints, and writes for all persistent user, note, and tag records.
8. **Read Replica Database (PostgreSQL Replica):** Continuously replicates data from the primary to handle intensive read queries and search operations without impacting write throughput.
9. **Message Queue (RabbitMQ / SQS):** Decouples time-intensive background workloads (such as audit logging, tag indexing, and external sync) from the synchronous API request path.
10. **Background Worker Pool:** Consumes asynchronous tasks from the queue to process search index updates and system notifications without delaying client responses.

---

## 5. End-to-End Request Execution Flows

### A. Read Request: `GET /api/v1/notes`
1. **Client Request:** The user opens the app; the client issues `GET /api/v1/notes?page=1` with an `Authorization: Bearer <token>` header.
2. **Routing:** The Load Balancer terminates TLS and routes the request to an available App Server instance.
3. **Authentication:** The App Server validates the JWT signature and extracts the `userId`.
4. **Cache Lookup (Cache Aside):** The App Server checks Redis for the cache key `user:{userId}:notes:page:1`.
   - **Cache Hit:** The server deserializes the cached JSON array and immediately returns `200 OK` (Latency: ~15 ms).
   - **Cache Miss:** 
     1. The App Server queries the **Read Replica Database** executing the optimized query with joins.
     2. The retrieved rows are serialized and written into Redis with a 15-minute Time-To-Live (TTL).
     3. The App Server returns the note collection to the client with `200 OK` (Latency: ~65 ms).

### B. Write Request: `POST /api/v1/notes`
1. **Client Request:** The user fills the note form and clicks "Create Note", sending `POST /api/v1/notes` with payload `{ title, body, tags }`.
2. **Routing & Authentication:** The Load Balancer forwards the request to an App Server, which verifies authentication.
3. **Validation:** The App Server validates that `title` is present and $\le 100$ characters.
4. **Transactional Write:** The App Server executes an atomic transaction on the **Primary Database** inserting the note row and linking tags in `note_tags`.
5. **Cache Invalidation:** The App Server immediately deletes or updates the user's cached timeline keys in Redis (`user:{userId}:notes:*`) to prevent stale reads.
6. **Async Event Enqueueing:** The App Server pushes an asynchronous message `{ noteId, userId, action: "NOTE_CREATED" }` into the **Message Queue**.
7. **Client Response:** The App Server immediately responds to the client with `201 Created` and the new note JSON payload (Latency: ~120 ms).
8. **Asynchronous Worker Handling:** A background worker picks up the message from the queue and updates the full-text search index.

---

## 6. Architectural Trade-offs

### Trade-off 1: Cache-Aside with Invalidation vs. Write-Through Caching
- **Decision:** Implemented **Cache-Aside with Explicit Invalidation on Write**.
- **Pros:** Keeps memory consumption low by only caching notes for active users who are currently browsing; avoids keeping dormant user records in expensive RAM.
- **Cons:** The first read request after a note write or cache expiry experiences a slight "cache miss" penalty while querying the database.

### Trade-off 2: Primary-Replica Asynchronous Replication vs. Synchronous Multi-Leader
- **Decision:** **Single Primary with Asynchronous Read Replicas**.
- **Pros:** Maximum write performance with minimal latency, as transactions commit immediately on the primary without waiting for network acknowledgement from replicas.
- **Cons:** Introduces a tiny replication lag window (typically 10–50 ms) where a read replica might briefly serve an older snapshot immediately after a write (mitigated by routing immediate post-write reads to cache or primary).

---

## 7. Eliminating Single Points of Failure (SPOF)

To ensure resilient 99.9% availability, redundancy is implemented across every layer:

- **DNS & Ingress Layer:** Cloudflare provides redundant Anycast DNS routing across hundreds of global points of presence; if a data center goes down, traffic is routed to nearest healthy nodes automatically.
- **Load Balancing Tier:** The Load Balancer operates as an active-passive multi-Availability Zone (AZ) pair with automated health monitoring.
- **Application Tier:** Stateless App Servers run across multiple availability zones behind an auto-scaling group (minimum 2 instances). If one server crashes, the load balancer automatically terminates connections to it and routes traffic to healthy instances.
- **Caching Tier:** Redis runs in a Primary-Replica cluster with Redis Sentinel for automated health detection and sub-10 second failover.
- **Database Tier:** PostgreSQL is configured with continuous streaming replication across availability zones. If the Primary database fails, automated failover promotes the Read Replica to Primary within 30 seconds while secondary standby instances are spun up.
- **Queue & Worker Tier:** RabbitMQ operates in a mirrored clustered queue across two nodes; background workers run as stateless container tasks that automatically restart on failure.
