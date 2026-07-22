import json
import logging
import os
import re
from openai import OpenAI
from app.core.config import settings
from app.db import catalyst_db as db

logger = logging.getLogger(__name__)

class NL2SQLService:
    def __init__(self):
        self.schema_path = "/home/bharath/Desktop/projects/datathon/catalyst_datastore_schema.json"
        
        # Initialize OpenAI client for NVIDIA NIM
        api_key = settings.NVIDIA_API_KEY
        if not api_key:
            api_key = "dummy-key"
        import httpx
        http_client = httpx.Client()
        self.client = OpenAI(
            base_url=settings.NIM_BASE_URL,
            api_key=api_key,
            http_client=http_client
        )
        self.model = settings.NIM_MODEL
        
    def _get_schema(self) -> str:
        """Schema Provider"""
        try:
            if os.path.exists(self.schema_path):
                with open(self.schema_path, "r", encoding="utf-8") as f:
                    schema_data = json.load(f)
                return json.dumps(schema_data, indent=2)
        except Exception as e:
            logger.error(f"Failed to read datastore schema: {e}")
        return "{}"

    def _generate_query(self, user_query: str, schema: str) -> str:
        """AI Query Generator"""
        system_prompt = f"""You are a ZCQL (Zoho Catalyst Query Language) generator.
Your task is to convert the user's natural language question into a valid ZCQL SELECT query based on the following schema.

Datastore Schema:
{schema}

Rules for ZCQL:
1. Output ONLY the raw ZCQL query. Do not include markdown formatting (like ```sql), markdown blocks, or any explanations.
2. ZCQL does not support '*' in SELECT if you are joining. Use specific columns or TableName.ColumnName.
3. Use explicit JOINs or WHERE conditions to link foreign keys.
4. Always LIMIT the results to a maximum of 50.
5. Do not use any DML statements (INSERT, UPDATE, DELETE). Only SELECT is allowed.
"""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_query}
        ]
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.1,
                max_tokens=500,
                stream=False
            )
            raw_query = response.choices[0].message.content.strip()
            
            # Clean up potential markdown if the model disobeys
            if "```sql" in raw_query:
                raw_query = raw_query.split("```sql")[-1].split("```")[0].strip()
            elif "```" in raw_query:
                raw_query = raw_query.split("```")[-1].split("```")[0].strip()
                
            return raw_query.replace("\n", " ").strip()
        except Exception as e:
            logger.error(f"AI Query Generation failed: {e}")
            raise Exception(f"Failed to generate query: {e}")

    def _validate_query(self, query: str) -> str:
        """Query Validation Layer"""
        query_lower = query.lower()
        
        # Block dangerous SQL
        dangerous_keywords = ["insert", "update", "delete", "drop", "alter", "truncate", "create", "grant", "revoke"]
        for keyword in dangerous_keywords:
            if re.search(rf"\b{keyword}\b", query_lower):
                raise Exception(f"Dangerous SQL detected: {keyword} operations are not allowed.")
                
        # Basic syntax check
        if not query_lower.startswith("select"):
            raise Exception("Invalid query: Only SELECT statements are allowed.")
            
        return query

    def _execute_query(self, query: str) -> list[dict]:
        """Execute Query on Zoho Catalyst Datastore"""
        try:
            # We use our existing db wrapper to execute the ZCQL query
            rows = db.execute_query(query)
            
            # Flatten Catalyst SDK response format if needed
            flattened = []
            for row in rows:
                flat_row = {}
                for table_name, table_data in row.items():
                    if isinstance(table_data, dict):
                        for k, v in table_data.items():
                            flat_row[f"{table_name}.{k}"] = v
                    else:
                        flat_row[table_name] = table_data
                flattened.append(flat_row)
                
            return flattened
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            raise Exception(f"Database execution failed: {e}")

    def _analyze_results(self, user_query: str, query: str, rows: list[dict]) -> dict:
        """AI Result Analyzer & Summarizer"""
        system_prompt = f"""You are a Crime Analytics AI Assistant.
You have been provided with the user's original question, the ZCQL query executed, and the raw JSON results from the database.

Your task is to analyze the results and provide a comprehensive Final Response in JSON format matching this schema:
{{
    "summary": "Natural language summary of the findings.",
    "insights": ["Insight 1", "Insight 2"],
    "statistics": {{"Metric Name": "Value"}},
    "zcql": "The executed query",
    "data": [{{ ... the raw rows ... }}]
}}

Raw JSON Results (first 20 rows):
{json.dumps(rows[:20], default=str, indent=2)}

Original ZCQL Query:
{query}

Make sure to format your output ONLY as a valid JSON object without any markdown wrappers.
"""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_query}
        ]
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.2,
                top_p=0.7,
                max_tokens=1024,
                stream=False
            )
            raw_response = response.choices[0].message.content.strip()
            
            if "```json" in raw_response:
                raw_response = raw_response.split("```json")[-1].split("```")[0].strip()
            elif "```" in raw_response:
                raw_response = raw_response.split("```")[-1].split("```")[0].strip()
                
            analyzed = json.loads(raw_response)
            # Ensure ZCQL and data are preserved
            analyzed["zcql"] = query
            analyzed["data"] = rows
            return analyzed
        except Exception as e:
            logger.error(f"AI Result Analysis failed: {e}")
            # Fallback response
            return {
                "summary": "Retrieved data successfully but failed to generate AI summary.",
                "insights": [],
                "statistics": {"Total Rows": len(rows)},
                "zcql": query,
                "data": rows
            }

    def run_pipeline(self, user_query: str) -> dict:
        """Runs the full AI analytics pipeline"""
        try:
            # 1. Schema Provider
            schema = self._get_schema()
            
            # 2. AI Query Generator
            raw_query = self._generate_query(user_query, schema)
            
            # 3. Query Validation Layer
            validated_query = self._validate_query(raw_query)
            
            # 4. Execute Query
            rows = self._execute_query(validated_query)
            
            # 5. AI Result Analyzer & Summarizer
            final_response = self._analyze_results(user_query, validated_query, rows)
            
            return final_response
            
        except Exception as e:
            logger.error(f"Pipeline error: {e}")
            return {
                "summary": f"An error occurred while processing your request: {str(e)}",
                "insights": [],
                "statistics": {},
                "zcql": None,
                "data": []
            }

# Singleton instance
nl2sql_pipeline = NL2SQLService()