import os
import sys
import traceback

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from main import app
except Exception as e:
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    app = FastAPI(title="Diagnostic Fallback")
    error_trace = traceback.format_exc()
    @app.api_route("/{rest_of_path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
    def debug_error(rest_of_path: str = ""):
        return JSONResponse(status_code=500, content={"error": str(e), "traceback": error_trace})
