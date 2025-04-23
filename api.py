import yt_dlp
from yt_dlp.extractor.youtube import YoutubeIE
from fastapi import FastAPI, HTTPException, Body, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import logging
import uvicorn
import os
import sys

# --- Configuration ---
API_BEARER_TOKEN = os.getenv("API_BEARER_TOKEN")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Security ---
if not API_BEARER_TOKEN:
    logger.error("FATAL: API_BEARER_TOKEN environment variable not set.")
    sys.exit("API_BEARER_TOKEN environment variable must be set.")

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency to verify the bearer token."""
    if credentials.scheme != "Bearer" or credentials.credentials != API_BEARER_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return True # Indicate success

# --- FastAPI App ---
app = FastAPI(
    title="yt-dlp Signature Decryption Service",
    description="Provides access to yt-dlp's signature decryption logic. Requires Bearer token authentication.",
    dependencies=[Depends(verify_token)] # Apply auth globally
)

# --- Request Model ---
class SignatureRequest(BaseModel):
    encrypted_signature: str = Field(..., description="The encrypted 's' parameter value from the format URL.")
    n_param: str
    player_url: str = Field(..., description="The URL of the base.js or player_ias.vfl file.")
    video_id: str

class StsRequest(BaseModel):
    player_url: str = Field(..., description="The URL of the base.js or player_ias.vfl file.")
    video_id: str

# --- Response Model ---
class SignatureResponse(BaseModel):
    decrypted_signature: str
    decrypted_n_sig: str

class StsResponse(BaseModel):
    sts: int

# --- Global yt-dlp Instance ---
ydl_opts = {'quiet': True, 'no_warnings': True}
try:
    _ydl_instance = yt_dlp.YoutubeDL(ydl_opts)
    _youtube_ie = YoutubeIE(_ydl_instance)
    logger.info("yt-dlp YoutubeIE initialized successfully.")
except Exception as e:
    logger.exception("Failed to initialize yt-dlp YoutubeIE globally!")
    _youtube_ie = None

# --- Endpoints ---
@app.post("/decrypt_signature", response_model=SignatureResponse)
async def decrypt_signature_endpoint(request: SignatureRequest = Body(...)):
    if not _youtube_ie:
         raise HTTPException(status_code=503, detail="yt-dlp service component not initialized.")

    logger.info(f"Received decryption request for player: {request.player_url}")
    logger.debug(f"Encrypted sig: {request.encrypted_signature}, n_param: {request.n_param}, video_id: {request.video_id}")

    decrypted_sig = ""
    decrypted_n_result = ""

    try:
        if request.encrypted_signature and request.encrypted_signature != "":
            decrypted_sig = _youtube_ie._decrypt_signature(
                request.encrypted_signature,
                request.video_id,
                request.player_url,
            )

            if not decrypted_sig:
                logger.warning(f"Signature decryption returned empty for player {request.player_url}")
                raise HTTPException(status_code=400, detail="Signature decryption failed or returned empty result.")

        decrypted_n_result = None
        if request.n_param and request.n_param != "":
            logger.debug("Calling _decrypt_nsig...")
            decrypted_n_result = _youtube_ie._decrypt_nsig(
                request.n_param,
                request.video_id,
                request.player_url,
            )
            if not decrypted_n_result:
                 logger.warning(f"N-parameter decryption returned empty for player {request.player_url}")
                 # Don't raise HTTPException here, maybe only sig was needed or n failed independently?
                 # Let the caller decide based on the None value.
            else:
                logger.debug(f"Decrypted n-parameter successfully.")

        logger.info(f"Successfully processed signature decryption for player: {request.player_url}")
        return SignatureResponse(decrypted_signature=decrypted_sig, decrypted_n_sig=decrypted_n_result)

    except yt_dlp.utils.ExtractorError as e:
        logger.error(f"ExtractorError during decryption for player {request.player_url}: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"yt-dlp Extractor Error: {e}")
    except yt_dlp.utils.JsInterpreterError as e:
         logger.error(f"JsInterpreterError during decryption for player {request.player_url}: {e}", exc_info=True)
         raise HTTPException(status_code=500, detail=f"yt-dlp JavaScript Interpreter Error: {e}")
    except Exception as e:
        logger.exception(f"Unexpected error during decryption for player {request.player_url}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

@app.post("/get_sts", response_model=StsResponse)
async def get_signature_timestamp_endpoint(request: StsRequest = Body(...)):
    if not _youtube_ie:
        raise HTTPException(status_code=503, detail="yt-dlp service component not initialized.")

    logger.info(f"Received STS request for player: {request.player_url}")

    try:
        sts_value = _youtube_ie._extract_signature_timestamp(
            video_id=request.video_id,
            player_url=request.player_url,
            fatal=True
        )

        if sts_value is not None:
             logger.info(f"Successfully extracted STS ({sts_value}) for player: {request.player_url}")
             return StsResponse(sts=sts_value)
        else:
             # Should not be reached if fatal=True and regex fails in yt-dlp, but handle defensively.
             logger.error(f"STS extraction failed for player {request.player_url} despite fatal=True.")
             raise HTTPException(status_code=500, detail="STS could not be extracted.")

    except Exception as e: # Catching broad Exception as yt-dlp might raise various things here
        logger.exception(f"Error getting STS for player {request.player_url}: {e}")
        # Check if it's a known "not found" type error if possible, otherwise generic 500
        if isinstance(e, yt_dlp.utils.ExtractorError) and "Unable to extract signature timestamp" in str(e):
             raise HTTPException(status_code=404, detail=f"STS not found in player: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error during STS extraction: {e}")


if __name__ == "__main__":
     # Default port changed slightly to avoid common conflicts if needed
     port = int(os.getenv("PORT", 8001))
     host = os.getenv("HOST", "0.0.0.0")
     logger.info(f"Starting server on {host}:{port}")
     uvicorn.run(app, host=host, port=port)