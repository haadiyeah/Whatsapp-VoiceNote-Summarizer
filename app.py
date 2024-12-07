# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import logging
import shutil
from datetime import datetime
import time

# Enhanced logging setup
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

first_request = True

def get_downloads_dir():
    downloads = os.path.expanduser("~/Downloads")
    logger.debug(f"Downloads directory: {downloads}")
    return downloads

def ensure_extension_dir():
    extension_dir = os.path.join(os.getcwd(), 'Downloads')
    if not os.path.exists(extension_dir):
        logger.info(f"Creating extension downloads directory: {extension_dir}")
        os.makedirs(extension_dir)
    return extension_dir

@app.route('/process_downloaded_file', methods=['POST'])
def process_downloaded_file():
    logger.info("=== Processing downloaded file ===")
    try:
        # Log raw request data
        logger.debug(f"Request headers: {dict(request.headers)}")
        logger.debug(f"Request data: {request.get_data()}")
        
        data = request.json
        logger.info(f"Received request data: {data}")
        
        if not data or 'filename' not in data:
            logger.error("No filename in request data")
            return jsonify({
                'success': False,
                'error': 'No filename provided'
            }), 400
        
        # Get file paths
        downloads_dir = get_downloads_dir()
        original_file = os.path.join(downloads_dir, data['filename'])
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
                    return jsonify({
                        'success': True,
                        'original_file': original_file,
                        'saved_file': new_filepath,
                        'size': file_size
                    })
                    
                except Exception as e:
                    logger.exception("Error while copying file")
                    return jsonify({
                        'success': False,
                        'error': f'File copy error: {str(e)}'
                    }), 500
            
            logger.debug("File not found, waiting...")
            time.sleep(1)
        
        logger.error("File not found after all attempts")
        return jsonify({
            'success': False,
            'error': 'File not found after waiting'
        }), 404
            
    except Exception as e:
        logger.exception("Unexpected error in process_downloaded_file")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.before_request
def before_request():
    global first_request
    if first_request:
        logger.info("=== First request received ===")
        ensure_extension_dir()
        first_request = False

if __name__ == '__main__':
    logger.info("=== Starting Flask Server ===")
    ensure_extension_dir()
    app.run(debug=True, port=5000)