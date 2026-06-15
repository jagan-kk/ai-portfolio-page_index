import os
import sys
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from main_rag import VectorlessRAG, page_client, groq_client

app = Flask(__name__)
CORS(app)

# Initialize engine
rag_engine = VectorlessRAG(page_client=page_client, groq_client=groq_client)
PDF_PATH = "jags.pdf"

print("INFO: Initializing and caching document tree index on server startup...")
try:
    DOCUMENT_TREE = rag_engine.process_document(PDF_PATH)
    print("INFO: Document tree index loaded successfully and ready for queries.")
except Exception as e:
    print(f"CRITICAL ERROR on startup loading document tree: {e}", file=sys.stderr)
    DOCUMENT_TREE = []

@app.route("/api/chat", methods=["POST"])
def chat():
    global DOCUMENT_TREE
    
    data = request.json
    user_query = data.get("query", "").strip()

    if not user_query:
        return jsonify({"error": "Query cannot be empty"}), 400

    if not DOCUMENT_TREE:
        return jsonify({"error": "Document index tree is unavailable."}), 500

    def generate():
        try:
            for chunk in rag_engine.query_pipeline_stream(user_query, DOCUMENT_TREE):
                yield chunk
        except Exception as e:
            yield f"\n\n[Error: {str(e)}]"

    return Response(
        stream_with_context(generate()),
        mimetype="text/plain",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, threaded=True)