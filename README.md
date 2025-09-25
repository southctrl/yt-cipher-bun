Basic service to eval yt player scripts for nsig stuff. 

## Getting Started

The easiest way to use this right now is with docker

```bash
git clone https://github.com/kikkia/yt-cipher.git

cd yt-cipher

docker-compose build
docker-compose up
```

## 🔒 Authentication

You'll need to set the `API_BEARER_TOKEN` environment variable in your `docker-compose.yml` file.

Requests without a valid `Authorization: Bearer <your_token>` header will be rejected.

## API Specification

### `POST /decrypt_signature`

**Request Body:**

```json
{
  "encrypted_signature": "...",
  "n_param": "...",
  "player_url": "...",
  "video_id": "VIDEO_ID"
}
```

- `encrypted_signature` (string): The encrypted signature from the video stream.
- `n_param` (string): The `n` parameter value.
- `player_url` (string): The URL to the JavaScript player file that contains the decryption logic.
- `video_id` (string): The ID of the video.

**Successful Response:**

```json
{
  "decrypted_signature": "...",
  "decrypted_n_sig": "..."
}
```

**Example `curl` request:**

```bash
curl -X POST http://localhost:8001/decrypt_signature \
-H "Content-Type: application/json" \
-H "Authorization: Bearer your_secret_token" \
-d '{
  "encrypted_signature": "...",
  "n_param": "...",
  "player_url": "https://...",
  "video_id": "..."
}'
```

### `POST /get_sts`
Was originally for getting the timestamp, but with ejs we dont grab that. Regex still seems ok to get it. 
