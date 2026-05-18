import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Trash2, Settings, History, Eye, RotateCcw, AlertCircle } from 'lucide-react';

const DocumentRestorer = () => {
  const [activeTab, setActiveTab] = useState('restore');
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [restoredImageId, setRestoredImageId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewImageId, setPreviewImageId] = useState(null);
  const fileInputRef = useRef(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Settings
  const [radius, setRadius] = useState(40);
  const [alpha, setAlpha] = useState(0.9);
  const [shadowIntensity, setShadowIntensity] = useState('medium');

  // Load history on component mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/history');
      const data = await response.json();
      if (data.success) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileInput = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (file) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];

    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    const hasValidType = validTypes.includes(file.type);

    if (!hasValidExtension || !hasValidType) {
      setError('Please upload an image (JPG, PNG) or PDF file');
      setTimeout(() => setError(null), 4000);
      return;
    }

    setFile(file);
    setRestoredImageId(null);
    setPreview(null);
    setError(null);
  };

  const handleRestore = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('radius', radius);
    formData.append('alpha', alpha);
    formData.append('shadowIntensity', shadowIntensity);

    try {
      const response = await fetch('http://localhost:5000/api/restore', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setRestoredImageId(data.imageId);
        setSuccess('Document restored successfully!');
        setTimeout(() => setSuccess(null), 4000);
        
        // Reload history
        loadHistory();

        // Load preview
        loadPreview(data.imageId);
      } else {
        setError(data.error || 'Restoration failed');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const loadPreview = async (imageId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/preview/${imageId}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPreview(url);
    } catch (err) {
      console.error('Error loading preview:', err);
    }
  };

  const handleDownload = async (imageId, format = 'jpg') => {
    try {
      const endpoint = format === 'pdf' 
        ? `http://localhost:5000/api/download-pdf/${imageId}`
        : `http://localhost:5000/api/download/${imageId}`;

      const response = await fetch(endpoint);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `restored_document.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Download failed: ' + err.message);
    }
  };

  const handleDeleteFromHistory = async (imageId) => {
    if (!window.confirm('Are you sure you want to delete this item from history?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/history/${imageId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadHistory();
        setSuccess('Item deleted from history');
        setTimeout(() => setSuccess(null), 4000);
      } else {
        setError('Failed to delete item');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    }
  };

  const handlePreviewHistoryItem = (imageId) => {
    setPreviewImageId(imageId);
    loadPreview(imageId);
    setShowPreview(true);
  };

  const handleReprocessDocument = () => {
    if (restoredImageId) {
      setRestoredImageId(null);
      setPreview(null);
    }
  };

  const handleNewDocument = () => {
    setFile(null);
    setRestoredImageId(null);
    setPreview(null);
    setRadius(40);
    setAlpha(0.9);
    setShadowIntensity('medium');
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)' }}>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg" style={{ background: 'linear-gradient(135deg, #00d4ff 0%, #0099ff 100%)' }}></div>
            <h1 className="text-3xl font-bold text-white">DocRestore</h1>
          </div>
          <p className="text-gray-400">Remove shadows from scanned documents using advanced Fourier analysis</p>
        </div>
      </header>

      {/* Alerts */}
      {error && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="flex items-center gap-3 p-4 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', color: '#fca5a5' }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div className="flex items-center gap-3 p-4 rounded-lg" style={{ background: 'rgba(34, 197, 94, 0.1)', borderLeft: '4px solid #22c55e', color: '#86efac' }}>
            <span>✓ {success}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setActiveTab('restore')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'restore'
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            style={{
              background: activeTab === 'restore' ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
              borderBottom: activeTab === 'restore' ? '2px solid #00d4ff' : 'none'
            }}
          >
            <Upload className="inline mr-2" size={18} />
            Restore Document
          </button>
          <button
            onClick={() => { setActiveTab('history'); loadHistory(); }}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'history'
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            style={{
              background: activeTab === 'history' ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
              borderBottom: activeTab === 'history' ? '2px solid #00d4ff' : 'none'
            }}
          >
            <History className="inline mr-2" size={18} />
            History ({history.length})
          </button>
        </div>

        {/* Restore Tab */}
        {activeTab === 'restore' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Upload & Settings */}
            <div className="lg:col-span-2">
              {/* Upload Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`relative p-8 rounded-lg border-2 border-dashed transition-all cursor-pointer ${
                  isDragging
                    ? 'border-blue-500 bg-blue-500 bg-opacity-5'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileInput}
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                />
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0, 212, 255, 0.1)' }}>
                    <Upload size={32} className="text-cyan-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Drop your document here</h3>
                  <p className="text-gray-400 mb-4">or click to browse • Supports JPG, PNG, PDF</p>
                  {file && <p className="text-green-400 font-medium">✓ {file.name}</p>}
                </div>
              </div>

              {/* Settings Panel */}
              <div className="mt-8 p-6 rounded-lg" style={{ background: 'rgba(0, 212, 255, 0.05)', border: '1px solid rgba(0, 212, 255, 0.1)' }}>
                <div className="flex items-center gap-2 mb-6">
                  <Settings size={20} className="text-cyan-400" />
                  <h3 className="text-lg font-semibold text-white">Settings</h3>
                </div>

                {/* Shadow Intensity */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-3">Shadow Intensity</label>
                  <div className="flex gap-3">
                    {['light', 'medium', 'heavy'].map(intensity => (
                      <button
                        key={intensity}
                        onClick={() => setShadowIntensity(intensity)}
                        className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all ${
                          shadowIntensity === intensity
                            ? 'text-white'
                            : 'text-gray-400'
                        }`}
                        style={{
                          background: shadowIntensity === intensity 
                            ? 'rgba(0, 212, 255, 0.2)'
                            : 'rgba(255, 255, 255, 0.05)'
                        }}
                      >
                        {intensity.charAt(0).toUpperCase() + intensity.slice(1)}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Choose based on shadow strength in your document</p>
                </div>

                {/* Radius Slider */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-medium text-gray-300">Filter Radius</label>
                    <span className="text-sm text-cyan-400 font-semibold">{radius}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={radius}
                    onChange={(e) => setRadius(parseInt(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: 'linear-gradient(to right, rgba(0, 212, 255, 0.3), rgba(0, 212, 255, 0.8))'
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-2">Controls shadow detection sensitivity (10-100)</p>
                </div>

                {/* Alpha Slider */}
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-medium text-gray-300">Correction Strength</label>
                    <span className="text-sm text-cyan-400 font-semibold">{alpha.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={alpha}
                    onChange={(e) => setAlpha(parseFloat(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: 'linear-gradient(to right, rgba(0, 212, 255, 0.3), rgba(0, 212, 255, 0.8))'
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-2">Illumination correction intensity (0.5-1.5)</p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleRestore}
                    disabled={!file || isProcessing}
                    className="flex-1 py-3 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, #00d4ff 0%, #0099ff 100%)'
                    }}
                  >
                    {isProcessing ? 'Processing...' : 'Restore Document'}
                  </button>
                  {restoredImageId && (
                    <button
                      onClick={handleReprocessDocument}
                      className="py-3 px-6 rounded-lg font-semibold text-cyan-400 border border-cyan-400 hover:bg-cyan-400 hover:text-white transition-all"
                    >
                      <RotateCcw size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Preview */}
            {restoredImageId && preview && (
              <div className="lg:col-span-1">
                <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
                  <div className="aspect-square overflow-auto">
                    <img src={preview} alt="Restored" className="w-full h-full object-contain p-4" />
                  </div>
                  <div className="p-4 border-t" style={{ borderColor: 'rgba(0, 212, 255, 0.2)' }}>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button
                        onClick={() => handleDownload(restoredImageId, 'jpg')}
                        className="py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all flex items-center justify-center gap-2"
                      >
                        <Download size={16} />
                        JPG
                      </button>
                      <button
                        onClick={() => handleDownload(restoredImageId, 'pdf')}
                        className="py-2 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all flex items-center justify-center gap-2"
                      >
                        <Download size={16} />
                        PDF
                      </button>
                    </div>
                    <button
                      onClick={handleNewDocument}
                      className="w-full py-2 px-3 rounded-lg text-gray-300 hover:text-white border border-gray-600 hover:border-gray-500 font-medium transition-all"
                    >
                      Process New Document
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div>
            {history.length === 0 ? (
              <div className="text-center py-12">
                <History size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400 text-lg">No restoration history yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg overflow-hidden transition-all hover:shadow-lg"
                    style={{ background: 'rgba(0, 212, 255, 0.05)', border: '1px solid rgba(0, 212, 255, 0.1)' }}
                  >
                    <div className="aspect-square bg-black bg-opacity-50 flex items-center justify-center p-4 cursor-pointer hover:bg-opacity-70 transition-all" onClick={() => handlePreviewHistoryItem(item.id)}>
                      <Eye size={32} className="text-cyan-400" />
                    </div>
                    <div className="p-4">
                      <h3 className="text-sm font-semibold text-white truncate mb-2">{item.originalName}</h3>
                      <p className="text-xs text-gray-500 mb-4">
                        {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString()}
                      </p>
                      <div className="text-xs text-gray-400 mb-4 space-y-1">
                        <p>Radius: {item.settings.radius}</p>
                        <p>Alpha: {item.settings.alpha}</p>
                        <p>Intensity: {item.settings.shadowIntensity}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDownload(item.id, 'jpg')}
                          className="flex-1 py-2 px-2 rounded text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all"
                        >
                          JPG
                        </button>
                        <button
                          onClick={() => handleDownload(item.id, 'pdf')}
                          className="flex-1 py-2 px-2 rounded text-xs bg-red-600 hover:bg-red-700 text-white font-medium transition-all"
                        >
                          PDF
                        </button>
                        <button
                          onClick={() => handleDeleteFromHistory(item.id)}
                          className="py-2 px-2 rounded text-xs bg-red-900 hover:bg-red-800 text-red-300 font-medium transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Preview</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-6">
              {preview && <img src={preview} alt="Preview" className="max-w-full max-h-full" />}
            </div>
            <div className="p-6 border-t border-gray-700 flex gap-3">
              <button
                onClick={() => handleDownload(previewImageId, 'jpg')}
                className="flex-1 py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Download JPG
              </button>
              <button
                onClick={() => handleDownload(previewImageId, 'pdf')}
                className="flex-1 py-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentRestorer;