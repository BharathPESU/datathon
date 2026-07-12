"""
Zoho Catalyst QuickML / AutoML Service
Handles two query modes:
  1. "database"  — NL Intent → ZCQL Query → Catalyst Datastore → QuickML GLM explanation
  2. "knowledge_base" — QuickML RAG endpoint (document QA over uploaded knowledge docs)
"""
import os
import json
import logging
import httpx
from typing import Optional
from app.core.config import settings
from app.db import catalyst_db as db
from app.services.nl2sql_service import NL2SQLService

logger = logging.getLogger(__name__)

# ─── Zoho Catalyst auth token helper ────────────────────────────────────────

def _get_catalyst_token(request=None) -> Optional[str]:
    """
    Extract the Zoho Catalyst user auth token from the incoming request context.
    In AppSail the token is injected as X-ZCATALYST-TOKEN or X-ZCSRF-TOKEN header.
    Falls back to env var for local dev.
    """
    if request:
        # zcatalyst_sdk injects the token on the request object via middleware
        if hasattr(request, "state") and hasattr(request.state, "catalyst_token"):
            return request.state.catalyst_token
        # Try headers (in AppSail, Zoho injects these)
        token = request.headers.get("X-ZCATALYST-TOKEN") or request.headers.get("X-Zcsrf-Token")
        if token:
            return token
            
    # Local dev fallback: try fetching live access token from SDK
    app = db.get_db_app()
    if app:
        try:
            return app.credential.token()
        except Exception:
            pass
            
    return os.environ.get("CATALYST_AUTH_TOKEN", "")


# ─── Database mode: NL → ZCQL → rows → LLM explanation ────────────────────

def _build_zcql_from_intent(intent: str, params: dict) -> str:
    """
    Build a ZCQL query string based on the NL2SQL classification intent.
    """
    table = "CaseMaster"
    limit = params.get("limit", 20)

    if intent == "repeat_offenders":
        # Fetch accused with case count ≥ min_cases
        min_cases = params.get("min_cases", 2)
        return f"SELECT * FROM Accused LIMIT {limit}"

    elif intent == "search_cases":
        keyword = params.get("keyword", "")
        if keyword:
            safe = keyword.replace("'", "''")
            return (
                f"SELECT * FROM {table} WHERE "
                f"brief_facts LIKE '%{safe}%' LIMIT {limit}"
            )
        return f"SELECT * FROM {table} LIMIT {limit}"

    elif intent == "trends":
        return f"SELECT * FROM {table} LIMIT {limit}"

    elif intent == "risk_profile":
        accused_id = params.get("accused_id")
        if accused_id:
            return f"SELECT * FROM Accused WHERE ROWID = {accused_id} LIMIT 1"
        return f"SELECT * FROM {table} LIMIT {limit}"

    else:
        # general_chat — return last N cases
        return f"SELECT * FROM {table} LIMIT {limit}"


def _execute_zcql(query: str, request=None, intent: str = "", params: dict = None) -> list[dict]:
    """
    Execute a ZCQL query via the Catalyst SDK (live) or smart in-memory fallback.
    The local fallback actually filters by intent/keyword so different queries give different results.
    """
    params = params or {}
    catalyst_app = db.get_db_app()
    if catalyst_app:
        try:
            zcql = catalyst_app.zcql()
            rows = zcql.execute_query(query)
            # SDK returns list of {TableName: {...}} dicts — flatten
            result = []
            for row in rows:
                for v in row.values():
                    result.append(v)
            logger.info(f"ZCQL returned {len(result)} rows")
            return result
        except Exception as e:
            logger.error(f"ZCQL error: {e}")
            raise

    # ── Smart local in-memory fallback ───────────────────────────────────
    # Actually filters/sorts rows based on intent so each query gets a unique answer
    all_cases = db.get_all_rows("CaseMaster")
    limit = params.get("limit", 20)

    if intent == "repeat_offenders":
        # Return accused with high case counts (proxy via in-memory accused table)
        all_accused = db.get_all_rows("Accused")
        # Count cases per accused name
        from collections import Counter
        name_counts: Counter = Counter()
        for a in all_accused:
            name = a.get("name") or a.get("accused_name") or ""
            if name:
                name_counts[name] += 1
        min_cases = params.get("min_cases", 2)
        repeat = [a for a in all_accused if name_counts.get(a.get("name") or a.get("accused_name") or "", 0) >= min_cases]
        return repeat[:limit] if repeat else all_accused[:limit]

    elif intent == "search_cases":
        keyword = (params.get("keyword") or "").lower().strip()
        if not keyword:
            return all_cases[:limit]
        # Score and filter by keyword relevance in brief_facts, crime_no, or district
        stop_words = {"show","me","find","all","cases","in","with","a","the","of","involving","for","from","on","get","list"}
        words = [w for w in keyword.split() if w not in stop_words and len(w) > 2]
        if not words:
            return all_cases[:limit]
        scored = []
        for case in all_cases:
            brief = (case.get("brief_facts") or "").lower()
            crime_no = (case.get("crime_no") or "").lower()
            score = sum(3 if w in crime_no else (2 if w in brief else 0) for w in words)
            if score > 0:
                scored.append((score, case))
        scored.sort(key=lambda x: x[0], reverse=True)
        filtered = [c for _, c in scored]
        return filtered[:limit] if filtered else all_cases[:limit]

    elif intent == "trends":
        # Sort by date descending to show latest cases
        def safe_date(c):
            return c.get("crime_registered_date") or c.get("CREATEDTIME") or ""
        return sorted(all_cases, key=safe_date, reverse=True)[:limit]

    elif intent == "risk_profile":
        accused_id = params.get("accused_id")
        if accused_id:
            accused = db.get_all_rows("Accused")
            match = [a for a in accused if str(a.get("ROWID","")) == str(accused_id)]
            return match[:1] if match else accused[:limit]
        return all_cases[:limit]

    else:
        # general_chat — return most recent cases
        return all_cases[:limit]


def _is_mock_mode() -> bool:
    """Return True when running locally without a real Zoho token."""
    if os.environ.get("QUICKML_MOCK", "").lower() in ("1", "true", "yes"):
        return True
    # If live Catalyst credentials are loaded, we are NOT in mock mode!
    app = db.get_db_app()
    if app:
        return False
    return not os.environ.get("CATALYST_AUTH_TOKEN", "")


def _mock_glm_response(prompt: str, rows: list, intent: str = "", sql: str = "") -> str:
    """Generate a query-specific mock response for dev/local testing."""
    count = len(rows)
    query_lower = prompt.lower()

    if count == 0:
        return (
            f"🔍 No records found for your query: *\"{prompt}\"*\n\n"
            "Try a different search term or check that the local database has been seeded."
        )

    # Build a specific answer based on the intent
    lines = []

    if intent == "repeat_offenders":
        lines.append(f"🔁 **Repeat Offender Analysis** — Found **{count} accused** with multiple cases on record:\n")
        for row in rows[:8]:
            name = row.get("name") or row.get("accused_name") or row.get("emp_name") or f"ID #{row.get('ROWID','?')}"
            lines.append(f"• **{name}** — {row.get('designation_id','') or row.get('unit_id','') or ''}")

    elif intent == "trends":
        lines.append(f"📈 **Crime Trend Analysis** — Latest **{count} cases** ordered by registration date:\n")
        for row in rows[:8]:
            cn = row.get("crime_no", "?")
            dt = row.get("crime_registered_date", "")
            brief = str(row.get("brief_facts", ""))[:100]
            lines.append(f"• **{cn}** ({dt}): {brief}")

    elif intent == "risk_profile":
        lines.append(f"🚨 **Risk Profile** — Found **{count} record(s)**:\n")
        for row in rows[:3]:
            lines.append(f"• {json.dumps({k: v for k, v in row.items() if k not in ('CREATORID',)}, default=str, indent=2)}")

    else:
        # search_cases — show contextually relevant results
        lines.append(f"🔎 **Search Results** for \"{prompt}\" — **{count} matching cases**:\n")
        for row in rows[:6]:
            cn = row.get("crime_no", "?")
            brief = str(row.get("brief_facts", ""))[:130]
            district = row.get("district_id", "")
            lines.append(f"• **{cn}**{f' [{district}]' if district else ''}: {brief}")

    lines.append(f"\n🖥️ *ZCQL executed: `{sql}`*")
    lines.append("> ⚠️ *LOCAL MOCK — Set `CATALYST_AUTH_TOKEN` in `.env` for real QuickML AutoML responses.*")
    return "\n".join(lines)


def _mock_rag_response(query: str) -> dict:
    """Generate a realistic mock RAG response for dev testing."""
    return {
        "answer": (
            f"📚 **[LOCAL MOCK — QuickML RAG]** Knowledge Base answer for: *\"{query}\"*\n\n"
            "Based on the uploaded Karnataka Police procedural documents, here is a summary:\n\n"
            "• FIR registration must be done at the concerned police station within whose jurisdiction the offence occurred.\n"
            "• The complainant can approach any police station if the jurisdictional station refuses to register the FIR.\n"
            "• Section 154 CrPC mandates that every cognizable offence must be registered as an FIR.\n\n"
            "> ⚠️ *This is a local mock response. Set `CATALYST_AUTH_TOKEN` in your `.env` to get real RAG answers from your uploaded documents.*"
        ),
        "sources": [
            {"title": "Karnataka Police Manual", "content": "FIR registration procedures under CrPC Section 154"},
            {"title": "CrPC Reference", "content": "Cognizable offence definitions and jurisdictional rules"},
        ]
    }


def _call_quickml_glm(prompt: str, system_prompt: str, request=None, rows: list = None, intent: str = "", sql: str = "", model: str = None) -> str:
    """
    Call the Zoho Catalyst QuickML GLM Chat API.
    Falls back to a structured local mock when QUICKML_MOCK=true or no auth token is set.
    """
    # ── Local mock mode ──────────────────────────────────────────────────────
    if _is_mock_mode():
        logger.info("QuickML: running in LOCAL MOCK mode (set CATALYST_AUTH_TOKEN to use live API)")
        return _mock_glm_response(prompt, rows or [], intent=intent, sql=sql)

    payload = {
        "model": model or settings.QUICKML_LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": settings.QUICKML_MAX_TOKENS,
        "temperature": 0.2,
        "stream": False
    }

    # Try routing through SDK requester first (natively adds project headers/signing)
    app = db.get_db_app()
    if app:
        try:
            requester = app.filestore()._requester
            resp = requester.request(
                method="POST",
                path="/glm/chat",
                json=payload,
                user="admin",
                catalyst_service="quickml"
            )
            data = resp.response_json
            if data and "choices" in data:
                return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"SDK QuickML GLM call failed: {e}. Trying manual HTTP fallback.")

    token = _get_catalyst_token(request)
    org_id = settings.QUICKML_ORG_ID
    url = settings.QUICKML_LLM_ENDPOINT

    headers = {
        "Content-Type": "application/json",
        "CATALYST-ORG": org_id,
    }
    if token:
        headers["Authorization"] = f"Zoho-oauthtoken {token}"

    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"QuickML GLM call failed: {e}")
        raise


def _get_document_rag_context(query: str) -> tuple[str, list[dict]]:
    """
    Scans the uploads directory, reads documents, splits them into chunks,
    ranks them by keyword overlap, and returns the top chunks as a context string
    along with a sources list.
    """
    from app.services.filestore_service import UPLOAD_DIR
    import re

    if not os.path.exists(UPLOAD_DIR):
        return "", []

    query_words = [w.lower() for w in re.findall(r"\w+", query) if len(w) > 2]
    if not query_words:
        query_words = [query.lower()]

    chunks = []
    for filename in os.listdir(UPLOAD_DIR):
        file_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.isfile(file_path):
            continue

        text = ""
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()[:50000] # read up to 50k chars
        except Exception as e:
            logger.warning(f"Could not read file {filename} for RAG: {e}")
            continue

        if not text.strip():
            continue

        # Split into paragraphs or chunks of ~500 chars
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        for p in paragraphs:
            # If paragraph is very long, split by sentences
            if len(p) > 1000:
                sentences = re.split(r"(?<=[.!?])\s+", p)
                current_chunk = ""
                for s in sentences:
                    if len(current_chunk) + len(s) < 800:
                        current_chunk += " " + s
                    else:
                        if current_chunk.strip():
                            chunks.append((filename, current_chunk.strip()))
                        current_chunk = s
                if current_chunk.strip():
                    chunks.append((filename, current_chunk.strip()))
            else:
                chunks.append((filename, p))

    if not chunks:
        return "", []

    # Score chunks based on word overlap
    scored_chunks = []
    for filename, chunk in chunks:
        score = 0
        chunk_lower = chunk.lower()
        for word in query_words:
            score += chunk_lower.count(word)
        if score > 0:
            scored_chunks.append((score, filename, chunk))

    # Sort by score descending
    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    
    # If no matches, take the first few chunks of the first document as default context
    if not scored_chunks:
        scored_chunks = [(0, filename, chunk) for filename, chunk in chunks[:5]]

    top_chunks = scored_chunks[:5]
    context_parts = []
    sources = []
    seen_sources = set()

    for idx, (score, filename, chunk) in enumerate(top_chunks):
        context_parts.append(f"[Source: {filename}]\n{chunk}")
        if filename not in seen_sources:
            seen_sources.add(filename)
            sources.append({"title": filename, "content": chunk[:150] + "..."})

    return "\n\n".join(context_parts), sources


# ─── Knowledge Base mode: QuickML RAG ───────────────────────────────────────

def _call_quickml_rag(query: str, request=None) -> dict:
    """
    Call the Zoho Catalyst QuickML RAG endpoint for knowledge base QA.
    Returns {"answer": str, "sources": list}
    """
    # ── Try to retrieve matching context from newly uploaded documents first ─
    rag_context, sources = _get_document_rag_context(query)
    
    if rag_context:
        logger.info("Custom RAG: Found uploaded documents context. Querying GLM...")
        system_prompt = (
            "You are an expert crime analytics AI assistant for the Karnataka Police department. "
            "Answer the user's question based strictly on the retrieved document context below. "
            "Cite the source filenames when presenting facts. Keep the tone helpful, professional, and clear."
        )
        prompt = f"Retrieved Document Context:\n{rag_context}\n\nUser Question: {query}"
        answer = _call_quickml_glm(prompt, system_prompt, request=request)
        return {"answer": answer, "sources": sources}

    # ── Fallback to default configured Catalyst RAG API if no local documents ─
    if _is_mock_mode():
        logger.info("QuickML RAG: running in LOCAL MOCK mode")
        return _mock_rag_response(query)

    token = _get_catalyst_token(request)
    org_id = settings.QUICKML_ORG_ID
    url = settings.QUICKML_RAG_ENDPOINT

    headers = {
        "Content-Type": "application/json",
        "CATALYST-ORG": org_id,
    }
    if token:
        headers["Authorization"] = f"Zoho-oauthtoken {token}"

    payload = {
        "query": query,
        "document_ids": [settings.QUICKML_RAG_DOCUMENTS],
        "max_tokens": settings.QUICKML_MAX_TOKENS,
        "model": settings.QUICKML_LLM_MODEL,
    }

    # Try routing through SDK requester first
    app = db.get_db_app()
    if app:
        try:
            requester = app.filestore()._requester
            resp = requester.request(
                method="POST",
                path="/rag/answer",
                json=payload,
                user="admin",
                catalyst_service="quickml"
            )
            data = resp.response_json
            if data:
                answer = (
                    data.get("answer")
                    or data.get("response")
                    or data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    or "No answer returned from knowledge base."
                )
                sources = data.get("sources") or data.get("references") or []
                return {"answer": answer, "sources": sources}
        except Exception as e:
            logger.error(f"SDK QuickML RAG call failed: {e}. Trying manual HTTP fallback.")

    token = _get_catalyst_token(request)
    org_id = settings.QUICKML_ORG_ID
    url = settings.QUICKML_RAG_ENDPOINT

    headers = {
        "Content-Type": "application/json",
        "CATALYST-ORG": org_id,
    }
    if token:
        headers["Authorization"] = f"Zoho-oauthtoken {token}"

    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            answer = (
                data.get("answer")
                or data.get("response")
                or data.get("choices", [{}])[0].get("message", {}).get("content", "")
                or "No answer returned from knowledge base."
            )
            sources = data.get("sources") or data.get("references") or []
            return {"answer": answer, "sources": sources}
    except Exception as e:
        logger.error(f"QuickML RAG call failed: {e}")
        raise


# ─── Public API ──────────────────────────────────────────────────────────────

class QuickMLService:

    @staticmethod
    def query_database(user_query: str, request=None) -> dict:
        """
        Two-Prompt Database Pipeline:
        1. Prompt 1: User Query + Datastore Schema → Choose Tables and Columns
        2. Generate & Execute ZCQL based on selected tables and columns.
        3. Prompt 2: User Query + Chosen Tables/Columns + Retrieved Database Rows → Answer and Summary (using glm-4.7-flash).
        """
        # Load database schema
        schema_path = "/home/bharath/Desktop/projects/datathon/catalyst_datastore_schema.json"
        schema_json = "{}"
        try:
            if os.path.exists(schema_path):
                with open(schema_path, "r", encoding="utf-8") as f:
                    schema_data = json.load(f)
                schema_json = json.dumps(schema_data, indent=2)
        except Exception as e:
            logger.error(f"Failed to read datastore schema: {e}")

        # ── Prompt 1: Select Tables & Columns ──
        prompt_1_system = f"""You are a Database Schema Selector AI.
Analyze the user's natural language question and the datastore schema below. Identify the minimum set of tables and columns needed to fetch the required information to answer the question.

Datastore Schema:
{schema_json}

You MUST return ONLY a valid JSON object matching this structure:
{{
    "tables": ["TableName1", "TableName2"],
    "columns": ["TableName1.column_name1", "TableName2.column_name2"]
}}
Do NOT include markdown, explanations, or code block markers (like ```json). Return raw JSON only."""

        prompt_1_user = f"Question: {user_query}"
        
        selected_tables_columns = {"tables": [], "columns": []}
        intent = "search_cases"
        try:
            p1_response = _call_quickml_glm(prompt_1_user, prompt_1_system, request)
            # Strip markdown fences if present
            if "```json" in p1_response:
                p1_response = p1_response.split("```json")[-1].split("```")[0].strip()
            elif "```" in p1_response:
                p1_response = p1_response.split("```")[-1].split("```")[0].strip()
            selected_tables_columns = json.loads(p1_response)
            logger.info(f"Prompt 1 selected tables & columns: {selected_tables_columns}")
        except Exception as e:
            logger.error(f"Prompt 1 (schema selection) failed: {e}")

        # ── Step 2: Generate ZCQL Query based on Selected Tables and Columns ──
        tables = selected_tables_columns.get("tables", [])
        columns = selected_tables_columns.get("columns", [])
        
        zcql = ""
        rows = []
        
        if tables and columns:
            prompt_zcql_system = f"""You are a ZCQL (Zoho Catalyst Query Language) generator.
Generate a valid SELECT query that joins and fetches the selected tables and columns to answer the user's question.

Selected Tables: {json.dumps(tables)}
Selected Columns: {json.dumps(columns)}

Rules for ZCQL:
- Select only columns from the list.
- Use explicit JOINs on primary/foreign keys (e.g., CaseMaster.district_id = District.ROWID).
- Use proper aliases or fully qualified names.
- Always include the primary key ROWID of the main tables (e.g., CaseMaster.ROWID, Accused.ROWID).
- Limit the results to 50 rows (LIMIT 50).
- Return ONLY the ZCQL statement as a single line. Do not include markdown code block syntax."""

            prompt_zcql_user = f"User Question: {user_query}"
            try:
                p_zcql_response = _call_quickml_glm(prompt_zcql_user, prompt_zcql_system, request)
                if "```sql" in p_zcql_response:
                    p_zcql_response = p_zcql_response.split("```sql")[-1].split("```")[0].strip()
                elif "```" in p_zcql_response:
                    p_zcql_response = p_zcql_response.split("```")[-1].split("```")[0].strip()
                zcql = p_zcql_response.strip().replace("\n", " ")
                logger.info(f"Generated ZCQL: {zcql}")
                
                # Execute ZCQL
                rows = _execute_zcql(zcql, request, intent=intent)
            except Exception as e:
                logger.error(f"Generated ZCQL execution failed: {e}. Falling back to standard pipeline.")
                zcql = ""

        # Fallback to standard pipeline if ZCQL was not generated or failed
        if not zcql or not rows:
            classification = NL2SQLService.classify_query(user_query)
            intent = classification.get("intent", "general_chat")
            params = classification.get("params", {})
            zcql = _build_zcql_from_intent(intent, params)
            logger.info(f"Fallback executing ZCQL: {zcql}")
            try:
                rows = _execute_zcql(zcql, request, intent=intent, params=params)
            except Exception as e:
                return {
                    "content": f"Database query failed: {str(e)}",
                    "retrieved_refs": [],
                    "intent": intent,
                    "sql": zcql,
                }

        # ── Prompt 2: Answering and Summarization (using glm-4.7-flash) ──
        context_rows = rows[:15]  # cap at 15 to stay within token budget
        
        prompt_2_system = f"""You are an expert crime analytics AI assistant for the Karnataka Police department.
Answer the user's question factually based ONLY on the retrieved database data below.

Selected Tables & Columns:
{json.dumps(selected_tables_columns, indent=2)}

Retrieved Database Rows (with exact Row IDs and Data):
{json.dumps(context_rows, default=str, indent=2)}

Instructions:
1. Provide a detailed answer containing the exact rows, IDs (ROWID), and data values retrieved.
2. Provide a clear, concise summary of the findings at the end.
3. Cite case numbers (crime_no) or accused names wherever relevant.
4. Format your response in clean, readable prose with bullet points where helpful.
5. Do not make up any data or IDs not present in the retrieved rows.
"""

        prompt_2_user = f"Question: {user_query}"
        
        try:
            answer = _call_quickml_glm(prompt_2_user, prompt_2_system, request, rows=context_rows, intent=intent, sql=zcql, model="glm-4.7-flash")
        except Exception as e:
            logger.error(f"Prompt 2 failed: {e}. Using fallback generator.")
            if rows:
                answer = f"Based on the database query, I found {len(rows)} records.\n\n"
                for row in rows[:5]:
                    crime_no = row.get("crime_no", row.get("ROWID", "?"))
                    brief = str(row.get("brief_facts", row.get("emp_name", "")))[:120]
                    answer += f"• Row ID {row.get('ROWID')}: {crime_no} - {brief}\n"
            else:
                answer = "No records were found matching your query in the database."

        # Build citation refs from case rows
        refs = []
        for row in context_rows:
            if "crime_no" in row:
                refs.append({
                    "case_master_id": row.get("ROWID", 0),
                    "crime_no": row.get("crime_no"),
                    "snippet": str(row.get("brief_facts", ""))[:200],
                })

        return {
            "content": answer,
            "retrieved_refs": refs,
            "intent": intent,
            "sql": zcql,
        }

    @staticmethod
    def query_knowledge_base(user_query: str, request=None) -> dict:
        """
        Knowledge Base mode: calls the Catalyst QuickML RAG endpoint.
        Returns {"content": str, "retrieved_refs": list, "intent": "knowledge_base"}
        """
        try:
            result = _call_quickml_rag(user_query, request)
            sources = result.get("sources", [])
            # Normalise sources into our DocRef shape
            refs = []
            for src in sources:
                refs.append({
                    "case_master_id": 0,
                    "crime_no": src.get("title") or src.get("document_id") or "KB Source",
                    "snippet": src.get("content") or src.get("text") or "",
                })
            return {
                "content": result["answer"],
                "retrieved_refs": refs,
                "intent": "knowledge_base",
            }
        except Exception as e:
            logger.error(f"Knowledge base query failed: {e}")
            return {
                "content": (
                    "Unable to reach the Knowledge Base service. "
                    "Please ensure the Catalyst QuickML RAG connector is configured "
                    f"and try again. (Error: {str(e)})"
                ),
                "retrieved_refs": [],
                "intent": "knowledge_base",
            }
