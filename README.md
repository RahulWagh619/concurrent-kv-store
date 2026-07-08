# Vertex Hybrid Distributed Key-Value Engine

<p align="center">

![C++17](https://img.shields.io/badge/C%2B%2B-17-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-Express-green)
![Docker](https://img.shields.io/badge/Docker-Containerized-blue)
![Thread Safe](https://img.shields.io/badge/Thread--Safe-Yes-success)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-orange)

</p>

A **high-performance, multi-threaded hybrid Key-Value Storage Engine** built from scratch using **C++17** and **Node.js**. The project combines a native concurrent storage engine with an Express API gateway to deliver fast in-memory operations, binary persistence, and cloud deployment.

---

## 🚀 Live Demo

**Base URL**

https://concurrent-kv-store.onrender.com

**Sample Request**

```http
GET https://concurrent-kv-store.onrender.com/get/cloud_test
```

You can interact with the API using:

- Browser
- Postman
- curl
- Any HTTP client

---

# ✨ Features

- ⚡ Native C++17 storage engine
- 🔀 16-way sharded in-memory architecture
- 🔒 Thread-safe operations using `std::shared_mutex`
- 🚀 Parallel reads with isolated writes
- 💾 Custom binary persistence engine
- 🔄 Automatic recovery from snapshots
- 🌐 Express.js REST API gateway
- 🔗 Inter-process communication via `stdin/stdout`
- 🐳 Dockerized for cloud deployment
- ☁️ Deployed globally on Render
- 🖥️ Cross-platform (Windows & Linux)

---

# 🏗️ System Architecture

```text
                HTTP Requests
                      │
                      ▼
           Express.js API Gateway
                      │
          stdin / stdout IPC Bridge
                      │
                      ▼
          Native C++ Storage Engine
                      │
        ┌─────────────┴─────────────┐
        │                           │
   Hash Function              Lock Manager
        │                           │
        ▼                           ▼
 16 Independent Memory Shards (shared_mutex)
        │
        ▼
 Binary Persistence (.db Snapshot)
```

---

## 🔄 Request Flow

1. Client sends an HTTP request.
2. Express receives and validates the request.
3. Request is forwarded to the C++ engine through `stdin`.
4. The engine hashes the key into one of **16 shards**.
5. A shard-level `shared_mutex` guarantees thread safety.
6. The response is returned back to Express via `stdout`.
7. Express sends the final JSON response to the client.

---

# ⚙️ Why Hybrid?

Most Node.js applications execute JavaScript on a single thread.

Vertex delegates storage management to a native **C++ engine**, allowing memory operations to fully utilize multiple CPU cores.

### Benefits

- Faster execution
- True parallelism
- Lower API latency
- Better scalability
- Efficient memory management

---

# 💾 Persistence

Instead of storing data as JSON, Vertex serializes memory into a custom binary database.

### Advantages

- Faster serialization
- Lower disk usage
- No JSON parsing overhead
- Automatic recovery after crashes

Snapshot file:

```text
vertex_data.db
```

---

# 🛠️ Tech Stack

### Core Engine

- C++17
- STL
- Threads
- std::shared_mutex
- Binary File I/O

### Backend

- Node.js
- Express.js
- Child Process API

### Deployment

- Docker
- Render

### Client

- C++ WinHTTP

---

# 📡 API Endpoints

## Write Data

```http
POST /set
```

Body

```json
{
  "key": "user_101",
  "value": "Alice"
}
```

---

## Read Data

```http
GET /get/:key
```

Example Response

```json
{
  "status": "success",
  "data": "Alice"
}
```

---

## Delete Data

```http
DELETE /del/:key
```

---

## Save Snapshot

```http
POST /save
```

Creates a binary snapshot of all memory shards.

---

# 💻 Local Installation

## Prerequisites

- Node.js (v18+)
- GCC / G++ (C++17)
- Git

### Clone Repository

```bash
git clone https://github.com/RahulWagh619/concurrent-kv-store.git
cd concurrent-kv-store
```

### Install Dependencies

```bash
npm install
```

### Compile (Windows)

```bash
g++ -std=c++17 -O3 -static src/server.cpp src/KVStore.cpp -o src/server.exe
```

### Compile (Linux)

```bash
g++ -std=c++17 -O3 src/server.cpp src/KVStore.cpp -o src/server.out
```

### Start the Server

```bash
node app.js
```

---

# 🐳 Docker Deployment

The project includes a production-ready Dockerfile.

The container automatically:

- Builds a lightweight Linux image
- Installs the C++ toolchain
- Compiles the storage engine
- Starts the Express gateway
- Exposes the public HTTP port

Suitable for platforms like **Render**, **AWS**, and **Google Cloud**.

---

# 📁 Project Structure

```text
.
├── src/
│   ├── server.cpp
│   ├── KVStore.cpp
│   ├── KVStore.h
│   └── ...
├── app.js
├── package.json
├── Dockerfile
├── vertex_data.db
└── README.md
```

---

# 📈 Future Improvements

- Distributed replication
- Write-Ahead Logging (WAL)
- LRU Cache
- TTL-based key expiration
- Cluster synchronization
- Authentication & Authorization
- Metrics dashboard
- Performance benchmarking suite

---

# 👨‍💻 Author

**Rahul Wagh**

Built from scratch to explore **systems programming**, **concurrent data structures**, **storage engines**, and **distributed backend architecture**.

---

⭐ If you found this project interesting, consider giving it a **star**!
