# Document Restoration App 📄✨

A powerful AI-powered application that removes shadows and cleans scanned documents using Fourier Transform and advanced image processing.

## Features ⭐

- **🌑 Shadow Removal**: Uses Fourier Transform to intelligently remove shadows from documents
- **🧹 Document Cleaning**: Removes color cast (yellow/orange tint) and smooths wrinkles
- **👀 Side-by-Side Preview**: Compare original, shadow-removed, and cleaned versions
- **📥 3-Level Cleaning**: Light, Medium, Heavy cleaning strengths
- **⚙️ Advanced Controls**: Fine-tune shadow removal with radius and strength parameters
- **📊 History Tracking**: Keep records of all processed documents
- **📥 Multiple Downloads**: Download as PNG or PDF
- **🎨 Modern UI**: Beautiful dark-themed interface with Tailwind CSS

## Screenshots 📸

### Main Processing Interface
- Original document (with shadows)
- Shadow-removed version (Fourier processing)
- Cleaned version (color cast removed)

### Optional Cleaning
- Light: Minimal color correction (40%)
- Medium: Moderate color correction (70%) - **Recommended**
- Heavy: Aggressive color correction (95%)

## How It Works 🔧

### Backend Architecture
1. **Shadow Removal (Fourier Transform)**
   - Converts image to LAB color space
   - Applies FFT (Fast Fourier Transform) to luminance channel
   - Removes low-frequency shadow patterns
   - Adjustable radius and strength parameters

2. **Document Cleaning**
   - Analyzes white paper color
   - Removes yellow/orange color cast
   - Minimal brightness adjustment (preserves contrast)
   - Optional wrinkle smoothing

### Frontend Architecture
- React with Vite (ultra-fast build)
- Tailwind CSS for styling
- Real-time preview comparison
- Lucide React icons

## Installation 🚀

### Prerequisites
- Python 3.8+
- Node.js 14+
- pip (Python package manager)
- npm (Node package manager)

### Backend Setup

```bash
# Navigate to project directory
cd document-restoration-app

# Create virtual environment (optional but recommended)
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Install additional packages (if not already installed)
npm install -D tailwindcss@3 postcss autoprefixer
npm install lucide-react
```

## Running the Application 🏃

### Terminal 1: Start Backend

```bash
# From project root directory
python app.py
```

You should see:
```
* Running on http://localhost:5000
```

### Terminal 2: Start Frontend

```bash
# From project root, navigate to frontend
cd frontend
npm run dev
```

You should see:
```
VITE v8.0.13  ready in 882 ms
➜  Local:   http://localhost:5173/
```

### Access the Application

Open your browser and go to:
```
http://localhost:5173/
```

## Usage Guide 📖

### Processing a Document

1. **Upload Document**
   - Drag and drop an image or click to browse
   - Supported formats: PNG, JPG, GIF, BMP, TIFF, PDF
   - Maximum size: 50MB

2. **Choose Shadow Level** (Optional)
   - **Light**: Gentle shadow removal (radius 30, strength 0.85)
   - **Medium**: Balanced removal (radius 40, strength 0.9) - Recommended
   - **Heavy**: Aggressive removal (radius 50, strength 1.0)

3. **Click "Remove Shadows"**
   - Processing takes a few seconds depending on document size
   - See the shadow-removed preview on the right

4. **Optional: Apply Cleaning** (Optional)
   - Choose cleaning strength:
     - **Light**: 40% color cast removal
     - **Medium**: 70% color cast removal (Recommended)
     - **Heavy**: 95% color cast removal
   - Click "Apply Cleaning"
   - See the cleaned preview

5. **Download**
   - **Download PNG**: High-quality PNG image
   - **Download PDF**: PDF document format

### Advanced Settings

Click "Advanced" to fine-tune:
- **Radius** (10-100): Higher = softer shadow removal
- **Strength** (0.1-2.0): Higher = more aggressive removal

### History

- All processed documents are saved
- View in "History" tab
- Download previous results
- Delete entries to save space

## Project Structure 📁

```
document-restoration-app/
├── app.py                              # Flask backend server
├── document_cleaning_conservative.py   # Cleaning algorithm
├── requirements.txt                    # Python dependencies
├── README.md                           # This file
├── .gitignore                          # Git ignore rules
├── uploads/                            # Temporary uploaded files
├── restored/                           # Processed images
├── history/                            # Processing history (JSON)
└── frontend/                           # React frontend
    ├── src/
    │   ├── App.jsx                    # Main app component
    │   ├── DocumentRestorationApp.jsx # Processing component
    │   ├── index.css                  # Global styles
    │   └── index.js                   # Entry point
    ├── tailwind.config.js             # Tailwind configuration
    ├── postcss.config.js              # PostCSS configuration
    ├── package.json                   # Frontend dependencies
    └── vite.config.js                 # Vite configuration
```

## Technologies Used 🛠️

### Backend
- **Flask**: Web framework
- **OpenCV (cv2)**: Image processing
- **NumPy**: Numerical computing
- **SciPy/FFT**: Fourier transforms
- **Pillow (PIL)**: Image handling
- **PyMuPDF (fitz)**: PDF processing
- **Flask-CORS**: Cross-origin requests

### Frontend
- **React**: UI framework
- **Vite**: Build tool
- **Tailwind CSS v3**: Styling
- **Lucide React**: Icons

## API Endpoints 🔌

### POST `/api/process`
Process a document with shadow removal.

**Parameters:**
- `file`: Image file (PNG, JPG, GIF, BMP, TIFF, PDF)
- `radius`: Shadow removal radius (10-100)
- `alpha`: Shadow removal strength (0.1-2.0)

**Response:**
```json
{
  "success": true,
  "process_id": "uuid",
  "shadow_intensity": "medium",
  "preview_url": "/api/preview/filename.png",
  "page_count": 1,
  "fourier_files": ["filename_fourier.png"]
}
```

### POST `/api/apply-cleaning/<process_id>`
Apply cleaning to a processed document.

**Body:**
```json
{
  "cleaning_strength": "medium"
}
```

### GET `/api/preview/<filename>`
Get preview image of processed document.

### GET `/api/download/<process_id>/<format>`
Download processed document.
- `format`: `original` (PNG) or `pdf` (PDF)

### GET `/api/history`
Get list of all processed documents.

### DELETE `/api/history/<process_id>`
Delete a history entry and related files.

### POST `/api/reprocess/<process_id>`
Reprocess with new shadow removal settings.

### GET `/health`
Health check endpoint.

## Troubleshooting 🔧

### Backend won't start
```bash
# Make sure dependencies are installed
pip install -r requirements.txt

# Check if port 5000 is already in use
# If so, modify app.py to use different port
```

### Frontend won't start
```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Make sure you have node 14+
node --version
```

### CORS errors
- Backend already has CORS enabled
- Make sure both frontend and backend are running
- Frontend: http://localhost:5173
- Backend: http://localhost:5000

### Large files fail
- Maximum file size is 50MB
- For larger files, split into multiple documents

### Cleaning makes image worse
- Try "Light" or "Medium" instead of "Heavy"
- Shadow Removal quality affects cleaning results

## Performance Tips ⚡

- **Smaller images process faster**: 2000x2500 is ideal
- **PNG format is faster than PDF**: PDFs process slower
- **Batch processing**: Process multiple documents in sequence
- **Clear history**: Delete old entries to free disk space

## System Requirements 💻

### Minimum
- CPU: 2 GHz dual-core processor
- RAM: 4GB
- Disk: 500MB free space

### Recommended
- CPU: 4-core processor
- RAM: 8GB
- Disk: 2GB free space
- GPU: Optional (for faster processing)

## Future Features 🚀

- [ ] Batch processing (multiple documents at once)
- [ ] GPU acceleration (CUDA support)
- [ ] OCR integration (extract text from documents)
- [ ] Auto-straighten skewed pages
- [ ] Advanced perspective correction
- [ ] Document segmentation
- [ ] Mobile app (React Native)

## Contributing 🤝

Found a bug or have a feature request?
1. Open an issue
2. Create a pull request with your improvements
3. Follow the code style of existing files

## License 📜

This project is open source and available under the MIT License.

## Credits 👏

- **Fourier Transform Algorithm**: Based on document restoration research
- **UI Design**: Inspired by modern document processing applications
- **Technology**: Built with Flask, React, and OpenCV

## Support 💬

- Having issues? Check the Troubleshooting section
- Want to improve the app? Contribute on GitHub!
- Found a bug? Open an issue with details

## Disclaimer ⚠️

This application is provided as-is. While it works well for most scanned documents, results may vary depending on:
- Image quality
- Shadow intensity
- Document type (handwritten vs printed)
- Paper texture

For official documents, always verify the cleaned version matches the original.

---

**Made with ❤️ for better document digitization**

Happy document restoring! 🎉
