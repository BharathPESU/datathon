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

        # Domain keyword sets for smarter extraction
        _crime_types = {"murder","theft","robbery","assault","rape","kidnap","fraud","cyber","arson",
                        "dacoity","burglary","extortion","cheating","accident","drug","narcotic","abduction"}
        _district_map = {"bengaluru":"Bengaluru Urban","mysuru":"Mysuru","mangaluru":"Mangaluru",
                         "hubli":"Hubballi","hubballi":"Hubballi","belagavi":"Belagavi","davangere":"Davangere",
                         "tumakuru":"Tumakuru","shivamogga":"Shivamogga","kalaburagi":"Kalaburagi"}
        _stop = {"show","me","find","all","cases","in","with","a","an","the","of","about","for","from","on",
                 "involving","related","to","and","or","is","are","was","what","which","who","how","any",
                 "list","get","give","please","latest","recent","last","top"}

        def _extract_keywords(text: str) -> str:
            """Return space-joined meaningful keywords from a user query."""
            words = text.lower().split()
            meaningful = []
            for w in words:
                clean = w.strip("?.,'\"!")
                if clean in _stop or len(clean) < 3:
                    continue
                meaningful.append(clean)
            return " ".join(meaningful)

        if "offender" in qt or "repeat" in qt or "recidivism" in qt:
            fallback_response["intent"] = "repeat_offenders"
            min_c = 3 if "3" in qt else (2 if "2" in qt else 2)
            fallback_response["params"] = {"min_cases": min_c}
        elif "trend" in qt or "forecast" in qt or "hotspot" in qt or "density" in qt or "latest" in qt:
            fallback_response["intent"] = "trends"
            fallback_response["params"] = {"group_by": "month"}
        else:
            # search_cases: extract crime type + district keywords
            kw_parts = []
            for crime in _crime_types:
                if crime in qt:
                    kw_parts.append(crime)
            for alias, district in _district_map.items():
                if alias in qt:
                    kw_parts.append(alias)
            if not kw_parts:
                kw_parts = [_extract_keywords(query_text)]
            keyword = " ".join(kw_parts).strip() or _extract_keywords(query_text)
            fallback_response["intent"] = "search_cases"
            fallback_response["params"] = {"keyword": keyword}

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