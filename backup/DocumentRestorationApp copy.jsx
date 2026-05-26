import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Settings, RotateCcw, Trash2, History, AlertCircle, CheckCircle, Loader, Sparkles, HelpCircle, Book } from 'lucide-react';

const DocumentRestorationApp = () => {
  const [activeTab, setActiveTab] = useState('processor');
  const [file, setFile] = useState(null);
  const [fourierPreview, setFourierPreview] = useState(null);
  const [cleanedPreview, setCleanedPreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processId, setProcessId] = useState(null);
  const [shadowIntensity, setShadowIntensity] = useState(null);
  const [pageCount, setPageCount] = useState(1);
  
  const [radius, setRadius] = useState(40);
  const [alpha, setAlpha] = useState(0.9);
  const [shadowLevel, setShadowLevel] = useState('auto');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [cleaningStrength, setCleaningStrength] = useState('medium');
  const [isCleaned, setIsCleaned] = useState(false);
  
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('info');
  
  const dropZoneRef = useRef(null);

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

  const handleDragOver = (e) => {
    e.preventDefault();
    dropZoneRef.current?.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dropZoneRef.current?.classList.remove('drag-over');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleFileInput = (e) => {
    if (e.target.files[0]) handleFileSelect(e.target.files[0]);
  };

  const handleFileSelect = (selectedFile) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/bmp', 'image/tiff', 'application/pdf'];
    
    if (!allowedTypes.includes(selectedFile.type)) {
      showMessage('File type not supported.', 'error');
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      showMessage('File is too large (max 50MB).', 'error');
      return;
    }
    setFile(selectedFile);
    setProcessId(null);
    setFourierPreview(null);
    setCleanedPreview(null);
    setIsCleaned(false);
    showMessage('File selected: ' + selectedFile.name, 'success');
  };

  const processDocument = async () => {
    if (!file) {
      showMessage('Please select a file first', 'error');
      return;
    }
    setProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('radius', radius);
      formData.append('alpha', alpha);

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/process`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setProcessId(data.process_id);
      setShadowIntensity(data.shadow_intensity);
      setPageCount(data.page_count);
      setFourierPreview(data.preview_url);
      setCleanedPreview(null);
      setIsCleaned(false);
      showMessage('Shadow removal complete!', 'success');
    } catch (error) {
      showMessage('Error: ' + error.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const applyCleaning = async () => {
    if (!processId) return;
    setProcessing(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/apply-cleaning/${processId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cleaning_strength: cleaningStrength })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setCleanedPreview(data.preview_url);
      setIsCleaned(true);
      showMessage(`Cleaning applied!`, 'success');
    } catch (error) {
      showMessage('Error applying cleaning: ' + error.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const reprocessDocument = async () => {
    if (!processId) return;
    setProcessing(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/reprocess/${processId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ radius, alpha })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setFourierPreview(data.preview_url);
      setCleanedPreview(null);
      setIsCleaned(false);
      showMessage('Reprocessed with new settings!', 'success');
    } catch (error) {
      showMessage('Error: ' + error.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const downloadShadowRemoved = async () => {
    if (!processId) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/download/${processId}/original`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crop: false })
      });
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document_shadow_removed.png';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showMessage('Downloaded shadow-removed version', 'success');
    } catch (error) {
      showMessage('Download failed', 'error');
    }
  };

  const downloadCleaned = async () => {
    if (!processId || !isCleaned) {
      showMessage('Please apply cleaning first', 'error');
      return;
    }
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/download/${processId}/original`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crop: false })
      });
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document_cleaned.png';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showMessage('Downloaded cleaned version', 'success');
    } catch (error) {
      showMessage('Download failed', 'error');
    }
  };

  const downloadPDF = async (version = 'shadow-removed') => {
    if (!processId) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/download/${processId}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crop: false })
      });
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document_${version}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showMessage(`Downloaded ${version} PDF`, 'success');
    } catch (error) {
      showMessage('Download failed', 'error');
    }
  };

  const resetProcessor = () => {
    setFile(null);
    setFourierPreview(null);
    setCleanedPreview(null);
    setProcessId(null);
    setShadowIntensity(null);
    setRadius(40);
    setAlpha(0.9);
    setShadowLevel('auto');
    setCleaningStrength('medium');
    setIsCleaned(false);
    showMessage('Ready for new document', 'success');
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/history`);
      const data = await response.json();
      setHistory(data.history || []);
    } catch (error) {
      showMessage('Failed to load history', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteHistoryEntry = async (id) => {
    if (!window.confirm('Delete this entry?')) return;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/history/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Deletion failed');

      setHistory(history.filter(item => item.id !== id));
      showMessage('Entry deleted', 'success');
    } catch (error) {
      showMessage('Failed to delete', 'error');
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">Document Restorer</h1>
          <p className="text-slate-400 text-lg">Remove shadows, clean documents, and download</p>
        </div>

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

        <div className="flex gap-4 mb-8 border-b border-slate-700 flex-wrap">
          <button
            onClick={() => setActiveTab('processor')}
            className={`px-6 py-3 font-semibold text-lg ${activeTab === 'processor' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400'}`}
          >
            Processor
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-semibold text-lg ${activeTab === 'history' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400'}`}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab('help')}
            className={`px-6 py-3 font-semibold text-lg flex items-center gap-2 ${activeTab === 'help' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400'}`}
          >
            <HelpCircle size={20} />
            Help & Guide
          </button>
        </div>

        {activeTab === 'processor' && (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              {!processId ? (
                <div
                  ref={dropZoneRef}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-slate-600 rounded-xl p-12 text-center cursor-pointer hover:border-blue-500 transition"
                >
                  <input type="file" onChange={handleFileInput} accept=".png,.jpg,.jpeg,.gif,.bmp,.tiff,.pdf" className="hidden" id="file-input" />
                  <label htmlFor="file-input" className="cursor-pointer block">
                    <Upload className="mx-auto mb-4 text-slate-400" size={48} />
                    <p className="text-white text-lg font-semibold mb-2">Drag and drop your document</p>
                    <p className="text-slate-400 mb-4">or click to browse</p>
                    <p className="text-slate-500 text-sm">Supports PNG, JPG, GIF, BMP, TIFF, PDF (Max 50MB)</p>
                  </label>
                </div>
              ) : (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
                  <h3 className="text-white text-xl font-semibold mb-6">Preview Comparison</h3>
                  
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {file && (
                      <div>
                        <p className="text-slate-400 text-sm mb-2 font-semibold text-center">Original</p>
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="Original" 
                          className="w-full rounded-lg border border-slate-700 max-h-48 object-cover"
                        />
                      </div>
                    )}
                    
                    {fourierPreview && (
                      <div>
                        <p className="text-blue-400 text-sm mb-2 font-semibold text-center">Shadow Removed</p>
                        <img 
                          src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${fourierPreview}`} 
                          alt="Shadow Removed" 
                          className="w-full rounded-lg border border-blue-600 max-h-48 object-cover"
                        />
                      </div>
                    )}
                    
                    {cleanedPreview && (
                      <div>
                        <p className="text-emerald-400 text-sm mb-2 font-semibold text-center">Cleaned</p>
                        <img 
                          src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${cleanedPreview}`} 
                          alt="Cleaned" 
                          className="w-full rounded-lg border border-emerald-600 max-h-48 object-cover"
                        />
                      </div>
                    )}
                  </div>
                  
                  {processId && (
                    <div className="space-y-4">
                      <div className="bg-slate-700/50 p-4 rounded-lg">
                        <h4 className="text-white font-semibold mb-3">Download Options</h4>
                        
                        <div className="mb-4 pb-4 border-b border-slate-600">
                          <p className="text-slate-300 text-sm mb-3 font-semibold">Shadow Removed:</p>
                          <div className="space-y-2">
                            <button 
                              onClick={() => downloadShadowRemoved()}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold"
                            >
                              <Download className="inline mr-2" size={16} />
                              Download PNG
                            </button>
                            <button 
                              onClick={() => downloadPDF('shadow-removed')}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold"
                            >
                              <Download className="inline mr-2" size={16} />
                              Download PDF
                            </button>
                          </div>
                        </div>
                        
                        {isCleaned && (
                          <div>
                            <p className="text-slate-300 text-sm mb-3 font-semibold">Cleaned:</p>
                            <div className="space-y-2">
                              <button 
                                onClick={() => downloadCleaned()}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-semibold"
                              >
                                <Download className="inline mr-2" size={16} />
                                Download PNG
                              </button>
                              <button 
                                onClick={() => downloadPDF('cleaned')}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-semibold"
                              >
                                <Download className="inline mr-2" size={16} />
                                Download PDF
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {file && !processId && (
                <div className="mt-6 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <p className="text-slate-300 mb-4 font-semibold">{file.name}</p>
                  <button onClick={processDocument} disabled={processing} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white py-3 rounded-lg font-semibold transition">
                    {processing ? 'Processing...' : 'Remove Shadows'}
                  </button>
                </div>
              )}

              {processId && (
                <div className="mt-6">
                  <button onClick={resetProcessor} className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition">
                    Process Another Document
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <h3 className="text-white text-lg font-semibold mb-4">Shadow Removal</h3>

                <div className="mb-6">
                  <label className="text-slate-300 font-semibold block mb-3">Shadow Level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['light', 'medium', 'heavy'].map(level => (
                      <button key={level} onClick={() => applyShadowPreset(level)} className={`py-2 rounded-lg font-semibold text-sm transition ${shadowLevel === level ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full text-left text-slate-300 font-semibold py-2 hover:text-white transition">
                  Advanced {showAdvanced ? '▼' : '▶'}
                </button>

                {showAdvanced && (
                  <div className="space-y-4 pt-4 border-t border-slate-700 mt-4">
                    <div>
                      <label className="text-slate-300 font-semibold block mb-2 text-sm">Radius: {radius}</label>
                      <input type="range" min="10" max="100" step="5" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
                    </div>
                    <div>
                      <label className="text-slate-300 font-semibold block mb-2 text-sm">Strength: {alpha.toFixed(2)}</label>
                      <input type="range" min="0.1" max="2.0" step="0.1" value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} className="w-full" />
                    </div>
                  </div>
                )}

                {processId && (
                  <button onClick={reprocessDocument} disabled={processing} className="w-full mt-6 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 text-white py-3 rounded-lg font-semibold transition">
                    {processing ? 'Reprocessing...' : 'Reprocess Shadows'}
                  </button>
                )}
              </div>

              {processId && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                    <Sparkles size={20} />
                    Optional Cleaning
                  </h3>

                  <p className="text-slate-400 text-sm mb-4">
                    Add gentle cleaning to remove color cast.
                  </p>

                  <div className="mb-4">
                    <label className="text-slate-300 font-semibold block mb-2 text-sm">Cleaning Strength</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['light', 'medium', 'heavy'].map(level => (
                        <button
                          key={level}
                          onClick={() => setCleaningStrength(level)}
                          className={`py-2 rounded-lg font-semibold text-xs transition ${
                            cleaningStrength === level
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={applyCleaning} 
                    disabled={processing || isCleaned}
                    className={`w-full py-3 rounded-lg font-semibold transition ${
                      isCleaned 
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {processing ? 'Cleaning...' : isCleaned ? 'Cleaning Applied' : 'Apply Cleaning'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-12"><Loader className="animate-spin text-blue-500" size={40} /></div>
            ) : history.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
                <p className="text-slate-400">No processed documents yet</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {history.map(item => (
                  <div key={item.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <div className="grid md:grid-cols-5 gap-4 mb-4">
                      <div><p className="text-slate-400 text-sm">Filename</p><p className="text-white font-semibold text-sm truncate">{item.original_filename}</p></div>
                      <div><p className="text-slate-400 text-sm">Date</p><p className="text-white font-semibold text-sm">{new Date(item.timestamp).toLocaleDateString()}</p></div>
                      <div><p className="text-slate-400 text-sm">Shadow</p><p className="text-white font-semibold text-sm capitalize">{item.shadow_intensity}</p></div>
                      <div><p className="text-slate-400 text-sm">Cleaned</p><p className="text-white font-semibold text-sm capitalize">{item.settings.cleaned ? 'Yes' : 'No'}</p></div>
                      <div><p className="text-slate-400 text-sm">Pages</p><p className="text-white font-semibold text-sm">{item.page_count}</p></div>
                    </div>
                    <button onClick={() => deleteHistoryEntry(item.id)} className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-semibold transition">Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'help' && (
          <div className="max-w-4xl">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 space-y-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Book size={28} />
                How to Use
              </h2>

              <div className="space-y-4">
                <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                  <h3 className="text-white font-semibold mb-2">Step 1: Upload Document</h3>
                  <p className="text-slate-300 text-sm">Drag and drop or click to browse. PNG, JPG, PDF, etc. (Max 50MB)</p>
                </div>

                <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                  <h3 className="text-white font-semibold mb-2">Step 2: Remove Shadows</h3>
                  <p className="text-slate-300 text-sm">Choose light, medium, or heavy shadow removal level. Use advanced settings for fine-tuning.</p>
                </div>

                <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                  <h3 className="text-white font-semibold mb-2">Step 3: Optional Cleaning</h3>
                  <p className="text-slate-300 text-sm">Apply cleaning to remove color cast and improve clarity. Choose your preferred strength.</p>
                </div>

                <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                  <h3 className="text-white font-semibold mb-2">Step 4: Download</h3>
                  <p className="text-slate-300 text-sm">Download your processed document as PNG or PDF. You can download both shadow-removed and cleaned versions.</p>
                </div>

                <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                  <h3 className="text-white font-semibold mb-2">Tip: View History</h3>
                  <p className="text-slate-300 text-sm">Check the History tab to see all your previously processed documents.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentRestorationApp;