# DocChat Local MVP

DocChat is a deliberately small local document chatbot. The browser UI, API, SQLite database, uploaded files, and structured logs run on your computer. OpenAI is used only for embeddings and grounded answer generation when an API key is configured.
## Screenshots

### Account Registration
<img width="870" height="418" alt="docchat-register" src="https://github.com/user-attachments/assets/72ccbcf9-c229-491f-8108-e7860e7d3673" />

### Sign In
<img width="931" height="421" alt="docchat-login" src="https://github.com/user-attachments/assets/71be4da6-fb04-429c-811d-f1c1f4aa0a5b" />

### Document Workspace
<img width="953" height="423" alt="docchat-workspace" src="https://github.com/user-attachments/assets/067891e6-5701-4e3b-a106-6a597ae39f28" />

## What is included

- Email/password registration and signed bearer tokens
- User-isolated PDF, DOCX, and TXT upload up to the configured size limit
- Local parsing, chunking, SQLite persistence, conversation history, and feedback
- Token-aware OpenAI embedding batches with local cosine retrieval plus keyword fallback
- OpenAI Responses API answer generation constrained to retrieved passages
- Offline extractive fallback if the API key or network is unavailable
- Source citations containing page, section, chunk ID, match level, and snippet
- SSE response events for the browser chat experience
- Local JSONL logs with request IDs and latency; document text is not logged
- React + TypeScript workspace built with Vite, Tailwind CSS, and shadcn/ui patterns
- TanStack Query caching, React Hook Form + Zod validation, and protected authentication state
- Upload progress, processing status, loading/empty/error states, retry actions, and toast feedback
- Switchable chat models and a responsive Sources panel with expandable citation cards
- API-key entry in the local settings dialog; the saved key is never sent back to the browser
- Desktop three-column workspace and responsive document/source drawers
- VS Code launch, dependency, and test tasks

Every setting is in `config.yaml`. There is no `.env` file.

## Quick start in VS Code

1. Open this folder in VS Code.
2. Open the integrated terminal and install the backend and frontend dependencies:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   python -m pip install --upgrade pip
   python -m pip install -r requirements.txt
   cd frontend
   npm install
   npm run build
   cd ..
   ```

   On Windows PowerShell, activate with `.venv\Scripts\Activate.ps1`. Update `.vscode/settings.json` to `.venv\\Scripts\\python.exe` if VS Code does not detect it automatically.

3. Run the app using either:

   - VS Code **Run and Debug** → **DocChat: Run local app**, or
   - the terminal: `python run.py`

4. Open [http://localhost:8000](http://localhost:8000), create an account, open the avatar settings, and paste your OpenAI API key into the password-style field. It is saved locally in `config.yaml`, applied immediately, and never returned to the browser.

5. Upload a document, wait for the `ready` badge, and ask a question. Do not paste the key into chat, logs, screenshots, or source control. `config.yaml` is excluded by `.gitignore`.

The first upload with an API key creates embeddings through OpenAI. If you add the key after uploading documents, select each existing document and call `POST /api/documents/{id}/reindex` from the API docs at [http://localhost:8000/docs](http://localhost:8000/docs), or upload the document again.

## Configuration

The API key can be saved, replaced, or cleared from the local settings dialog without restarting. Edit `config.yaml` and restart the server for other configuration changes.

| Section | Important settings |
| --- | --- |
| `server` | Local host, port, development reload |
| `paths` | SQLite database, upload directory, log file, static UI |
| `security` | Local token secret, token lifetime, password hashing work factor |
| `uploads` | File size and extension allowlist |
| `chunking` | Chunk and overlap size |
| `retrieval` | Result count, evidence threshold, context budget |
| `chat` | OpenAI or extractive provider, refusal text, history length, system prompt |
| `openai` | API key, base URL, chat/embedding models, reasoning effort, timeouts |
| `logging` | Log level, rotation size, retained files |

`gpt-5.6-terra` is the default chat model because it balances quality and cost for document Q&A. The header selector can switch among the models listed in `openai.chat_models`. `text-embedding-3-small` is the default embedding model, with 256 dimensions to keep large local SQLite indexes compact.

For large files, uploads are streamed to disk in 1 MB pieces. Extracted content is split into bounded 500-unit chunks, then embedding requests are packed by both item count and estimated token count. Rate-limit and transient server errors use exponential backoff. The default 8,000-chunk safety limit prevents an unusually text-heavy 50 MB file from creating an accidental unbounded API bill; it can be raised in `config.yaml` after estimating the expected cost and local index size.

## Project structure

```text
backend/docchat/
  api/routes/       FastAPI endpoints grouped by resource
  core/             YAML configuration, authentication, structured logging
  infrastructure/   SQLite repository and OpenAI HTTP client
  services/         parsing, chunking, ingestion, retrieval, answer generation
  main.py           small application assembly layer
frontend/           standalone local browser UI
  src/components/   React feature and shadcn/ui components
  src/lib/          typed API client and shared utilities
  src/types/        FastAPI response and domain types
  dist/             production build served by FastAPI
tests/              unit and upload-to-chat integration tests
config.yaml         all runtime configuration
run.py              local entry point
```

## Local data and logs

- SQLite database: `data/docchat.db`
- Uploaded files: `data/uploads/`
- Rotating structured log: `logs/docchat.jsonl`

Deleting a document removes its file, chunks, conversations, messages, citations, and feedback. To reset the whole MVP, stop the server and manually delete `data/` and `logs/`. This is intentionally not automated because the operation is destructive.

## Run tests

Use the VS Code task **DocChat: run tests**, or run both suites:

```bash
python -m unittest discover -s tests -v
cd frontend && npm test
```

The tests cover password/token security, multilingual chunking, user ownership isolation, a TXT upload-to-chat flow with citations, frontend display helpers, and document status rendering. They do not spend API credits. A live OpenAI request is intentionally not part of the test suite.

## Frontend development

For hot reload, keep FastAPI running on port 8000 and start Vite in a second terminal:

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies API, readiness, and health requests to FastAPI. Run `npm run build` before opening the production UI on port 8000.

## Docker option

```bash
docker compose up --build
```

The container mounts `config.yaml`, `data/`, and `logs/` from this folder, so configuration and application data remain local. Open [http://localhost:8000](http://localhost:8000), then enter the API key in the local settings dialog.

For a temporary hosted demo, `render.yaml` defines a free Render web service. The
container uses `config.example.yaml`, which never contains a real API key, and Render
generates `DOCCHAT_SECRET_KEY` at deploy time. Free instances use ephemeral storage,
so accounts and uploaded documents can reset after the service sleeps or redeploys.

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`
- `GET/POST /api/documents`, `GET/DELETE /api/documents/{id}`
- `POST /api/documents/{id}/reindex`
- `GET/POST /api/documents/{id}/conversations`
- `GET /api/conversations/{id}/messages`
- `POST /api/conversations/{id}/messages/stream`
- `POST /api/messages/{id}/feedback`
- `GET /api/settings`, `PUT/DELETE /api/settings/openai-key`
- `GET /health`, `GET /ready`

Interactive API documentation is at [http://localhost:8000/docs](http://localhost:8000/docs) while the app is running.

## MVP trade-offs

This version intentionally replaces PostgreSQL/pgvector, Redis, MinIO, Celery, Next.js, and separate workers with SQLite, local folders, a static browser UI, and FastAPI background tasks. That makes it easy to understand and run in VS Code. For a team deployment, move secrets out of YAML, use a production database/object store, add a durable job queue, and terminate TLS in front of the API.
