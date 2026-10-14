MINDMATE --- Your Personal Knowledge Partner

MINDMATE is a personal document-intelligence workspace designed to help
users upload, understand, search, and manage their documents from one
place. Instead of manually searching through long files, users can ask
questions about their documents and receive answers grounded in the
available document content.

The project is built around a local-first architecture: the web
interface, API, database, uploaded files, and application logs can run
on the user's computer. When configured, an OpenAI API is used for
embeddings and AI-generated answers. API usage may incur charges.

Project status: This README describes the project design and
development setup. Features should be considered complete only after
they have been implemented and tested in the current codebase.

Core idea

MINDMATE aims to make personal documents easier to understand and work
with through a single workspace.

Upload and organize personal documents.

Ask questions about a document using AI.

Generate concise document summaries.

Preview documents before working with them.

Review document version history.

Create a separate compressed PDF for download while preserving the
original file.

Support questions across multiple selected documents, with source
citations.

Offer voice input in the existing chat interface, where supported by
the current implementation.

Main workspace

The planned workspace brings document management and AI assistance
together instead of making users switch between separate tools.

AI Chat

Ask natural-language questions about uploaded documents. Answers should
use relevant retrieved passages and show sources where available. The
chat should distinguish document content from file metadata---for
example, a question about file size should return the file's size rather
than a summary of its contents.

Document Preview

Preview a selected document from the workspace. The available preview
format depends on the file type and the implementation.

AI Summary

Generate a shorter overview of a document to help users understand its
main points quickly.

Version History

Track available versions of a document and review earlier versions when
versioning is enabled.

PDF Compression

Generate a compressed PDF as a separate downloadable output. The
original uploaded document should remain unchanged.

Multi-document chat

Ask a question across one or more selected documents. The answer should
be grounded in those documents and identify its sources. The interface
is intended to remain part of the existing AI Chat experience.

Voice input

Use the microphone to turn speech into editable text, then submit that
text through the normal chat flow. Browser speech-recognition support
and permissions may affect availability.

Technology stack

The documented local MVP architecture uses:

Layer                               Technology

Frontend                            React, TypeScript, Vite

UI                                  Tailwind CSS and shadcn/ui patterns

Backend API                         Python, FastAPI

Database                            SQLite

Document processing                 Local parsing, chunking, and
retrieval

AI integration                      OpenAI embeddings and Responses
API, when configured

Frontend data and forms             TanStack Query, React Hook Form,
Zod

API documentation                   FastAPI interactive docs

Check the actual project files and dependency manifests before assuming
every item in this table is currently integrated.

How document Q&A works

The intended document-question-answering flow is:

Upload: The user uploads a supported document.

Extract: The backend extracts readable text from the file.

Chunk: The extracted text is divided into smaller sections for
retrieval.

Index: When an API key is configured, document chunks can be
embedded for semantic retrieval.

Retrieve: A user's question is matched against relevant document
passages.

Generate: The AI creates an answer based on the retrieved
evidence.

Cite: The response presents source details where available.

A local extractive fallback may be used when the API key or network is
unavailable. The fallback may not provide the same conversational
quality as an AI-generated response.

Privacy and local data

In the local architecture, the application database, uploaded documents,
and logs are stored on the user's computer. If OpenAI features are
enabled, document text or selected text passages may be sent to the
configured API as required for embedding or answer generation. Users
should review their configuration and provider policies before uploading
sensitive documents.

Do not commit API keys, passwords, local configuration containing
secrets, uploaded documents, databases, or generated logs to source
control. Keep local secrets out of screenshots, chat messages, and
public repositories.

Quick start in VS Code

Use the commands that match the current repository. The following
reflects the documented FastAPI + React/Vite setup.

1. Open the project

Open the MINDMATE project folder in VS Code.

2. Create and activate a Python virtual environment

Windows PowerShell:

python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

If PowerShell blocks activation, use the Python executable inside
.venv directly or follow your local environment's activation policy.

3. Install frontend dependencies

cd frontend
npm install
npm run build
cd ..

4. Start the backend

python run.py

If the entry point or commands differ in the current repository, use its
actual run configuration.

5. Open the application

App: http://localhost:8000

API documentation: http://localhost:8000/docs

Create an account if registration is enabled. Configure an API key only
through the application's intended settings interface. Never paste the
key into the chat or commit it to GitHub.

6. Frontend development mode

Keep the backend running and open a second terminal:

cd frontend
npm run dev

Open the Vite URL printed in the terminal, commonly
http://localhost:5173.

Configuration

Configuration options depend on the current codebase. The documented
local MVP uses config.yaml for settings such as:

Server host and port

Database, upload, log, and static-UI paths

Authentication and token settings

Allowed upload file types and size limits

Document chunking and retrieval settings

Chat provider, prompt, and model selection

OpenAI API key, model names, and timeouts

Logging level and rotation

Do not publish a real API key or secret configuration file. If the
project uses config.yaml, keep the real local file ignored by Git and
provide a safe example configuration for collaborators.

Local data and logs

The documented local MVP uses these paths:

SQLite database: data/docchat.db (rename to a MINDMATE-specific
path if the implementation has been updated)

Uploaded files: data/uploads/

Structured logs: logs/

Confirm the actual paths in the current configuration before deleting or
moving data. Deleting application data may permanently remove accounts,
documents, conversations, and related records. Stop the application
first and make a backup if the data matters.

Testing

Run the tests included in the repository. For the documented setup:

python -m unittest discover -s tests -v

For frontend tests, if configured:

cd frontend
npm test

A successful test run verifies only the behaviors covered by those
tests. It does not necessarily validate live AI-provider requests, every
file type, or every UI workflow.

API documentation

When the backend is running, use:

http://localhost:8000/docs

The documented API design includes endpoints for authentication,
document upload and retrieval, conversations, streamed chat responses,
feedback, API-key settings, health, and readiness. Confirm the exact
endpoint list in the running API documentation.

Repository structure

The documented architecture is organized approximately as follows:

MINDMATE/
├── backend/
│   └── docchat/
│       ├── api/routes/       # API endpoints
│       ├── core/             # Configuration, authentication, logging
│       ├── infrastructure/   # Database and provider clients
│       ├── services/         # Parsing, ingestion, retrieval, AI answers
│       └── main.py            # Application assembly
├── frontend/
│   └── src/
│       ├── components/        # Workspace and UI components
│       ├── lib/               # API client and shared utilities
│       └── types/              # Frontend types
├── tests/                     # Backend and frontend tests
├── config.example.yaml        # Safe example configuration, if present
├── run.py                     # Local entry point, if present
└── README.md

This is a reference structure based on the documented architecture, not
a guarantee that every path exists in the current repository. Update it
to match the actual project tree before publishing.

Known limitations and next steps

The following are important quality goals for MINDMATE and should be
verified against the current implementation:

Ensure AI Chat answers the user's actual question, including file
metadata questions.

Keep responses grounded in retrieved document evidence and show
useful citations.

Verify document ownership checks so one user cannot access another
user's documents.

Test PDF compression end-to-end and confirm that the output is
downloadable and the original remains unchanged.

Test version creation, listing, and restoration if restoration is
supported.

Verify multi-document chat across selected files and the "all my
documents" scope.

Verify voice input, transcript editing, and submission through the
regular chat pipeline.

Remove any UI sections that are not part of the intended product
experience.

Add tests for error states, unsupported files, empty documents,
large files, and provider failures.

Design trade-offs

A local-first MVP can use SQLite, local folders, and FastAPI background
tasks to stay straightforward to run and understand. A larger team
deployment may need a production database, object storage, durable
background jobs, stronger secret management, HTTPS, backups, and
operational monitoring.

Project goal

MINDMATE --- Your Personal Knowledge Partner aims to turn personal
documents into information users can find, understand, and act
on---through document-grounded chat and practical document-management
tools.