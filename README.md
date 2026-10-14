🧠 MINDMATE

Your Personal Knowledge Partner

Upload. Understand. Ask. Find answers in your documents.
:::

📌 Table of Contents

Overview

Problem Statement

Project Goals

Features

Technology Stack

How It Works

Architecture

Getting Started

Configuration and API Keys

Privacy and Security

Testing

Current Limitations and Next
Steps

Project Status

🎯 Overview

MINDMATE --- Your Personal Knowledge Partner is a
document-intelligence application designed to help users work with their
personal documents in one workspace. Instead of manually searching
through lengthy files, users can ask questions, explore relevant
information, and get document-grounded responses.

The project follows a local-first approach for the application
interface, API, database, uploaded files, and logs. When configured, an
AI provider can be used for semantic embeddings and answer generation.

Implementation note: This README describes the intended product
and the documented local MVP architecture. Features marked as planned
or requiring verification should not be considered complete until they
work in the current codebase and have been tested.

❓ Problem Statement

Important information is often scattered across PDFs, text files, and
other documents. Finding a specific answer manually can be slow,
especially when users need to search across multiple files.

MINDMATE aims to reduce that effort by combining document management,
retrieval, and conversational question answering in one workspace.

🎯 Project Goals

Make document information easier to search and understand.

Answer questions using relevant passages from a user's documents.

Provide source references so users can check where an answer came
from.

Keep document-management workflows together in one interface.

Protect user-specific documents through ownership checks.

Keep local data and secrets out of public source control.

✨ Features

Core document intelligence

Document upload: Add supported documents to the workspace.

AI chat: Ask natural-language questions about document content.

Grounded answers: Retrieve relevant passages before generating
an answer.

Source citations: Display source details where supported by the
implementation.

Document summary: Produce a concise overview of a selected
document.

Document preview: Inspect a document in the workspace.

Document management

Version history: Review available versions of a document, if
versioning is enabled.

PDF compression: Intended to create a separate compressed PDF
that can be downloaded without overwriting the original.

Multi-document chat: Intended to answer questions across
selected documents and identify the supporting sources.

Voice input: Intended to convert speech into editable text and
send it through the normal chat workflow.

Experience and reliability

The documented MVP architecture also includes registration and sign-in,
protected authentication state, upload status, loading/error states,
conversation history, and structured application logs. Confirm the
behavior of each item in the running application.

🧰 Technology Stack

Layer                       Technology

Frontend                    React, TypeScript, Vite
UI styling/components       Tailwind CSS and shadcn/ui patterns
Backend API                 Python, FastAPI
Local database              SQLite
Document processing         Text extraction, chunking, and retrieval
AI integration              OpenAI embeddings and Responses API when configured
Client-side data fetching   TanStack Query
Forms and validation        React Hook Form and Zod
API exploration             FastAPI interactive documentation

Check requirements.txt, frontend/package.json, and the actual source
code to confirm the dependencies used by the current version.

🔄 How It Works

Upload --- The user uploads a supported document.

Extract --- The backend extracts readable text.

Chunk --- The text is split into smaller sections for retrieval.

Index --- If configured, an embedding model converts chunks into
vectors.

Ask --- The user asks a question in the chat.

Retrieve --- The system finds passages relevant to the question.

Answer --- The AI generates a response based on the retrieved
evidence.

Cite --- The application displays source information when
available.

A local extractive fallback may be available if the API key or network
is unavailable. This fallback may be less conversational than
provider-generated answers.

Metadata-aware behavior is important: a question such as "What is
the file size?" should return file metadata, not a summary of the
document's contents.

🏗️ Architecture

┌─────────────────────────────────────────────┐
│              React + TypeScript UI           │
│  Document Workspace | AI Chat | Sources      │
└──────────────────────┬──────────────────────┘
                       │ HTTP / API
┌──────────────────────▼──────────────────────┐
│                FastAPI Backend               │
│ Auth | Upload | Parsing | Retrieval | Chat   │
└───────────────┬─────────────────┬───────────┘
                │                 │
┌───────────────▼────────┐  ┌─────▼───────────┐
│      SQLite + Files    │  │  AI Provider    │
│ Local documents/data   │  │ If configured   │
└────────────────────────┘  └─────────────────┘

This is a conceptual architecture. Confirm the current source tree and
configuration before treating it as an exact deployment diagram.

🚀 Getting Started

Prerequisites

Install the following tools:

Python

Node.js and npm

Git

Visual Studio Code (recommended)

1. Open the project

Open the repository folder in VS Code and start a terminal at the
project root.

2. Create the Python environment

Windows PowerShell:

python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

If your current project uses a different backend entry point or
dependency file, follow the files in the repository.

3. Install frontend dependencies

cd frontend
npm install
npm run build
cd ..

4. Start the backend

For the documented local MVP:

python run.py

Use the actual entry point if the repository has changed.

5. Open the app

Application: http://localhost:8000

Interactive API docs: http://localhost:8000/docs

Create an account if registration is enabled. Configure the AI provider
through the intended settings UI.

6. Run the frontend in development mode

Keep the backend running, then open a second terminal:

cd frontend
npm run dev

Open the local URL printed by Vite, commonly http://localhost:5173.

⚙️ Configuration and API Keys

The documented MVP uses config.yaml for runtime settings, including
server details, local storage paths, authentication, upload limits,
chunking, retrieval, chat provider, model names, and logging.

Never paste an API key into chat messages or commit it to Git.

Keep real local configuration containing secrets excluded by
.gitignore.

If sharing the project, provide a safe example configuration without
real credentials.

An AI provider API key may require separate billing; a ChatGPT
subscription does not automatically include API credits.

If the API key is added after documents have already been indexed,
those documents may need to be re-indexed according to the
application's supported workflow.

🔐 Privacy and Security

The local-first setup is intended to keep the application database,
uploaded files, and logs on the user's computer. However, when
AI-provider features are enabled, document text or selected passages may
be sent to the configured provider to create embeddings or generate
answers.

Security practices:

Enforce user ownership checks on document and conversation
endpoints.

Store passwords using a suitable password-hashing method.

Keep API keys and token secrets out of source control.

Avoid logging full document text or credentials.

Do not upload sensitive files unless you understand the configured
processing and provider policies.

Back up important local documents and database files before making
destructive changes.

🧪 Testing

For the documented backend test suite:

python -m unittest discover -s tests -v

If frontend tests are configured:

cd frontend
npm test

Tests only verify the behavior they cover. A passing suite does not
automatically confirm live AI-provider requests or every end-to-end UI
feature.

Recommended manual checks:

Register, sign in, and sign out.

Upload supported document types and verify processing status.

Ask content questions and confirm citations.

Ask metadata questions, such as file name and file size.

Verify one user's documents cannot be accessed by another user.

Test PDF compression and download while confirming the original
remains unchanged.

Test version history and multi-document chat if implemented.

Test voice input in a supported browser if implemented.

🗺️ Current Limitations and Next Steps

Prioritize validating these workflows in the current application:

Reliable AI chat: Answer the question actually asked, including
metadata questions.

Grounded responses: Use relevant evidence and show useful source
references.

PDF compression: Generate a downloadable compressed copy without
replacing the original.

Multi-document chat: Support selected-document scopes and source
citations.

Voice input: Allow users to review the speech transcript before
sending it.

Document versions: Confirm version creation, listing, and any
supported restore behavior.

Security: Test authentication and per-user document isolation.

UI consistency: Keep the workspace focused and remove sections
that are not part of the intended product.

Error handling: Test unsupported files, empty documents, large
uploads, and provider/network failures.

📌 Project Status

MINDMATE is an evolving project. Treat each feature as complete only
after implementation and end-to-end verification. Update this section as
features are finished and tested.

Area                                Status to verify

Local application setup             Verify in current environment

Authentication and document         Test end to end
isolation

Document upload and parsing         Test supported file types

AI chat and citations               Test content and metadata questions

Document summary and preview        Verify UI and API

Version history                     Verify implementation

PDF compression and download        Verify output and original
preservation

Multi-document chat                 Verify implementation

🧱 Design Trade-offs

A local-first MVP using SQLite, local folders, and FastAPI can be easier
to run and understand than a distributed system. A larger production
deployment may need a managed database, object storage, durable
background jobs, stronger secret management, backups, HTTPS, and
operational monitoring.