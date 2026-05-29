import cv2
import numpy as np
import os
import json
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import uuid
from datetime import datetime
from PIL import Image
import io
import fitz
from document_cleaning import gentle_document_cleaning

# Manual cropping only - no auto-detection needed
def detect_if_cropping_needed(image):
    """Placeholder - manual cropping feature"""
    return False, 0.0

def smart_crop_document(image, auto_crop=True):
    """Placeholder - manual cropping feature"""
    return image, {'applied': False, 'bbox': None, 'confidence': 0.0}

app = Flask(__name__)
CORS(app, origins=["https://document-restoration-ui.vercel.app"])

# Configuration
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
HISTORY_FOLDER = os.path.join(os.getcwd(), 'history')
RESTORED_FOLDER = os.path.join(os.getcwd(), 'restored')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'pdf'}
MAX_FILE_SIZE = 50 * 1024 * 1024

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
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
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
    """Detect shadow intensity"""
    try:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        L, _, _ = cv2.split(lab)
        
        mean_lightness = np.mean(L)
        std_lightness = np.std(L)
        
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
    """Fourier-based shadow removal"""
    try:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        L, A, B = cv2.split(lab)
        L_float = L.astype(np.float32)

        rows, cols = L.shape
        
        L_log = np.log1p(L_float)
        dft = np.fft.rfft2(L_log)
        
        r_idx, c_idx = np.indices(dft.shape)
        row_dist = np.minimum(r_idx, rows - r_idx)
        dist_sq = (row_dist**2 + c_idx**2)
        low_pass = np.exp(-dist_sq / (2.0 * radius**2))

        illum_log = np.fft.irfft2(dft * low_pass, s=(rows, cols))
        illum = np.expm1(illum_log)
        illum = np.clip(illum, 1e-6, None)

        illum_norm = illum / (np.max(illum) + 1e-6)
        L_corrected = L_float / (illum_norm ** alpha + 1e-6)
        
        L_uint8 = np.clip(L_corrected, 0, 255).astype(np.uint8)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        L_clean = cv2.morphologyEx(L_uint8, cv2.MORPH_CLOSE, kernel)
        L_final_div = cv2.divide(L_uint8, L_clean, scale=255)

        L_final = cv2.normalize(L_final_div, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        
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
    """Process with FOURIER ONLY and detect if cropping is needed"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed'}), 400
        
        radius = float(request.form.get('radius', 40))
        alpha = float(request.form.get('alpha', 0.9))
        
        radius = max(10, min(100, radius))
        alpha = max(0.1, min(2.0, alpha))
        
        process_id = str(uuid.uuid4())
        
        filename = secure_filename(file.filename)
        file_ext = filename.rsplit('.', 1)[1].lower()
        temp_path = os.path.join(UPLOAD_FOLDER, f"{process_id}_{filename}")
        file.save(temp_path)
        
        print(f"File saved to: {temp_path}")
        
        if file_ext.lower() == 'pdf':
            images = pdf_to_images(temp_path)
            if not images:
                return jsonify({'error': 'Failed to process PDF'}), 400
        else:
            img = cv2.imread(temp_path)
            if img is None:
                return jsonify({'error': 'Failed to read image'}), 400
            images = [img]
        
        shadow_intensity = detect_shadow_intensity(images[0])
        
        # === DETECT IF CROPPING IS NEEDED ===
        needs_crop, crop_confidence = detect_if_cropping_needed(images[0])
        
        restored_images = []
        fourier_files = []
        
        for i, img in enumerate(images):
            fourier_restored = fourier_document_restoration(img, radius=radius, alpha=alpha)
            restored_images.append(fourier_restored)
            
            if file_ext.lower() == 'pdf':
                fourier_file = f"{process_id}_page_{i+1}_fourier.png"
            else:
                fourier_file = f"{process_id}_fourier.png"
            
            fourier_full_path = os.path.join(RESTORED_FOLDER, fourier_file)
            cv2.imwrite(fourier_full_path, fourier_restored)
            fourier_files.append(fourier_file)
        
        preview_file = fourier_files[0]
        preview_path = f"/api/preview/{preview_file}"
        
        history_entry = {
            'id': process_id,
            'original_filename': filename,
            'timestamp': datetime.now().isoformat(),
            'file_type': file_ext,
            'shadow_intensity': shadow_intensity,
            'settings': {
                'radius': radius,
                'alpha': alpha,
                'cleaned': False,
                'cleaning_strength': None
            },
            'fourier_files': fourier_files,
            'cleaned_files': [],
            'page_count': len(restored_images),
            'crop_info': {
                'needs_crop': needs_crop,
                'crop_confidence': crop_confidence
            }
        }
        
        history_path = os.path.join(HISTORY_FOLDER, f"{process_id}.json")
        with open(history_path, 'w') as f:
            json.dump(history_entry, f, indent=2)
        
        print(f"History saved to: {history_path}")
        
        return jsonify({
            'success': True,
            'process_id': process_id,
            'shadow_intensity': shadow_intensity,
            'preview_url': preview_path,
            'page_count': len(restored_images),
            'fourier_files': fourier_files,
            'needs_crop': needs_crop,
            'crop_confidence': crop_confidence
        }), 200
    
    except Exception as e:
        print(f"Error in process_document: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/apply-cleaning/<process_id>', methods=['POST'])
def apply_cleaning(process_id):
    """Apply cleaning to already-restored document"""
    try:
        history_path = os.path.join(HISTORY_FOLDER, f"{process_id}.json")
        
        if not os.path.exists(history_path):
            return jsonify({'error': 'Process not found'}), 404
        
        with open(history_path, 'r') as f:
            history = json.load(f)
        
        cleaning_strength = request.json.get('cleaning_strength', 'medium')
        
        if cleaning_strength not in ['light', 'medium', 'heavy']:
            cleaning_strength = 'medium'
        
        fourier_files = history['fourier_files']
        cleaned_files = []
        
        for fourier_file in fourier_files:
            fourier_path = os.path.join(RESTORED_FOLDER, fourier_file)
            
            if not os.path.exists(fourier_path):
                return jsonify({'error': f'File not found: {fourier_file}'}), 404
            
            img = cv2.imread(fourier_path)
            cleaned_img = gentle_document_cleaning(img, cleaning_strength=cleaning_strength)
            
            cleaned_file = fourier_file.replace('_fourier.png', '_cleaned.png')
            cleaned_path = os.path.join(RESTORED_FOLDER, cleaned_file)
            cv2.imwrite(cleaned_path, cleaned_img)
            cleaned_files.append(cleaned_file)
        
        history['settings']['cleaned'] = True
        history['settings']['cleaning_strength'] = cleaning_strength
        history['cleaned_files'] = cleaned_files
        
        with open(history_path, 'w') as f:
            json.dump(history, f, indent=2)
        
        preview_path = f"/api/preview/{cleaned_files[0]}"
        
        return jsonify({
            'success': True,
            'preview_url': preview_path,
            'cleaned_files': cleaned_files,
            'message': 'Cleaning applied successfully'
        }), 200
    
    except Exception as e:
        print(f"Error in apply_cleaning: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/preview/<filename>')
def get_preview(filename):
    """Get preview of restored document"""
    try:
        file_path = os.path.join(RESTORED_FOLDER, secure_filename(filename))
        print(f"Trying to preview: {file_path}")
        
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(file_path, mimetype='image/png')
    except Exception as e:
        print(f"Error in get_preview: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/download/<process_id>/<format>', methods=['POST'])
def download_document(process_id, format):
    """
    Download restored document with optional smart cropping.
    
    Request body:
    {
        'crop': True/False  # Apply smart cropping
    }
    """
    try:
        history_path = os.path.join(HISTORY_FOLDER, f"{process_id}.json")
        if not os.path.exists(history_path):
            return jsonify({'error': 'Process not found'}), 404
        
        with open(history_path, 'r') as f:
            history = json.load(f)
        
        # Get crop preference from request (default: False)
        request_data = request.get_json() or {}
        apply_crop = request_data.get('crop', False)
        
        if history['settings']['cleaned'] and history['cleaned_files']:
            files_to_use = history['cleaned_files']
        else:
            files_to_use = history['fourier_files']
        
        original_name = history['original_filename'].rsplit('.', 1)[0]
        
        if format == 'original':
            file_path = os.path.join(RESTORED_FOLDER, files_to_use[0])
            img = cv2.imread(file_path)
            
            # === APPLY SMART CROPPING IF REQUESTED ===
            if apply_crop:
                img, crop_info = smart_crop_document(img, auto_crop=True)
            
            # Convert to PNG bytes
            _, buffer = cv2.imencode('.png', img)
            img_bytes = io.BytesIO(buffer.tobytes())
            img_bytes.seek(0)
            
            return send_file(
                img_bytes, 
                mimetype='image/png',
                as_attachment=True,
                download_name=f"{original_name}_restored.png"
            )
        
        elif format == 'pdf':
            if len(files_to_use) == 1:
                img = cv2.imread(os.path.join(RESTORED_FOLDER, files_to_use[0]))
                
                # === APPLY SMART CROPPING IF REQUESTED ===
                if apply_crop:
                    img, crop_info = smart_crop_document(img, auto_crop=True)
                
                temp_pdf_path = os.path.join(RESTORED_FOLDER, f"{process_id}_temp.pdf")
                image_to_pdf(img, temp_pdf_path)
                
                with open(temp_pdf_path, 'rb') as f:
                    output_buffer = io.BytesIO(f.read())
                
                os.remove(temp_pdf_path)
                output_buffer.seek(0)
                
                return send_file(
                    output_buffer, 
                    mimetype='application/pdf',
                    as_attachment=True,
                    download_name=f"{original_name}_restored.pdf"
                )
            else:
                # Multi-page PDF
                images = []
                for file in files_to_use:
                    img = cv2.imread(os.path.join(RESTORED_FOLDER, file))
                    
                    # === APPLY SMART CROPPING IF REQUESTED ===
                    if apply_crop:
                        img, crop_info = smart_crop_document(img, auto_crop=True)
                    
                    pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
                    images.append(pil_img)
                
                output_buffer = io.BytesIO()
                images[0].save(
                    output_buffer, 'PDF', 
                    save_all=True, 
                    append_images=images[1:]
                )
                output_buffer.seek(0)
                
                return send_file(
                    output_buffer, 
                    mimetype='application/pdf',
                    as_attachment=True,
                    download_name=f"{original_name}_restored.pdf"
                )
        
        return jsonify({'error': 'Invalid format'}), 400
    
    except Exception as e:
        print(f"Error in download_document: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/crop-preview/<process_id>', methods=['GET'])
def crop_preview(process_id):
    """Get preview of what the cropped version would look like"""
    try:
        history_path = os.path.join(HISTORY_FOLDER, f"{process_id}.json")
        if not os.path.exists(history_path):
            return jsonify({'error': 'Process not found'}), 404
        
        with open(history_path, 'r') as f:
            history = json.load(f)
        
        if history['settings']['cleaned'] and history['cleaned_files']:
            files_to_use = history['cleaned_files']
        else:
            files_to_use = history['fourier_files']
        
        file_path = os.path.join(RESTORED_FOLDER, files_to_use[0])
        img = cv2.imread(file_path)
        
        # Apply cropping
        cropped, crop_info = smart_crop_document(img, auto_crop=True)
        
        # Save temporary preview
        crop_preview_file = f"{process_id}_crop_preview.png"
        crop_preview_path = os.path.join(RESTORED_FOLDER, crop_preview_file)
        cv2.imwrite(crop_preview_path, cropped)
        
        return jsonify({
            'success': True,
            'preview_url': f"/api/preview/{crop_preview_file}",
            'crop_info': crop_info
        }), 200
    
    except Exception as e:
        print(f"Error in crop_preview: {e}")
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
        
        history_items.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return jsonify({'history': history_items}), 200
    except Exception as e:
        print(f"Error in get_history: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/history/<process_id>', methods=['DELETE'])
def delete_history_entry(process_id):
    """Delete a history entry"""
    try:
        history_path = os.path.join(HISTORY_FOLDER, f"{process_id}.json")
        
        if not os.path.exists(history_path):
            return jsonify({'error': 'Entry not found'}), 404
        
        with open(history_path, 'r') as f:
            history = json.load(f)
        
        for file_list in [history.get('fourier_files', []), history.get('cleaned_files', [])]:
            for restored_file in file_list:
                file_path = os.path.join(RESTORED_FOLDER, restored_file)
                if os.path.exists(file_path):
                    os.remove(file_path)
        
        for upload_file in os.listdir(UPLOAD_FOLDER):
            if upload_file.startswith(process_id):
                os.remove(os.path.join(UPLOAD_FOLDER, upload_file))
        
        os.remove(history_path)
        
        return jsonify({'success': True}), 200
    except Exception as e:
        print(f"Error in delete_history_entry: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/reprocess/<process_id>', methods=['POST'])
def reprocess_document(process_id):
    """Reprocess with new Fourier settings"""
    try:
        history_path = os.path.join(HISTORY_FOLDER, f"{process_id}.json")
        
        if not os.path.exists(history_path):
            return jsonify({'error': 'Process not found'}), 404
        
        with open(history_path, 'r') as f:
            history = json.load(f)
        
        radius = float(request.json.get('radius', history['settings']['radius']))
        alpha = float(request.json.get('alpha', history['settings']['alpha']))
        
        radius = max(10, min(100, radius))
        alpha = max(0.1, min(2.0, alpha))
        
        uploaded_file = None
        for upload_file in os.listdir(UPLOAD_FOLDER):
            if upload_file.startswith(process_id):
                uploaded_file = os.path.join(UPLOAD_FOLDER, upload_file)
                break
        
        if not uploaded_file or not os.path.exists(uploaded_file):
            return jsonify({'error': 'Original file not found'}), 404
        
        file_ext = uploaded_file.rsplit('.', 1)[1].lower()
        
        if file_ext == 'pdf':
            images = pdf_to_images(uploaded_file)
        else:
            img = cv2.imread(uploaded_file)
            images = [img]
        
        for file_list in [history.get('fourier_files', []), history.get('cleaned_files', [])]:
            for old_file in file_list:
                old_path = os.path.join(RESTORED_FOLDER, old_file)
                if os.path.exists(old_path):
                    os.remove(old_path)
        
        new_fourier_files = []
        for i, img in enumerate(images):
            fourier_restored = fourier_document_restoration(img, radius=radius, alpha=alpha)
            
            if file_ext == 'pdf':
                fourier_file = f"{process_id}_page_{i+1}_fourier.png"
            else:
                fourier_file = f"{process_id}_fourier.png"
            
            fourier_full_path = os.path.join(RESTORED_FOLDER, fourier_file)
            cv2.imwrite(fourier_full_path, fourier_restored)
            new_fourier_files.append(fourier_file)
        
        history['settings'] = {
            'radius': radius,
            'alpha': alpha,
            'cleaned': False,
            'cleaning_strength': None
        }
        history['fourier_files'] = new_fourier_files
        history['cleaned_files'] = []
        
        with open(history_path, 'w') as f:
            json.dump(history, f, indent=2)
        
        preview_path = f"/api/preview/{new_fourier_files[0]}"
        
        return jsonify({
            'success': True,
            'preview_url': preview_path,
            'fourier_files': new_fourier_files,
            'settings': history['settings']
        }), 200
    
    except Exception as e:
        print(f"Error in reprocess_document: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'}), 200


@app.errorhandler(500)
def internal_error(error):
    print(f"Internal server error: {error}")
    import traceback
    traceback.print_exc()
    return jsonify({'error': 'Internal server error', 'message': str(error)}), 500


@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting app on port {port}")
    app.run(debug=False, host='0.0.0.0', port=port, threaded=True)
