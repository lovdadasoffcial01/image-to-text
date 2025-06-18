# 📷 Image-to-Text AI API

This API utilizes **Cloudflare Workers AI** and the **LLaVA 1.5-7B-HF** model to process and analyze images based on user-provided prompts. It offers a streamlined interface for intelligent image understanding tasks such as captioning, content identification, and contextual analysis.

---

## 🌐 Base URL

```
https://image-to-text.api-url-production.workers.dev/
```

All requests are sent to the root path `/`.

---

## 🚀 Features

* AI-driven image analysis using prompt-based input
* Powered by **LLaVA 1.5-7B-HF**
* Proxy secured by **Cloudflare Workers**
* No client-side authentication required
* Full **CORS** support for frontend applications

---

## 📬 HTTP Methods

| Method    | Description                             |
| --------- | --------------------------------------- |
| `POST`    | Submit an image and prompt for analysis |
| `OPTIONS` | Handle CORS preflight requests          |

---

## 🧾 Request Format

### 🔐 Headers

```
Content-Type: application/json
```

### 📦 Request Body

| Parameter    | Type    | Required | Description                                                          |
| ------------ | ------- | -------- | -------------------------------------------------------------------- |
| `image`      | string  | Yes      | Base64-encoded image as Data URI (e.g., data\:image/jpeg;base64,...) |
| `prompt`     | string  | Yes      | Instruction or question about the image                              |
| `max_tokens` | integer | No       | Optional token limit for the response (default: 512)                 |

### 🧠 Prompt Examples

* "Describe the main activity in this picture."
* "What objects are visible in this image?"

---

## 🧪 Example Usage

### 📸 cURL (Linux/macOS)

```bash
BASE64_IMAGE=$(base64 -w 0 your_image.jpg | sed 's|^|data:image/jpeg;base64,|')

curl -X POST "https://image-to-text.api-url-production.workers.dev/" \
  -H "Content-Type: application/json" \
  -d '{
    "image": "'$BASE64_IMAGE'",
    "prompt": "Describe the main activity in this picture.",
    "max_tokens": 100
  }'
```

### 🐍 Python (requests)

```python
import requests
import base64

API_URL = "https://image-to-text.api-url-production.workers.dev/"
IMAGE_FILE_PATH = "path/to/your/local_image.jpg"
PROMPT_TEXT = "What is the primary subject of this image?"
MAX_TOKENS = 200

def get_image_base64_data_uri(image_path):
    mime_type = "image/jpeg"
    if image_path.lower().endswith('.png'):
        mime_type = "image/png"
    elif image_path.lower().endswith('.webp'):
        mime_type = "image/webp"

    with open(image_path, "rb") as img:
        encoded = base64.b64encode(img.read()).decode()
    return f"data:{mime_type};base64,{encoded}"

payload = {
    "image": get_image_base64_data_uri(IMAGE_FILE_PATH),
    "prompt": PROMPT_TEXT,
    "max_tokens": MAX_TOKENS
}

headers = {"Content-Type": "application/json"}

response = requests.post(API_URL, headers=headers, json=payload)
print("AI Response:", response.json().get("description", response.json()))
```

---

## ✅ Successful Response

```json
{
  "description": "The image features a lush green forest with tall trees and a sunny day. The sunlight is shining through the trees, creating a serene atmosphere."
}
```

---

## ❗ Error Responses

| HTTP Code | Description                        | Example Response                                         |
| --------- | ---------------------------------- | -------------------------------------------------------- |
| 400       | Bad Request (missing fields, etc.) | { "message": "Missing image or prompt in request body" } |
| 405       | Method Not Allowed                 | Plain text                                               |
| 500       | Internal Server Error              | { "message": "AI model error: Authentication error" }    |

---

## 🔐 Authentication

No authentication tokens or API keys are required for clients. Authentication is handled securely via the Cloudflare Worker proxy.

---

## 🌍 CORS Support

The API includes the following header for cross-origin support:

```
Access-Control-Allow-Origin: *
```

This allows seamless integration with web frontends from any origin.

---

## 📄 License

This API is built using the Cloudflare Workers platform and the open-source LLaVA model. Usage is subject to relevant open-source licenses.

---

## 🤝 Contributions

Feel free to fork, extend, or contribute via pull requests. For issues or feature suggestions, open an issue in the repository.

---

## 📧 Contact

For support or integration questions, please contact the API maintainer.
