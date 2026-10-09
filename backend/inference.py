import io
import os
import json
import time
from pathlib import Path
from PIL import Image
import numpy as np

# Directory of this script
BASE_DIR = Path(__file__).resolve().parent

# Load breed lists and rich metadata
BREEDS_FILE = BASE_DIR / "breeds.json"
if not BREEDS_FILE.exists():
    BREEDS_FILE = BASE_DIR.parent / "breeds.json"

BREED_INFO_FILE = BASE_DIR / "breed_info.json"
if not BREED_INFO_FILE.exists():
    BREED_INFO_FILE = BASE_DIR.parent / "breed_info.json"

if BREEDS_FILE.exists():
    with open(BREEDS_FILE, "r") as f:
        CLASS_NAMES = json.load(f)
else:
    CLASS_NAMES = []

if BREED_INFO_FILE.exists():
    with open(BREED_INFO_FILE, "r") as f:
        BREED_INFO = json.load(f)
else:
    BREED_INFO = {}

# Locate model files (TFLite or H5)
def find_model():
    # Priority 1: TFLite model
    tflite_candidates = [
        BASE_DIR / "models" / "dog_model.tflite",
        BASE_DIR.parent / "models" / "dog_model.tflite",
    ]
    for p in tflite_candidates:
        if p.exists():
            return str(p), "tflite"

    # Priority 2: H5 model
    h5_candidates = [
        BASE_DIR.parent / "models" / "20261009-07081791529695-full-image-set-mobilenetv2.h5",
        BASE_DIR / "models" / "20261009-07081791529695-full-image-set-mobilenetv2.h5",
    ]
    for p in h5_candidates:
        if p.exists():
            return str(p), "h5"

    return None, None

MODEL_PATH, MODEL_TYPE = find_model()

_model = None
_interpreter = None
_input_details = None
_output_details = None
_model_load_error = None

# Attempt to load model
if MODEL_PATH:
    if MODEL_TYPE == "tflite":
        try:
            try:
                from ai_edge_litert.interpreter import Interpreter
            except ImportError:
                try:
                    from tflite_runtime.interpreter import Interpreter
                except ImportError:
                    import tensorflow as tf
                    Interpreter = tf.lite.Interpreter

            _interpreter = Interpreter(MODEL_PATH)
            _interpreter.allocate_tensors()
            _input_details = _interpreter.get_input_details()
            _output_details = _interpreter.get_output_details()
            _model = _interpreter  # marker for model loaded
            print(f"[OK] Fast TFLite model loaded into memory from: {MODEL_PATH}")
        except Exception as e:
            _model_load_error = f"TFLite error: {e}"
            print(f"Notice: TFLite load error: {e}")
    else:
        try:
            import tensorflow as tf
            import tensorflow_hub as hub
            _model = tf.keras.models.load_model(MODEL_PATH, custom_objects={"KerasLayer": hub.KerasLayer})
            print(f"[OK] TensorFlow H5 model loaded successfully from: {MODEL_PATH}")
        except Exception as e:
            _model_load_error = str(e)
            print(f"Notice: TensorFlow H5 load note: {e}")
else:
    _model_load_error = "No model file found in models directory."

def preprocess_image(image_bytes: bytes, target_size=(224, 224)):
    """Converts raw image bytes into a normalized tensor batch (1, 224, 224, 3)."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(target_size)
    img_array = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(img_array, axis=0)

def predict_breed(image_bytes: bytes, top_k: int = 5):
    """
    Executes neural inference and returns top-K predictions with confidence
    scores, timing telemetry, and rich breed intelligence dossiers.
    """
    start_time = time.perf_counter()

    if _interpreter is not None:
        processed_img = preprocess_image(image_bytes)
        _interpreter.set_tensor(_input_details[0]['index'], processed_img)
        _interpreter.invoke()
        raw_preds = _interpreter.get_tensor(_output_details[0]['index'])[0]
    elif _model is not None and hasattr(_model, "predict"):
        processed_img = preprocess_image(image_bytes)
        raw_preds = _model.predict(processed_img, verbose=0)[0]
    else:
        # Fallback simulation only if no model is loaded
        time.sleep(0.05)
        np.random.seed(int(time.time() * 1000) % 2**32)
        raw_preds = np.random.dirichlet(np.ones(len(CLASS_NAMES) if CLASS_NAMES else 120))
        top_idx = np.random.randint(0, len(CLASS_NAMES) if CLASS_NAMES else 120)
        raw_preds[top_idx] += 8.5
        raw_preds = raw_preds / np.sum(raw_preds)

    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
    top_indices = np.argsort(raw_preds)[::-1][:top_k]

    results = []
    for rank, idx in enumerate(top_indices, start=1):
        raw_name = CLASS_NAMES[idx] if idx < len(CLASS_NAMES) else f"class_{idx}"
        display_name = raw_name.replace("_", " ").replace("-", " ").title()
        confidence = float(raw_preds[idx]) * 100

        # Retrieve rich encyclopedic dossier
        info = BREED_INFO.get(raw_name, {
            "name": display_name,
            "origin": "Verified Lineage",
            "group": "Canine",
            "temperament": ["Alert", "Loyal", "Agile"],
            "lifespan": "10 - 14 years",
            "energy": 75,
            "trainability": 80,
            "friendliness": 85,
            "description": "Distinguished breed classified with high neural activation."
        })

        results.append({
            "rank": rank,
            "id": raw_name,
            "breed": display_name,
            "confidence": round(confidence, 2),
            "dossier": info
        })

    is_live = (_interpreter is not None) or (_model is not None and hasattr(_model, "predict"))

    return {
        "status": "success",
        "top_breed": results[0]["breed"],
        "top_confidence": results[0]["confidence"],
        "predictions": results,
        "telemetry": {
            "latency_ms": latency_ms,
            "model_architecture": "MobileNetV2 (120 Stanford Classes)",
            "using_mock": not is_live,
            "runtime": "TFLite CPU" if _interpreter is not None else ("TensorFlow GPU/CPU" if _model else "Mock"),
            "note": None if is_live else _model_load_error
        }
    }

if __name__ == "__main__":
    test_image_path = BASE_DIR.parent / "dataset" / "test_dog.jpg"
    if test_image_path.exists():
        with open(test_image_path, "rb") as f:
            b = f.read()
        res = predict_breed(b)
        print("Inference Test Result:")
        print(json.dumps(res, indent=2))
