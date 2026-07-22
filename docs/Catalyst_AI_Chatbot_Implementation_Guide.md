# AI Chatbot with Zoho Catalyst

**Database Mode (Dual-Prompt NL2SQL) & Knowledge Base Mode (Session-Scoped RAG)**

*A step-by-step implementation guide using the Catalyst Python SDK*

---

> ## ⚠️ Read this before you build anything
>
> **Catalyst QuickML is not an LLM gateway.** The URL you shared documents `quickml.predict(endpoint_key, input_data)`, which calls a pre-trained, no-code ML pipeline (classification/regression) that you publish from the Catalyst console. It is not a way to send a free-text prompt to a generative model like glm-4.7-flash and get a written answer back. There is also no built-in Catalyst service that hosts or proxies glm-4.7-flash.
>
> **Catalyst's only generative-AI integration** is the console-side "Zia AI Assistant" (code generation/debugging tools for developers inside the Catalyst console itself, backed by OpenAI, BYOK). It is not an API your running application can call at request time.
>
> **What this means for your architecture:** the two LLM prompts in your idea (schema/intent selection, and the glm-4.7-flash summarization step) are handled by your own Python code making a direct HTTPS call to whichever provider actually serves glm-4.7-flash (e.g. Zhipu AI / Z.ai's chat-completions endpoint), using the `requests` library or that provider's SDK. Catalyst's Python SDK is used for everything else: Data Store + ZCQL (the structured query execution), File Store + Zia OCR (document ingestion), and Authentication/AppSail (hosting). This guide is built on that corrected architecture — it is more accurate to how Catalyst actually works, and it still implements every step in your idea.
>
> *One more correction: your idea's "fallback to the default Catalyst QuickML RAG endpoint" also doesn't correspond to a real Catalyst feature — QuickML has no RAG/retrieval endpoint. Section 7.5 gives you an accurate fallback (answer from the model with no document context, clearly labelled) instead.*

---

## Contents

1. [Architecture at a Glance](#1-architecture-at-a-glance)
2. [Prerequisites](#2-prerequisites)
3. [Create the Catalyst Project & Install the SDK](#3-create-the-catalyst-project--install-the-sdk)
4. [Design the Data Store Tables](#4-design-the-data-store-tables)
5. [Auto-Generate the Schema Context](#5-auto-generate-the-schema-context-catalyst_datastore_schemajson)
6. [Database Mode — the Dual-Prompt NL2SQL Pipeline](#6-database-mode--the-dual-prompt-nl2sql-pipeline)
   - 6.1 [Prompt 1: Schema Selection & Intent Mapping](#61-prompt-1-schema-selection--intent-mapping)
   - 6.2 [Building & Executing the ZCQL Query](#62-building--executing-the-zcql-query)
   - 6.3 [Prompt 2: GLM-4.7-Flash Summarization](#63-prompt-2-glm-47-flash-summarization)
7. [Knowledge Base Mode — Session-Scoped RAG](#7-knowledge-base-mode--session-scoped-rag)
   - 7.1 [Uploading Documents to the File Store](#71-uploading-documents-to-the-file-store)
   - 7.2 [Extracting Text with Zia OCR](#72-extracting-text-with-zia-ocr)
   - 7.3 [Storing Chunks in chat_bot_knowledge_base](#73-storing-chunks-in-chat_bot_knowledge_base)
   - 7.4 [Keyword-Overlap Retrieval](#74-keyword-overlap-retrieval)
   - 7.5 [Context Injection, Citations & Fallback](#75-context-injection-citations--fallback)
8. [The Flask/AppSail Chat Service](#8-the-flaskappsail-chat-service-wiring-it-together)
9. [Deploying with the Catalyst CLI](#9-deploying-with-the-catalyst-cli)
10. [Limits, Security & Production Notes](#10-limits-security--production-notes)

---

## 1. Architecture at a Glance

The system has three moving parts, and it matters which one does which job:

| Layer | Technology | Responsibility |
|---|---|---|
| Compute / hosting | Catalyst AppSail (Python, Flask) | Runs your always-on chat API; holds session state; routes between Database Mode and Knowledge Base Mode |
| Structured data | Catalyst Data Store + ZCQL | Stores CaseMaster/Accused-style tables; executes the generated ZCQL query |
| Documents | Catalyst File Store + Zia OCR | Stores uploaded PDFs/images per session; extracts raw text |
| Reasoning / language | Direct HTTPS call to your LLM provider (glm-4.7-flash) | Schema selection, ZCQL generation, and the final natural-language answer — **NOT** Catalyst QuickML |

Request flow, end to end:

```
User message
   |
   v
Flask endpoint (/chat) on Catalyst AppSail
   |
   +-- mode == "database" --------------------------------+
   |     1. Prompt 1  -> LLM: pick tables/columns          |
   |     2. Build ZCQL from that JSON                      |
   |     3. zcql_service.execute_query(query)              |
   |     4. Prompt 2  -> LLM: summarize rows + IDs         |
   |                                                        |
   +-- mode == "knowledge_base" ---------------------------+
         1. (on upload) File Store -> Zia OCR -> Data Store
         2. (on question) fetch session's chunks from
            chat_bot_knowledge_base, score by keyword overlap
         3. inject top chunks into LLM system prompt
         4. LLM answers, citing [Source: filename.pdf]
```

---

## 2. Prerequisites

- A Zoho Catalyst account and a project created in the Catalyst console (`console.catalyst.zoho.com`).
- Python 3.10–3.13 and pip installed locally — this is the range the Catalyst Python SDK officially supports.
- The Catalyst CLI installed (`npm install -g zcatalyst-cli`) and logged in, for initializing/deploying the project.
- An API key from whichever provider hosts glm-4.7-flash for you (e.g. a Zhipu AI / Z.ai account). Confirm the exact endpoint URL, auth header format, and request/response schema from that provider's own docs before wiring Sections 6.1/6.3/7.5 — those details are outside Catalyst and this guide cannot verify them for you.
- Basic familiarity with Flask, since AppSail's documented Python integration pattern is Flask-based.

---

## 3. Create the Catalyst Project & Install the SDK

1. In the Catalyst console, create a new project (or open your existing Karnataka Police FIR project).

2. Locally, install the SDK:

```bash
pip install zcatalyst-sdk
```

3. Initialize the SDK inside your AppSail Flask app. Every Catalyst component (Data Store, File Store, Zia, ZCQL) hangs off the object returned by `initialize()`:

```python
from flask import Flask, request, g
import os
import zcatalyst_sdk
from zcatalyst_sdk.catalyst_app import CatalystApp

app = Flask(__name__)

@app.before_request
def before_request():
    # Initializes the SDK using the incoming request context.
    # Admin scope has unrestricted access; use scope='user' if you want
    # Catalyst's own Authentication roles to gate table/file access instead.
    g.zc_app = zcatalyst_sdk.initialize(req=request)

listen_port = os.getenv('X_ZOHO_CATALYST_LISTEN_PORT', 9000)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=listen_port)
```

> **Note:** the official AppSail documentation demonstrates Flask (also lists Django, Bottle, CherryPy as supported). It does not document a FastAPI integration pattern. If you'd rather use FastAPI, you can still deploy it to AppSail as a custom OCI-container runtime, but you'd be responsible for wiring request-scoped SDK initialization yourself rather than following a documented example — Flask is the safer, verified path for this guide.

---

## 4. Design the Data Store Tables

Create these tables from the Catalyst console (Data Store tables and their columns must be created there — the SDK only reads/writes rows, it doesn't create table structure):

### CaseMaster

| Column | Type | Notes |
|---|---|---|
| crime_no | varchar | FIR / crime number |
| station | varchar | e.g. Bengaluru station name |
| offence_type | varchar | e.g. "Theft" |
| date_of_offence | datetime | |
| status | varchar | Open / Closed / Under investigation |

### Accused

| Column | Type | Notes |
|---|---|---|
| name | varchar | |
| crime_no | varchar | Foreign-key-style link back to CaseMaster.crime_no |
| prior_offences_count | bigint | Used for "repeat offender" questions |

### chat_bot_knowledge_base

This table is the one that gives Knowledge Base Mode its session isolation — every row is scoped to a `session_uuid`.

| Column | Type | Notes |
|---|---|---|
| session_uuid | varchar | Search-indexed — enable "search_index_enabled" on this column in the console so lookups by session are fast |
| file_id | varchar | Catalyst File Store file ID |
| file_name | varchar | Original filename, shown in citations |
| chunk_index | bigint | Order of this chunk within the document |
| chunk_text | varchar | ~800-character slice of the OCR'd text |

---

## 5. Auto-Generate the Schema Context (catalyst_datastore_schema.json)

Rather than hand-maintaining a schema file that drifts out of sync with the console, generate it from the Data Store's own metadata using `datastore_service.get_all_tables()` and `get_table_details()`, and cache the result (e.g. in Catalyst Cache) so you're not re-fetching it on every chat message.

```python
def build_schema_context(zc_app):
    """Returns a compact {table: [columns]} dict for Prompt 1, built
    straight from the live Data Store metadata."""
    datastore_service = zc_app.datastore()
    schema = {}
    for t in datastore_service.get_all_tables():
        table_name = t["table_name"]
        if table_name in ("chat_bot_knowledge_base",):
            continue  # don't expose the KB table to Database Mode
        details = datastore_service.get_table_details(table_name)
        schema[table_name] = [
            c["column_name"] for c in details["column_details"]
            if c["column_name"] not in ("ROWID", "CREATORID", "CREATEDTIME", "MODIFIEDTIME")
        ]
    return schema
```

Write the result to `catalyst_datastore_schema.json` (or hold it in memory / Catalyst Cache) and pass it into Prompt 1 below.

---

## 6. Database Mode — the Dual-Prompt NL2SQL Pipeline

### 6.1 Prompt 1: Schema Selection & Intent Mapping

This is a direct HTTPS call to your LLM provider — not a Catalyst SDK call. The exact request shape below (endpoint path, header name, payload keys) follows the common OpenAI-style chat-completions convention that most providers, including most GLM-compatible endpoints, use; verify the precise field names against your provider's docs before relying on this in production.

```python
import requests, json, os

LLM_API_URL = os.environ["LLM_API_URL"]      # e.g. provider's chat completions endpoint
LLM_API_KEY = os.environ["LLM_API_KEY"]

def call_llm(system_prompt, user_prompt, model="glm-4.7-flash", temperature=0.1):
    resp = requests.post(
        LLM_API_URL,
        headers={"Authorization": f"Bearer {LLM_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def select_schema(question, schema_context):
    system_prompt = (
        "You map a natural-language question to the minimum set of tables and "
        "columns needed to answer it, given this schema: "
        f"{json.dumps(schema_context)}. "
        "Reply with ONLY a JSON object like "
        '{"tables": ["CaseMaster", "Accused"], '
        '"columns": ["CaseMaster.crime_no", "Accused.name"]}. No prose.'
    )
    raw = call_llm(system_prompt, question)
    return json.loads(raw)
```

### 6.2 Building & Executing the ZCQL Query

The second half of Prompt 1's job — turning the selected tables/columns into a syntactically correct ZCQL statement — is still an LLM call (the model has to reason about joins), but the execution itself is a genuine Catalyst SDK call: `zcql_service.execute_query()`.

```python
def generate_zcql(question, selection):
    system_prompt = (
        "Write ONE syntactically correct ZCQL SELECT statement for Zoho "
        "Catalyst's Data Store that answers the question, using only these "
        f"tables/columns: {json.dumps(selection)}. "
        "ZCQL supports standard SQL JOIN, GROUP BY, ORDER BY and aggregate "
        "functions. Reply with ONLY the query text, no markdown, no semicolon."
    )
    return call_llm(system_prompt, question).strip()


def run_database_query(zc_app, question):
    schema_context = build_schema_context(zc_app)          # Section 5
    selection = select_schema(question, schema_context)      # Prompt 1a
    zcql_query = generate_zcql(question, selection)           # Prompt 1b

    zcql_service = zc_app.zcql()
    rows = zcql_service.execute_query(zcql_query)             # real Catalyst call

    return zcql_query, rows
```

> **Safety note:** an LLM-generated query executed directly against your live Data Store is a SQL-injection-shaped risk even though it's ZCQL, not SQL. At minimum: run under a restricted/User-scope SDK initialization rather than Admin scope, reject any query the LLM returns that isn't a SELECT (this pipeline has no business need for INSERT/UPDATE/DELETE), and log the generated query alongside the question for audit.

### 6.3 Prompt 2: GLM-4.7-Flash Summarization

Feed the retrieved rows (with their exact IDs) back to the model and ask for a human-readable answer plus an executive summary:

```python
def summarize_rows(question, zcql_query, rows):
    system_prompt = (
        "You are a crime-analytics assistant. Given the user's question, the "
        "ZCQL query that was run, and the exact rows returned (including their "
        "IDs), write a clear, factual answer that lists the specific records "
        "found, then end with a one-paragraph executive summary. Do not invent "
        "any record that is not in the data provided."
    )
    user_prompt = (
        f"Question: {question}\n"
        f"Query executed: {zcql_query}\n"
        f"Rows: {json.dumps(rows, default=str)}"
    )
    return call_llm(system_prompt, user_prompt, temperature=0.2)


def handle_database_mode(zc_app, question):
    zcql_query, rows = run_database_query(zc_app, question)
    if not rows:
        return "No matching records were found for that query."
    return summarize_rows(question, zcql_query, rows)
```

---

## 7. Knowledge Base Mode — Session-Scoped RAG

### 7.1 Uploading Documents to the File Store

Create one File Store folder to hold all uploads (or one folder per session, if you want stronger isolation). Upload returns a Catalyst file ID you'll store alongside the session UUID.

```python
def upload_document(zc_app, uploaded_file, folder_id):
    filestore_service = zc_app.filestore()
    folder = filestore_service.folder(folder_id)
    result = folder.upload_file(uploaded_file.filename, uploaded_file.stream)
    return result  # contains result["id"], the file ID
```

### 7.2 Extracting Text with Zia OCR

Zia OCR accepts `.jpg`, `.jpeg`, `.png`, `.tiff`, `.bmp` and `.pdf`, with a 20 MB file-size limit, and Catalyst does not retain or train on the uploaded file — it's used once for extraction only.

```python
def extract_text(zc_app, file_path):
    zia = zc_app.zia()
    with open(file_path, "rb") as img:
        result = zia.extract_optical_characters(img, {"language": "eng", "modelType": "OCR"})
    return result["text"]
```

### 7.3 Storing Chunks in chat_bot_knowledge_base

Split the OCR'd text into ~800-character chunks and insert one row per chunk, tagged with the session UUID so retrieval never crosses sessions:

```python
def chunk_text(text, chunk_size=800):
    return [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]


def ingest_document(zc_app, session_uuid, file_id, file_name, full_text):
    datastore_service = zc_app.datastore()
    table_service = datastore_service.table("chat_bot_knowledge_base")

    rows = [
        {
            "session_uuid": session_uuid,
            "file_id": str(file_id),
            "file_name": file_name,
            "chunk_index": idx,
            "chunk_text": chunk,
        }
        for idx, chunk in enumerate(chunk_text(full_text))
    ]
    if rows:
        table_service.insert_rows(rows)
```

### 7.4 Keyword-Overlap Retrieval

Pull every chunk belonging to the active session with a ZCQL SELECT, then rank by simple word-overlap against the question — no vector database required for this scope:

```python
import re

def _words(text):
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def get_session_chunks(zc_app, session_uuid):
    zcql_service = zc_app.zcql()
    query = (
        "SELECT chunk_text, file_name, chunk_index FROM chat_bot_knowledge_base "
        f"WHERE session_uuid = '{session_uuid}'"
    )
    return zcql_service.execute_query(query)


def top_matching_chunks(zc_app, session_uuid, question, top_k=5):
    chunks = get_session_chunks(zc_app, session_uuid)
    q_words = _words(question)

    scored = []
    for row in chunks:
        record = row["chat_bot_knowledge_base"]
        overlap = len(q_words & _words(record["chunk_text"]))
        if overlap > 0:
            scored.append((overlap, record))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored[:top_k]]
```

> *Note: the exact nesting of ZCQL's row response (whether each row is keyed by table name, as shown, or returned flat) can vary by SDK version — print one raw response and adjust the `record = row[...]` line to match what you actually get back before trusting this in production.*

### 7.5 Context Injection, Citations & Fallback

```python
def handle_knowledge_base_mode(zc_app, session_uuid, question):
    top_chunks = top_matching_chunks(zc_app, session_uuid, question)

    if not top_chunks:
        # Corrected fallback: Catalyst has no built-in QuickML RAG endpoint to
        # fall back to. Fall back to the LLM with no document context, and
        # say so plainly rather than pretending it found something.
        system_prompt = (
            "No documents are available for this session. Answer from general "
            "knowledge and clearly state that no session document was found."
        )
        return call_llm(system_prompt, question)

    context_blocks = "\n\n".join(
        f"[Source: {c['file_name']}]\n{c['chunk_text']}" for c in top_chunks
    )
    system_prompt = (
        "Answer the question using ONLY the context blocks below. Every claim "
        "must cite its source filename in the form [Source: filename]. If the "
        "context doesn't contain the answer, say so explicitly.\n\n" + context_blocks
    )
    return call_llm(system_prompt, question)
```

---

## 8. The Flask/AppSail Chat Service (Wiring It Together)

A minimal endpoint that routes on a `mode` field the frontend sends, using the session's UUID as the isolation key for Knowledge Base Mode:

```python
from flask import Flask, request, g, jsonify
import zcatalyst_sdk, os

app = Flask(__name__)

@app.before_request
def before_request():
    g.zc_app = zcatalyst_sdk.initialize(req=request)

@app.route("/chat", methods=["POST"])
def chat():
    body = request.get_json(force=True)
    mode = body.get("mode", "database")            # "database" | "knowledge_base"
    question = body["message"]
    session_uuid = body.get("session_uuid")

    if mode == "knowledge_base":
        if not session_uuid:
            return jsonify({"error": "session_uuid is required in knowledge_base mode"}), 400
        answer = handle_knowledge_base_mode(g.zc_app, session_uuid, question)
    else:
        answer = handle_database_mode(g.zc_app, question)

    return jsonify({"answer": answer})

@app.route("/upload", methods=["POST"])
def upload():
    session_uuid = request.form["session_uuid"]
    f = request.files["file"]

    folder_id = os.environ["KB_FOLDER_ID"]
    uploaded = upload_document(g.zc_app, f, folder_id)

    # Re-read the same file for OCR (the stream was already consumed on upload)
    f.stream.seek(0)
    tmp_path = f"/tmp/{f.filename}"
    f.save(tmp_path)
    text = extract_text(g.zc_app, tmp_path)

    ingest_document(g.zc_app, session_uuid, uploaded["id"], f.filename, text)
    return jsonify({"status": "ingested", "file_id": uploaded["id"]})

listen_port = os.getenv("X_ZOHO_CATALYST_LISTEN_PORT", 9000)
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=listen_port)
```

---

## 9. Deploying with the Catalyst CLI

1. Install the CLI and log in:

```bash
npm install -g zcatalyst-cli
catalyst login
```

2. Initialize an AppSail resource in your project directory (choose Python as the runtime when prompted):

```bash
catalyst init
```

3. Add `zcatalyst-sdk`, `flask`, and `requests` to `requirements.txt` inside your AppSail app folder.

4. Serve locally to test against your real Catalyst project before deploying:

```bash
catalyst serve
```

5. Deploy:

```bash
catalyst deploy
```

---

## 10. Limits, Security & Production Notes

| Component | Development-environment limit |
|---|---|
| Data Store rows | 5,000 per table / 25,000 per project (no upper limit in production) |
| File Store | 1 GB per project (no upper limit in production) |
| File upload size | 100 MB max per file |
| Zia OCR file size | 20 MB max; formats: jpg, jpeg, png, tiff, bmp, pdf |

- Never let the LLM-generated ZCQL statement run with anything but read access in Database Mode — validate it starts with `SELECT` before executing.
- Your LLM API key belongs in environment variables / Catalyst's Connections or Cache component — never hard-coded or sent to the frontend.
- Zia OCR is stated as one-time processing with no retention or model training on your files — still avoid sending documents containing sensitive personal data (e.g. victim/witness details in FIR PDFs) through any third-party LLM call unless your provider's data-handling terms explicitly permit it.
- Session UUIDs should be server-generated and unguessable (e.g. `uuid4`), since they are the only thing enforcing document isolation between users in Knowledge Base Mode.
- Treat every number and endpoint shape from your LLM provider (glm-4.7-flash) in Sections 6.1, 6.3 and 7.5 as a template to verify against that provider's current API reference — it was not sourced from Catalyst's documentation and this guide cannot confirm it independently.

---

*Sources: this guide's Catalyst-specific code (SDK setup, ZCQL, Data Store, File Store, Zia OCR, AppSail, QuickML, Zia AI Assistant) was verified against docs.catalyst.zoho.com on 19 July 2026. The LLM-provider call shape (glm-4.7-flash) is a common convention, not a verified Catalyst or Zhipu/Z.ai source — confirm it against your provider's docs.*
