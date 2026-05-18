import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Download, Settings, RotateCcw, Trash2, Eye, History, AlertCircle, CheckCircle, Loader } from 'lucide-react';

const DocumentRestorationApp = () => {
  const [activeTab, setActiveTab] = useState('processor');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processId, setProcessId] = useState(null);
  const [shadowIntensity, setShadowIntensity] = useState(null);
  const [pageCount, setPageCount] = useState(1);
  
  // Settings
  const [radius, setRadius] = useState(40);
  const [alpha, setAlpha] = useState(0.9);
  const [shadowLevel, setShadowLevel] = useState('auto');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // History
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Messages
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('info');
  
  const dropZoneRef = useRef(null);

  // Fetch history on tab change
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const showMessage = (text, type = 'info') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(null), 5000);
  };

  // Shadow level presets
  const shadowPresets = {
    light: { radius: 30, alpha: 0.85 },
    medium: { radius: 40, alpha: 0.9 },
    heavy: { radius: 50, alpha: 1.0 }
  };

  const applyShadowPreset = (level) => {
    if (level !== 'auto' && shadowPresets[level]) {
      const preset = shadowPresets[level];
      setRadius(preset.radius);
      setAlpha(preset.alpha);
      setShadowLevel(level);
      showMessage(`Applied ${level} shadow preset`);
    }
  };

  // Drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dropZoneRef.current?.classList.remove('drag-over');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove('drag-over');
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleFileSelect = (selectedFile) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/bmp', 'image/tiff', 'application/pdf'];
    
    if (!allowedTypes.includes(selectedFile.type)) {
      showMessage('File type not supported. Please upload an image or PDF.', 'error');
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      showMessage('File is too large. Maximum size is 50MB.', 'error');
      return;
    }

    setFile(selectedFile);
    setProcessId(null);
    setPreview(null);
    setShadowIntensity(null);
    setPageCount(1);
    showMessage('File selected: ' + selectedFile.name, 'success');
  };

  const processDocument = async () => {
    if (!file) {
      showMessage('Please select a file first', 'error');
      return;
    }

    setProcessing(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('radius', radius);
      formData.append('alpha', alpha);

      const response = await fetch('http://localhost:5000/api/process', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Processing failed');
      }

      setProcessId(data.process_id);
      setShadowIntensity(data.shadow_intensity);
      setPageCount(data.page_count);
      setPreview(data.preview_url);
      showMessage('Document processed successfully!', 'success');
    } catch (error) {
      showMessage('Error: ' + error.message, 'error');
      console.error('Processing error:', error);
    } finally {
      setProcessing(false);
    }
  };

  const reprocessDocument = async () => {
    if (!processId) return;

    setProcessing(true);

    try {
      const response = await fetch(`http://localhost:5000/api/reprocess/${processId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ radius, alpha })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Reprocessing failed');
      }

      setPreview(data.preview_url);
      showMessage('Document reprocessed successfully!', 'success');
    } catch (error) {
      showMessage('Error: ' + error.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const downloadDocument = async (format) => {
    if (!processId) return;

    try {
      const response = await fetch(`http://localhost:5000/api/download/${processId}/${format}`);
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'pdf' ? 'document.pdf' : 'document.png';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showMessage(`Downloaded as ${format.toUpperCase()}`, 'success');
    } catch (error) {
      showMessage('Download failed: ' + error.message, 'error');
    }
  };

  const resetProcessor = () => {
    setFile(null);
    setPreview(null);
    setProcessId(null);
    setShadowIntensity(null);
    setPageCount(1);
    setRadius(40);
    setAlpha(0.9);
    setShadowLevel('auto');
    showMessage('Reset complete. Ready for new document.', 'success');
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/history');
      const data = await response.json();
      setHistory(data.history || []);
    } catch (error) {
      showMessage('Failed to load history', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteHistoryEntry = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;

    try {
      const response = await fetch(`http://localhost:5000/api/history/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Deletion failed');
      }

      setHistory(history.filter(item => item.id !== id));
      showMessage('Entry deleted', 'success');
    } catch (error) {
      showMessage('Failed to delete: ' + error.message, 'error');
    }
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString();
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">
            Document Restorer
          </h1>
          <p className="text-slate-400 text-lg">Remove shadows from scanned documents using advanced Fourier analysis</p>
        </div>

        {/* Message Alert */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            messageType === 'error' ? 'bg-red-900/30 text-red-200 border border-red-700' :
            messageType === 'success' ? 'bg-emerald-900/30 text-emerald-200 border border-emerald-700' :
            'bg-blue-900/30 text-blue-200 border border-blue-700'
          }`}>
            {messageType === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            {message}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('processor')}
            className={`px-6 py-3 font-semibold text-lg transition-all ${
              activeTab === 'processor'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Upload className="inline mr-2" size={20} />
            Processor
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-semibold text-lg transition-all ${
              activeTab === 'history'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <History className="inline mr-2" size={20} />
            History
          </button>
        </div>

        {/* Processor Tab */}
        {activeTab === 'processor' && (
          <div className="grid md:grid-cols-3 gap-8">
            {/* Left Column - Upload & Preview */}
            <div className="md:col-span-2">
              {!processId ? (
                <div
                  ref={dropZoneRef}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-slate-600 rounded-xl p-12 text-center cursor-pointer transition-all hover:border-blue-500 hover:bg-blue-500/5 drag-over:border-blue-500 drag-over:bg-blue-500/10"
                >
                  <input
                    type="file"
                    onChange={handleFileInput}
                    accept=".png,.jpg,.jpeg,.gif,.bmp,.tiff,.pdf"
                    className="hidden"
                    id="file-input"
                  />
                  <label htmlFor="file-input" className="cursor-pointer block">
                    <Upload className="mx-auto mb-4 text-slate-400" size={48} />
                    <p className="text-white text-lg font-semibold mb-2">
                      Drag and drop your document here
                    </p>
                    <p className="text-slate-400 mb-4">
                      or click to browse
                    </p>
                    <p className="text-slate-500 text-sm">
                      Supports PNG, JPG, GIF, BMP, TIFF, PDF (Max 50MB)
                    </p>
                  </label>
                </div>
              ) : (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
                  <h3 className="text-white text-xl font-semibold mb-4">Preview</h3>
                  {preview ? (
                    <div className="mb-6">
                      <img 
                        src={preview} 
                        alt="Restored document preview"
                        className="w-full rounded-lg border border-slate-700 shadow-lg"
                      />
                      <p className="text-slate-400 text-sm mt-4">
                        Shadow Intensity: <span className="text-white font-semibold capitalize">{shadowIntensity}</span>
                        {pageCount > 1 && ` • Pages: ${pageCount}`}
                      </p>
                    </div>
                  ) : null}
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => downloadDocument('original')}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={18} />
                      PNG
                    </button>
                    <button
                      onClick={() => downloadDocument('pdf')}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={18} />
                      PDF
                    </button>
                  </div>
                </div>
              )}

              {file && !processId && (
                <div className="mt-6 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <p className="text-slate-300 mb-4">
                    <span className="text-slate-400">File:</span> {file.name}
                  </p>
                  <button
                    onClick={processDocument}
                    disabled={processing}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    {processing ? <Loader size={18} className="animate-spin" /> : <Upload size={18} />}
                    {processing ? 'Processing...' : 'Process Document'}
                  </button>
                </div>
              )}

              {processId && (
                <button
                  onClick={resetProcessor}
                  className="w-full mt-6 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw size={18} />
                  Process Another Document
                </button>
              )}
            </div>

            {/* Right Column - Settings */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-white text-xl font-semibold mb-6 flex items-center gap-2">
                <Settings size={20} />
                Settings
              </h3>

              {/* Shadow Level Presets */}
              <div className="mb-6">
                <label className="text-slate-300 font-semibold block mb-3">
                  Shadow Intensity
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['light', 'medium', 'heavy'].map(level => (
                    <button
                      key={level}
                      onClick={() => applyShadowPreset(level)}
                      className={`py-2 rounded-lg font-semibold transition-all capitalize ${
                        shadowLevel === level
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setShadowLevel('auto'); }}
                  className={`w-full mt-2 py-2 rounded-lg font-semibold transition-all ${
                    shadowLevel === 'auto'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Auto Detect
                </button>
              </div>

              {/* Advanced Settings */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full text-left text-slate-300 hover:text-white font-semibold py-2 mb-4 flex items-center justify-between"
              >
                Advanced Settings
                <span className="text-sm">{showAdvanced ? '▼' : '▶'}</span>
              </button>

              {showAdvanced && (
                <div className="space-y-4 pb-4 border-b border-slate-700 mb-4">
                  {/* Radius Slider */}
                  <div>
                    <label className="text-slate-300 font-semibold block mb-2 text-sm">
                      Filter Radius: {radius}
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={radius}
                      onChange={(e) => setRadius(Number(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-slate-500 text-xs mt-1">Lower = sharper, Higher = smoother shadows</p>
                  </div>

                  {/* Alpha Slider */}
                  <div>
                    <label className="text-slate-300 font-semibold block mb-2 text-sm">
                      Correction Strength: {alpha.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="2.0"
                      step="0.1"
                      value={alpha}
                      onChange={(e) => setAlpha(Number(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-slate-500 text-xs mt-1">Controls restoration intensity</p>
                  </div>
                </div>
              )}

              {processId && (
                <button
                  onClick={reprocessDocument}
                  disabled={processing}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50 text-white py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {processing ? <Loader size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                  {processing ? 'Reprocessing...' : 'Reprocess'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin text-blue-500" size={40} />
              </div>
            ) : history.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
                <History className="mx-auto text-slate-500 mb-4" size={48} />
                <p className="text-slate-400">No processed documents yet</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {history.map(item => (
                  <div key={item.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <div className="grid md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-slate-400 text-sm">Filename</p>
                        <p className="text-white font-semibold">{item.original_filename}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm">Date</p>
                        <p className="text-white font-semibold">{formatDate(item.timestamp)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm">Shadow Level</p>
                        <p className="text-white font-semibold capitalize">{item.shadow_intensity}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm">Pages</p>
                        <p className="text-white font-semibold">{item.page_count}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={() => downloadDocument('original')}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <Download size={16} />
                        PNG
                      </button>
                      <button
                        onClick={() => downloadDocument('pdf')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <Download size={16} />
                        PDF
                      </button>
                      <button
                        onClick={() => deleteHistoryEntry(item.id)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentRestorationApp;