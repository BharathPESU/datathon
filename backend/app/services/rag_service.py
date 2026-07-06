import logging
from app.db import catalyst_db as db
from app.core.nim_client import chat_completion
from app.core.config import settings

logger = logging.getLogger(__name__)

class RAGService:
    @staticmethod
    def retrieve_cases(query_text: str, limit: int = 3) -> list[dict]:
        """
        Retrieves top relevant cases matching query_text using a simple keyword overlap
        over the case brief facts.
        """
        all_cases = db.get_all_rows("CaseMaster")
        query_words = set(query_text.lower().split())
        
        # Simple stop words to filter out
        stop_words = {"show", "me", "find", "all", "cases", "in", "with", "a", "the", "of", "about", "for", "from", "on"}
        query_words = query_words - stop_words
        
        if not query_words:
            # Fallback to latest cases if no keywords
            return all_cases[:limit]
            
        scored_cases = []
        for case in all_cases:
            brief = (case.get("brief_facts") or "").lower()
            crime_no = (case.get("crime_no") or "").lower()
            
            score = 0
            # Match keywords in brief facts
            for word in query_words:
                if word in brief:
                    score += 2
                if word in crime_no:
                    score += 5
                    
            if score > 0:
                scored_cases.append((score, case))
                
        # Sort by score descending
        scored_cases.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored_cases[:limit]]

    @staticmethod
    def answer_question(query_text: str, retrieved_cases: list[dict]) -> dict:
        """
        Generates an answer using NVIDIA NIM, providing the retrieved cases as context.
        Enforces citation constraints (e.g. referencing cases by crime_no).
        """
        # Formulate prompt context
        context_str = ""
        for idx, case in enumerate(retrieved_cases, 1):
            context_str += f"[{idx}] Crime No: {case.get('crime_no')}\n"
            context_str += f"Brief Facts: {case.get('brief_facts')}\n\n"
            
        system_prompt = f"""
        You are a Crime Analytics Platform Assistant. Answer the user question based on the provided context cases.
        Always cite the relevant cases using their Crime No.
        Context cases:
        {context_str}
        """
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query_text}
        ]
        
        if not settings.NVIDIA_API_KEY or settings.NVIDIA_API_KEY == "dummy-key":
            # Local fallback response
            if retrieved_cases:
                citations = ", ".join([c.get("crime_no") for c in retrieved_cases])
                content = f"Based on the local database search, I found matching cases ({citations}). Here is what I can tell you:\n\n"
                for case in retrieved_cases:
                    content += f"- Crime No {case.get('crime_no')}: {case.get('brief_facts')[:120]}...\n"
                return {
                    "content": content,
                    "retrieved_refs": [
                        {
                            "case_master_id": case["ROWID"],
                            "crime_no": case["crime_no"],
                            "snippet": case["brief_facts"][:200]
                        }
                        for case in retrieved_cases
                    ]
                }
            else:
                return {
                    "content": "No relevant cases were found in the database matching your query.",
                    "retrieved_refs": []
                }

        try:
            answer = chat_completion(messages, temperature=0.5)
            refs = [
                {
                    "case_master_id": case["ROWID"],
                    "crime_no": case["crime_no"],
                    "snippet": case["brief_facts"][:200]
                }
                for case in retrieved_cases
            ]
            return {
                "content": answer,
                "retrieved_refs": refs
            }
        except Exception as e:
            logger.error(f"NIM RAG answer generation failed: {e}")
            return {
                "content": "An error occurred generating response. Please try again.",
                "retrieved_refs": []
            }