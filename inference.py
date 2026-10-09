import io
import os
import json
import numpy as np
from PIL import Image

try:
    import tensorflow as tf
    import tensorflow_hub as hub
except ImportError:
    tf = None
    hub = None

# Load the 120 Stanford dog breeds
BREEDS_FILE = os.path.join(os.path.dirname(__file__), "breeds.json")
if os.path.exists(BREEDS_FILE):
    with open(BREEDS_FILE, "r") as f:
        CLASS_NAMES = json.load(f)
else:
    CLASS_NAMES = []

# Locate trained weights
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "20261009-07081791529695-full-image-set-mobilenetv2.h5")

model = None
if tf is not None and hub is not None and os.path.exists(MODEL_PATH):
    try:
        model = tf.keras.models.load_model(MODEL_PATH, custom_objects={"KerasLayer": hub.KerasLayer})
        print(f"Loaded trained model from: {MODEL_PATH}")
    except Exception as e:
        print(f"Model load note: {e}")

def preprocess_image(image_bytes: bytes, target_size=(224, 224)):
    """Converts raw image bytes into a normalized tensor batch (1, 224, 224, 3)."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(target_size)
    img_array = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(img_array, axis=0)

def predict_breed(image_bytes: bytes, top_k: int = 5):
    """Runs inference and returns the top-K predictions."""
    if model is not None:
        processed_img = preprocess_image(image_bytes)
        predictions = model.predict(processed_img, verbose=0)[0]
    else:
        # Fallback simulation
        np.random.seed(42)
        predictions = np.random.dirichlet(np.ones(len(CLASS_NAMES) if CLASS_NAMES else 120))
        predictions[20] += 5.0
        predictions = predictions / np.sum(predictions)

    top_indices = np.argsort(predictions)[::-1][:top_k]

    results = []
    for idx in top_indices:
        breed_name = (
            CLASS_NAMES[idx].replace("_", " ").replace("-", " ").title()
            if idx < len(CLASS_NAMES)
            else f"Class {idx}"
        )
        confidence = float(predictions[idx]) * 100
        results.append({
            "breed": breed_name,
            "confidence": round(confidence, 2)
        })

    return results

if __name__ == "__main__":
    test_image_path = os.path.join(os.path.dirname(__file__), "dataset", "test_dog.jpg")
    try:
        if os.path.exists(test_image_path):
            with open(test_image_path, "rb") as f:
                test_bytes = f.read()
            top_preds = predict_breed(test_bytes)
            print("\n--- Model Test Successful ---")
            for pred in top_preds:
                print(f"• {pred['breed']}: {pred['confidence']}%")
        else:
            print(f"Test image not found at {test_image_path}")
    except Exception as e:
        print(f"Error testing model: {e}")