import cv2
import numpy as np
import os
import json
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename
import uuid
from datetime import datetime
from PIL import Image
import io
import fitz  # PyMuPDF for PDF handling
from flask_cors import CORS
app = Flask(__name__)
CORS(app)  

# Configuration
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
HISTORY_FOLDER = os.path.join(os.getcwd(), 'history')
RESTORED_FOLDER = os.path.join(os.getcwd(), 'restored')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'pdf'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# Create directories
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(HISTORY_FOLDER, exist_ok=True)
os.makedirs(RESTORED_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def pdf_to_images(pdf_path):
    """Convert PDF pages to images"""
    try:
        pdf_document = fitz.open(pdf_path)
        images = []
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better quality
            img_data = pix.tobytes("ppm")
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            images.append(img)
        pdf_document.close()
        return images
    except Exception as e:
        print(f"Error converting PDF: {e}")
        return None


def detect_shadow_intensity(image):
    """Detect shadow intensity: 'light', 'medium', or 'heavy'"""
    try:
        # Convert to LAB color space
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        L, _, _ = cv2.split(lab)
        
        # Calculate statistics
        mean_lightness = np.mean(L)
        std_lightness = np.std(L)
        
        # Determine shadow intensity based on lightness distribution
        if mean_lightness > 200 and std_lightness < 15:
            return 'light'
        elif mean_lightness > 180 and std_lightness < 30:
            return 'medium'
        else:
            return 'heavy'
    except Exception as e:
        print(f"Error detecting shadow intensity: {e}")
        return 'medium'


def fourier_document_restoration(image, radius=40, alpha=0.9):
    """
    Enhanced Fourier-based shadow removal from document images
    
    Args:
        image: OpenCV image (BGR)
        radius: Gaussian filter radius (controls shadow smoothness)
        alpha: Alpha blending parameter (controls restoration strength)
    
    Returns:
        Restored image
    """
    try:
        # Convert to LAB color space
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        L, A, B = cv2.split(lab)
        L_float = L.astype(np.float32)

        # Get dimensions
        rows, cols = L.shape
        
        # Apply log transform for homomorphic filtering
        L_log = np.log1p(L_float)
        
        # Forward Real FFT
        dft = np.fft.rfft2(L_log)
        
        # Create Gaussian mask to isolate shadows (low frequencies)
        r_idx, c_idx = np.indices(dft.shape)
        row_dist = np.minimum(r_idx, rows - r_idx)
        dist_sq = (row_dist**2 + c_idx**2)
        low_pass = np.exp(-dist_sq / (2.0 * radius**2))

        # Extract shadow map
        illum_log = np.fft.irfft2(dft * low_pass, s=(rows, cols))
        illum = np.expm1(illum_log)
        illum = np.clip(illum, 1e-6, None)

        # Normalize and apply correction
        illum_norm = illum / (np.max(illum) + 1e-6)
        L_corrected = L_float / (illum_norm ** alpha + 1e-6)
        
        # Morphological cleanup to ensure paper is pure white
        L_uint8 = np.clip(L_corrected, 0, 255).astype(np.uint8)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        L_clean = cv2.morphologyEx(L_uint8, cv2.MORPH_CLOSE, kernel)
        L_final_div = cv2.divide(L_uint8, L_clean, scale=255)

        # Final normalization
        L_final = cv2.normalize(L_final_div, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        
        # Merge back color channels
        result = cv2.cvtColor(cv2.merge((L_final, A, B)), cv2.COLOR_LAB2BGR)
        
        return result
    except Exception as e:
        print(f"Error in Fourier restoration: {e}")
        return image


def image_to_pdf(image, output_path):
    """Convert image to PDF"""
    try:
        pil_image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        pil_image.save(output_path, 'PDF')
        return True
    except Exception as e:
        print(f"Error converting to PDF: {e}")
        return False


@app.route('/api/process', methods=['POST'])
def process_document():
    """Process uploaded document with shadow removal"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed'}), 400
        
        # Get parameters
        radius = float(request.form.get('radius', 40))
        alpha = float(request.form.get('alpha', 0.9))
        
        # Validate parameters
        radius = max(10, min(100, radius))
        alpha = max(0.1, min(2.0, alpha))
        
        # Generate unique ID
        process_id = str(uuid.uuid4())
        
        # Save uploaded file
        filename = secure_filename(file.filename)
        file_ext = filename.rsplit('.', 1)[1].lower()
        temp_path = os.path.join(UPLOAD_FOLDER, f"{process_id}_{filename}")
        file.save(temp_path)
        
        # Process based on file type
        if file_ext.lower() == 'pdf':
            images = pdf_to_images(temp_path)
            if not images:
                return jsonify({'error': 'Failed to process PDF'}), 400
        else:
            img = cv2.imread(temp_path)
            if img is None:
                return jsonify({'error': 'Failed to read image'}), 400
            images = [img]
        
        # Detect shadow intensity
        shadow_intensity = detect_shadow_intensity(images[0])
        
        # Process images
        restored_images = []
        for i, img in enumerate(images):
            restored = fourier_document_restoration(img, radius=radius, alpha=alpha)
            restored_images.append(restored)
        
        # Save restored images
        restored_paths = []
        preview_path = None
        
        for i, img in enumerate(restored_images):
            if file_ext.lower() == 'pdf':
                restored_file = f"{process_id}_page_{i+1}.png"
            else:
                restored_file = f"{process_id}_restored.png"
            
            restored_full_path = os.path.join(RESTORED_FOLDER, restored_file)
            cv2.imwrite(restored_full_path, img)
            restored_paths.append(restored_file)
            
            if i == 0:  # Use first page/image as preview
                preview_path = f"/api/preview/{restored_file}"
        
        # Save to history
        history_entry = {
            'id': process_id,
            'original_filename': filename,
            'timestamp': datetime.now().isoformat(),
            'file_type': file_ext,
            'shadow_intensity': shadow_intensity,
            'settings': {
                'radius': radius,
                'alpha': alpha
            },
            'restored_files': restored_paths,
            'page_count': len(restored_images)
        }
        
        history_path = os.path.join(HISTORY_FOLDER, f"{process_id}.json")
        with open(history_path, 'w') as f:
            json.dump(history_entry, f, indent=2)
        
        return jsonify({
            'success': True,
            'process_id': process_id,
            'shadow_intensity': shadow_intensity,
            'preview_url': preview_path,
            'page_count': len(restored_images),
            'restored_files': restored_paths
        }), 200
    
    except Exception as e:
        print(f"Error in process_document: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/preview/<filename>')
def get_preview(filename):
    """Get preview of restored document"""
    try:
        file_path = os.path.join(RESTORED_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(file_path, mimetype='image/png')
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/download/<process_id>/<format>')
def download_document(process_id, format):
    """Download restored document in specified format"""
    try:
        history_path = os.path.join(HISTORY_FOLDER, f"{process_id}.json")
        if not os.path.exists(history_path):
            return jsonify({'error': 'Process not found'}), 404
        
        with open(history_path, 'r') as f:
            history = json.load(f)
        
        restored_files = history['restored_files']
        original_name = history['original_filename'].rsplit('.', 1)[0]
        
        if format == 'original':
            # Return as PNG
            file_path = os.path.join(RESTORED_FOLDER, restored_files[0])
            return send_file(file_path, as_attachment=True, 
                           download_name=f"{original_name}_restored.png")
        
        elif format == 'pdf':
            # Convert to PDF
            if len(restored_files) == 1:
                # Single page PDF
                img = cv2.imread(os.path.join(RESTORED_FOLDER, restored_files[0]))
                output_buffer = io.BytesIO()
                image_to_pdf(img, output_buffer)
                output_buffer.seek(0)
                return send_file(output_buffer, mimetype='application/pdf',
                               as_attachment=True, 
                               download_name=f"{original_name}_restored.pdf")
            else:
                # Multi-page PDF
                images = []
                for restored_file in restored_files:
                    img = cv2.imread(os.path.join(RESTORED_FOLDER, restored_file))
                    pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
                    images.append(pil_img)
                
                output_buffer = io.BytesIO()
                images[0].save(output_buffer, 'PDF', save_all=True, append_images=images[1:])
                output_buffer.seek(0)
                return send_file(output_buffer, mimetype='application/pdf',
                               as_attachment=True,
                               download_name=f"{original_name}_restored.pdf")
        
        return jsonify({'error': 'Invalid format'}), 400
    
    except Exception as e:
        print(f"Error in download_document: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/history', methods=['GET'])
def get_history():
    """Get all processed documents"""
    try:
        history_items = []
        
        for filename in os.listdir(HISTORY_FOLDER):
            if filename.endswith('.json'):
                with open(os.path.join(HISTORY_FOLDER, filename), 'r') as f:
                    item = json.load(f)
                    history_items.append(item)
        
        # Sort by timestamp, newest first
        history_items.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return jsonify({'history': history_items}), 200
    except Exception as e:
        print(f"Error in get_history: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/history/<process_id>', methods=['DELETE'])
def delete_history_entry(process_id):
    """Delete a history entry and associated files"""
    try:
        history_path = os.path.join(HISTORY_FOLDER, f"{process_id}.json")
        
        if not os.path.exists(history_path):
            return jsonify({'error': 'Entry not found'}), 404
        
        # Read history to get file list
        with open(history_path, 'r') as f:
            history = json.load(f)
        
        # Delete restored files
        for restored_file in history.get('restored_files', []):
            file_path = os.path.join(RESTORED_FOLDER, restored_file)
            if os.path.exists(file_path):
                os.remove(file_path)
        
        # Delete uploaded file
        for upload_file in os.listdir(UPLOAD_FOLDER):
            if upload_file.startswith(process_id):
                os.remove(os.path.join(UPLOAD_FOLDER, upload_file))
        
        # Delete history entry
        os.remove(history_path)
        
        return jsonify({'success': True}), 200
    except Exception as e:
        print(f"Error in delete_history_entry: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/reprocess/<process_id>', methods=['POST'])
def reprocess_document(process_id):
    """Reprocess a document with new settings"""
    try:
        history_path = os.path.join(HISTORY_FOLDER, f"{process_id}.json")
        
        if not os.path.exists(history_path):
            return jsonify({'error': 'Process not found'}), 404
        
        with open(history_path, 'r') as f:
            history = json.load(f)
        
        # Get new parameters
        radius = float(request.json.get('radius', history['settings']['radius']))
        alpha = float(request.json.get('alpha', history['settings']['alpha']))
        
        # Validate parameters
        radius = max(10, min(100, radius))
        alpha = max(0.1, min(2.0, alpha))
        
        # Find original uploaded file
        uploaded_file = None
        for upload_file in os.listdir(UPLOAD_FOLDER):
            if upload_file.startswith(process_id):
                uploaded_file = os.path.join(UPLOAD_FOLDER, upload_file)
                break
        
        if not uploaded_file or not os.path.exists(uploaded_file):
            return jsonify({'error': 'Original file not found'}), 404
        
        # Process file
        file_ext = uploaded_file.rsplit('.', 1)[1].lower()
        
        if file_ext == 'pdf':
            images = pdf_to_images(uploaded_file)
        else:
            img = cv2.imread(uploaded_file)
            images = [img]
        
        # Restore with new settings
        restored_images = []
        for img in images:
            restored = fourier_document_restoration(img, radius=radius, alpha=alpha)
            restored_images.append(restored)
        
        # Update restored files
        for i, img in enumerate(restored_images):
            if file_ext == 'pdf':
                restored_file = f"{process_id}_page_{i+1}.png"
            else:
                restored_file = f"{process_id}_restored.png"
            
            restored_full_path = os.path.join(RESTORED_FOLDER, restored_file)
            cv2.imwrite(restored_full_path, img)
        
        # Update history
        history['settings'] = {'radius': radius, 'alpha': alpha}
        with open(history_path, 'w') as f:
            json.dump(history, f, indent=2)
        
        preview_path = f"/api/preview/{restored_images[0]}"
        
        return jsonify({
            'success': True,
            'preview_url': preview_path,
            'settings': {'radius': radius, 'alpha': alpha}
        }), 200
    
    except Exception as e:
        print(f"Error in reprocess_document: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'}), 200


if __name__ == '__main__':
    app.run(debug=True, port=5000, host='localhost')