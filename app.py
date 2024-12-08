# app.py
import torch
import gc
from transformers import pipeline, AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig

import soundfile as sf
from pydantic import BaseModel
from fastapi import File, UploadFile
import io
import os

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import logging
import shutil
from datetime import datetime
import time
from typing import Optional
import uvicorn

# Add before AudioProcessor class
# Set PyTorch memory allocation configs
os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'
torch.backends.cudnn.benchmark = True

# Enhanced logging setup
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

HF_TOKEN = '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'

#check if gpu is available
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("!!!!!", device)

# Configure memory settings
os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:512'
torch.backends.cuda.max_memory_allocated = 4 * 1024 * 1024 * 1024  # 4GB limit

# Update AudioProcessor class
class AudioProcessor:
    def __init__(self):
        hf_token = HF_TOKEN
        
        try:
            import bitsandbytes as bnb
            # Configure quantization
            quantization_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16
            )
        except ImportError:
            logger.warning("bitsandbytes not available, falling back to 16-bit precision")
            quantization_config = None

        # Use smaller Whisper model
        self.transcriber = pipeline(
            "automatic-speech-recognition",
            model="openai/whisper-base",
            device="cuda" if torch.cuda.is_available() else "cpu"
        )

        # Load model with memory optimizations
        self.tokenizer = AutoTokenizer.from_pretrained(
            "meta-llama/Llama-3.2-3B-Instruct",
            use_auth_token=hf_token
        )
        
        model_kwargs = {
            "device_map": "auto",
            "torch_dtype": torch.float16,
            "low_cpu_mem_usage": True
        }
        
        if quantization_config:
            model_kwargs["quantization_config"] = quantization_config

        self.model = AutoModelForCausalLM.from_pretrained(
            "meta-llama/Llama-3.2-3B-Instruct",
            use_auth_token=hf_token,
            **model_kwargs
        )

    def transcribe_audio(self, audio_data, language="en"):
        try:
            torch.cuda.empty_cache()
            gc.collect()
            
            # Process in smaller chunks if needed
            chunk_length = 30  # seconds
            return self.transcriber(
                audio_data,
                generate_kwargs={"language": language, "task": "transcribe"},
                chunk_length_s=chunk_length,
                batch_size=1
            )["text"]
        finally:
            torch.cuda.empty_cache()
            gc.collect()

    def generate_summary(self, text):
        try:
            torch.cuda.empty_cache()
            gc.collect()
            
            # Split long text into chunks
            max_length = 512
            chunks = [text[i:i + max_length] for i in range(0, len(text), max_length)]
            summaries = []
            
            for chunk in chunks:
                prompt = f"Summarize the key points of the following text in 3-5 bullet points. Do not exceed more that 3-5 brief points. Respond with the bullet points only, no additional information. Here is the text: \n\n{chunk}\n\n "
                inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=max_length)
                
                # Move inputs to the same device as the model
                device = next(self.model.parameters()).device
                inputs = inputs.to(device)
                
                with torch.no_grad():
                    max_new_tokens = 200  # Maximum new tokens to generate
                    
                    outputs = self.model.generate(
                        **inputs,
                        max_new_tokens=max_new_tokens,
                        num_return_sequences=1,
                        temperature=0.7,
                        do_sample=True,
                        pad_token_id=self.tokenizer.eos_token_id
                    )
                summaries.append(self.tokenizer.decode(outputs[0], skip_special_tokens=True))
            
            return " ".join(summaries)
        finally:
            torch.cuda.empty_cache()
            gc.collect()


# Initialize processor
processor = AudioProcessor()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

first_request = True

def get_downloads_dir():
    downloads = os.path.expanduser("~Downloads")
    logger.debug(f"Downloads directory: {downloads}")
    return downloads

def ensure_extension_dir():
    extension_dir = os.path.join(os.getcwd(), './extension/Downloads')
    if not os.path.exists(extension_dir):
        logger.info(f"Creating extension downloads directory: {extension_dir}")
        os.makedirs(extension_dir)
    return extension_dir

@app.post('/analyze-audio')
async def analyze_audio():
    try:
        # Clear CUDA cache at start
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            gc.collect()
        # Get the latest file in the downloads directory of extension
        downloads_dir = ensure_extension_dir()
        files = os.listdir(downloads_dir)
        files.sort(key=lambda x: os.path.getmtime(os.path.join(downloads_dir, x)))
        latest_file = files[-1]
        logger.info(f"Found latest file: {latest_file}")

        # Read the audio file
        file_path = os.path.join(downloads_dir, latest_file)
        audio_array, _ = sf.read(file_path)

        # Process the audio
        transcription = processor.transcribe_audio(audio_array)
        summary = processor.generate_summary(transcription)

        return JSONResponse({
            'summary': summary,
            'transcription': transcription
        })
    except Exception as e:
        logger.exception("Error processing audio file")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clear CUDA cache at end
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            gc.collect()
    


@app.post('/process_downloaded_file')
async def process_downloaded_file(request: Request):
    logger.info("=== Processing downloaded file ===")
    try:
        # Log raw request data
        headers = dict(request.headers)
        logger.debug(f"Request headers: {headers}")
        
        data = await request.json()
        logger.info(f"Received request data: {data}")
        
        if not data or 'filepath' not in data:
            logger.error("No filepath in request data")
            return JSONResponse(
                status_code=400,
                content={
                    'success': False,
                    'error': 'No filename provided'
                }
            )
        
        # Get file paths
        downloads_dir = get_downloads_dir()
        original_file = os.path.abspath(data['filepath'])

        logger.info(f"Looking for file: {original_file}")
        
        # Wait for file with logging
        max_attempts = 10
        for attempt in range(max_attempts):
            logger.debug(f"Attempt {attempt + 1}/{max_attempts} to find file")
            
            if os.path.exists(original_file):
                file_size = os.path.getsize(original_file)
                logger.info(f"Found file! Size: {file_size} bytes")
                
                try:
                    # Setup new file path
                    extension_dir = ensure_extension_dir()
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    new_filename = f"voice_note_{timestamp}.ogg"
                    new_filepath = os.path.join(extension_dir, new_filename)
                    
                    # Copy file
                    logger.info(f"Copying file to: {new_filepath}")
                    shutil.copy2(original_file, new_filepath)
                    
                    logger.info("File processed successfully!")
                    return JSONResponse({
                        'success': True,
                        'original_file': original_file,
                        'saved_file': new_filepath,
                        'size': file_size
                    })
                    
                except Exception as e:
                    logger.exception("Error while copying file")
                    return JSONResponse(
                        status_code=500,
                        content={
                            'success': False,
                            'error': f'File copy error: {str(e)}'
                        }
                    )
            
            logger.debug("File not found, waiting...")
            time.sleep(1)
        
        logger.error("File not found after all attempts")
        return JSONResponse(
            status_code=404,
            content={
                'success': False,
                'error': 'File not found after waiting'
            }
        )
            
    except Exception as e:
        logger.exception("Unexpected error in process_downloaded_file")
        return JSONResponse(
            status_code=500,
            content={
                'success': False,
                'error': str(e)
            }
        )

@app.middleware("http")
async def check_first_request(request: Request, call_next):
    global first_request
    if first_request:
        logger.info("=== First request received ===")
        ensure_extension_dir()
        first_request = False
    response = await call_next(request)
    return response

if __name__ == '__main__':
    logger.info("=== Starting FastAPI Server ===")
    ensure_extension_dir()
    
    uvicorn.run(app, host="0.0.0.0", port=5000)