import io
import os
import base64
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

try:
    from backend.inference import predict_breed, CLASS_NAMES, BREED_INFO, MODEL_PATH, _model
except ImportError:
    from inference import predict_breed, CLASS_NAMES, BREED_INFO, MODEL_PATH, _model

app = FastAPI(
    title="Dog Breed Classification",
    description="High-performance deep learning API for 120-class dog breed classification using MobileNetV2.",
    version="1.0.0"
)

# Enable CORS for frontend integration (Vite dev server, Vercel, localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Base64Payload(BaseModel):
    image: str

# Path to built React frontend
DIST_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if not os.path.exists(DIST_DIR):
    DIST_DIR = os.path.join(os.path.dirname(__file__), "dist")

if os.path.exists(DIST_DIR):
    assets_dir = os.path.join(DIST_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(DIST_DIR, "index.html"))

    @app.get("/favicon.svg")
    def serve_favicon():
        fav = os.path.join(DIST_DIR, "favicon.svg")
        if os.path.exists(fav):
            return FileResponse(fav)
        return FileResponse(os.path.join(DIST_DIR, "index.html"))
else:
    @app.get("/")
    def root():
        return {
            "status": "online",
            "service": "Dog Breed Classification",
            "total_classes": len(CLASS_NAMES),
            "model_loaded": _model is not None,
            "endpoints": {
                "predict_file": "POST /api/predict",
                "predict_base64": "POST /api/predict-base64",
                "breeds": "GET /api/breeds",
                "health": "GET /api/health"
            }
        }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "architecture": "MobileNetV2 (ImageNet Transfer Learning)",
        "classes_count": len(CLASS_NAMES),
        "model_file_found": MODEL_PATH is not None and os.path.exists(MODEL_PATH) if MODEL_PATH else False,
        "live_tf_inference": _model is not None
    }

@app.get("/api/breeds")
def get_breeds():
    """Returns the list of 120 breeds with their formatted names and intelligence dossiers."""
    return {
        "total": len(CLASS_NAMES),
        "breeds": [
            {
                "id": b,
                "name": b.replace("_", " ").replace("-", " ").title(),
                "dossier": BREED_INFO.get(b, {})
            }
            for b in CLASS_NAMES
        ]
    }

@app.post("/api/predict")
async def predict_file(file: UploadFile = File(...)):
    """Receives an uploaded image file and returns top 5 breed classifications."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid image format.")
    
    try:
        image_bytes = await file.read()
        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty image file received.")
        
        result = predict_breed(image_bytes, top_k=5)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

@app.post("/api/predict-base64")
async def predict_base64(payload: Base64Payload):
    """Receives base64 image data (e.g. webcam snapshot or canvas capture)."""
    try:
        raw_b64 = payload.image
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        
        image_bytes = base64.b64decode(raw_b64)
        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Decoded image is empty.")
            
        result = predict_breed(image_bytes, top_k=5)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Base64 inference error: {str(e)}")

@app.get("/api/sample-dog")
def get_sample_dog():
    """Serves the test sample dog image for instant 1-click preview."""
    import pathlib
    curr = pathlib.Path(__file__).resolve().parent
    sample_path = curr.parent / "dataset" / "test_dog.jpg"
    if sample_path.exists():
        return FileResponse(str(sample_path), media_type="image/jpeg")
    raise HTTPException(status_code=404, detail="Sample image not found.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
