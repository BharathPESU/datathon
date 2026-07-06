import json
import logging
from app.core.nim_client import chat_completion
from app.core.config import settings

logger = logging.getLogger(__name__)

class NL2SQLService:
    @staticmethod
    def classify_query(query_text: str) -> dict:
        """
        Classifies user query intent and extracts parameters using NVIDIA NIM.
        Falls back to local keyword parsing if NIM is offline/unauthenticated.
        """
        # 1. Fallback Offline Classification (Keyword-based)
        fallback_response = {
            "intent": "general_chat",
            "params": {}
        }
        
        qt = query_text.lower()
        if "offender" in qt or "repeat" in qt or "recidivism" in qt:
            fallback_response["intent"] = "repeat_offenders"
            fallback_response["params"] = {"min_cases": 2}
        elif "trend" in qt or "forecast" in qt or "hotspot" in qt or "density" in qt:
            fallback_response["intent"] = "trends"
            fallback_response["params"] = {"group_by": "month"}
        elif "district" in qt or "mysuru" in qt or "bengaluru" in qt:
            fallback_response["intent"] = "search_cases"
            fallback_response["params"] = {"keyword": query_text}
        elif "search" in qt or "find" in qt or "case" in qt or "crime" in qt:
            fallback_response["intent"] = "search_cases"
            # Simple keyword extraction
            words = query_text.split()
            if len(words) > 1:
                fallback_response["params"] = {"keyword": words[-1]}
                
        if not settings.NVIDIA_API_KEY or settings.NVIDIA_API_KEY == "dummy-key":
            logger.info("Using local keyword fallback for query intent classification")
            return fallback_response

        # 2. NVIDIA NIM Enhanced Classification
        system_prompt = """
        You are a Crime Database Assistant. Classify user intent and extract query parameters.
        Respond ONLY with a valid JSON object matching this schema:
        {
            "intent": "general_chat" | "search_cases" | "repeat_offenders" | "trends" | "risk_profile",
            "params": {
                "keyword": string (optional, search terms for case facts),
                "district_name": string (optional, e.g. "Bengaluru Urban"),
                "min_cases": integer (optional, for repeat offenders),
                "crime_type": string (optional, e.g. "Murder", "Theft"),
                "accused_id": integer (optional, for risk profile lookups)
            }
        }
        Do not include markdown or explanations. Return JSON only.
        """
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Classify this query: {query_text}"}
        ]
        
        try:
            response_text = chat_completion(messages, temperature=0.1)
            # Strip markdown code blocks if the LLM output contains them
            if "```json" in response_text:
                response_text = response_text.split("```json")[-1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[-1].split("```")[0].strip()
            
            parsed = json.loads(response_text)
            logger.info(f"NIM classified query: {parsed}")
            return parsed
        except Exception as e:
            logger.error(f"NIM classification failed: {e}. Falling back to keywords.")
            return fallback_response