Basic service to eval yt player scripts for nsig stuff. 

## Getting Started

The easiest way to use this right now is with docker

```bash
git clone https://github.com/kikkia/yt-cipher.git

cd yt-cipher

docker-compose build
docker-compose up
```

## Authentication

You'll need to set the `API_TOKEN` environment variable in your `docker-compose.yml` file.

Requests without a valid `Authorization: <your_token>` header will be rejected.

## Config

Environment Variables:
- `MAX_THREADS` - max # of workers that can handle requests. Default is 1 per thread on the machine or 1 if it can't determine that for some reason. 
- `API_TOKEN` - The required token to authenticate requests
- `PORT` - Port to run the api on, default: `8001`
- `HOST` - Sets the hostname for the deno server, default: `0.0.0.0`

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
