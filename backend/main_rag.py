import os
import json
import time
import re
import sys
from typing import List, Dict, Any
from dotenv import load_dotenv
from pageindex import PageIndexClient
from groq import Groq

# Load environment keys
load_dotenv()

PAGE_INDEX_KEY = os.getenv("PAGE_INDEX_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not PAGE_INDEX_KEY or not GROQ_API_KEY:
    print("CRITICAL ERROR: Missing required environment variables.", file=sys.stderr)
    sys.exit(1)

# Initialize clients
page_client = PageIndexClient(api_key=PAGE_INDEX_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)


class VectorlessRAG:
    def __init__(self, page_client: PageIndexClient, groq_client: Groq, model: str = "llama-3.3-70b-versatile"):
        self.page_client = page_client
        self.groq_client = groq_client
        self.model = model

    def process_document(self, pdf_path: str, poll_interval: int = 5) -> List[Dict[str, Any]]:
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"Target PDF file not found at: {pdf_path}")
            
        print(f"INFO: Uploading PDF: {pdf_path}")
        results = self.page_client.submit_document(pdf_path)
        doc_id = results.get('doc_id')
        if not doc_id:
            raise ValueError("Failed to retrieve doc_id from document submission.")
            
        print(f"INFO: Document submitted. Assigned ID: {doc_id}")
        print("INFO: Processing document tree index...")

        while True:
            status_result = self.page_client.get_document(doc_id)
            status = status_result.get('status')
            print(f"STATUS: {status}")

            if status == 'completed':
                print("INFO: Document processing completed successfully.")
                break
            elif status == 'failed':
                raise RuntimeError("Document parsing failed on the PageIndex server.")

            time.sleep(poll_interval)

        tree_result = self.page_client.get_tree(doc_id, node_summary=True)
        return tree_result.get('result', [])

    def _compress_tree(self, nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        out = []
        for n in nodes:
            entry = {
                "node_id": n["node_id"],
                "title": n["title"],
                "page": n.get("page_index", "?"),
                "summary": n.get("text", "")[:200]
            }
            if n.get("nodes"):
                entry["children"] = self._compress_tree(n["nodes"])
            out.append(entry)
        return out

    def _find_nodes_by_id(self, node_ids: List[str], nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        found = []
        for node in nodes:
            if node["node_id"] in node_ids:
                found.append(node)
            if node.get("nodes"):
                found.extend(self._find_nodes_by_id(node_ids, node["nodes"]))
        return found

    def llm_tree_search(self, query: str, tree: List[Dict[str, Any]]) -> Dict[str, Any]:
        compressed_tree = self._compress_tree(tree)
        
        prompt = f"""You are an information retrieval agent. A user will provide a query and a document tree. The document tree is a hierarchical representation of a document, where each node has a title, page number, and a text snippet. Your task is to reason over the document tree and identify which nodes are relevant to the user's query.

Query: {query}
Document Tree (in JSON format): 
{json.dumps(compressed_tree, indent=2)}

Reply strictly in this json format:
{{
  "thinking": "your reasoning process here",
  "node_list": ["list", "of", "relevant", "node_ids"]
}}"""

        try:
            response = self.groq_client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            
            # FIXED WITH INDEX
            raw_content = response.choices[0].message.content.strip()
            clean_json = re.sub(r'^```json\s*|\s*```$', '', raw_content, flags=re.MULTILINE).strip()
            return json.loads(clean_json)
            
        except Exception as e:
            print(f"ERROR: Tree contextual search encountered an issue: {e}")
            return {"thinking": "Error raised during API processing block.", "node_list": []}
# ... keep the rest of your main_rag.py file the same ...

    def generate_answer(self, query: str, relevant_nodes: List[str], tree: List[Dict[str, Any]]):
        relevant_tree_nodes = self._find_nodes_by_id(relevant_nodes, tree)
        
        if not relevant_tree_nodes:
            relevant_tree_nodes = self._compress_tree(tree)[:3]

        prompt = f"""You are an information synthesis agent. Answer the query concisely using the document nodes provided.

Format your answer with proper Markdown:
- ## headings for each major section
- **bold** for important terms and project names
- Proper line breaks between sections and items
- Numbered lists or bullet points for multi-item answers

Query: {query}

Document Context:
{json.dumps(relevant_tree_nodes, indent=2)}"""

        try:
            response = self.groq_client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                stream=True 
            )
            
            for chunk in response:
                # Defensive check: Ensure chunk has choices and we can access the content
                if hasattr(chunk, 'choices') and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta and hasattr(delta, 'content') and delta.content:
                        yield delta.content
                    
        except Exception as e:
            # Return the error in the stream so the frontend displays it
            yield f"\n\n[Error in synthesis stream: {str(e)}]"

    # Add this new method to execute the streaming pipeline
    def query_pipeline_stream(self, query: str, tree: List[Dict[str, Any]]):
        search_result = self.llm_tree_search(query, tree)
        relevant_nodes = search_result.get("node_list", [])
        return self.generate_answer(query, relevant_nodes, tree)
    