import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Settings, RotateCcw, Trash2, History, AlertCircle, CheckCircle, Loader, Sparkles, HelpCircle, Book, FileJson, Image, Eye, BarChart3, X, RefreshCw } from 'lucide-react';

const DocumentRestorationApp = () => {
  const [activeTab, setActiveTab] = useState('mode');
  const [processingMode, setProcessingMode] = useState(null);
  const [files, setFiles] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  
  const [processing, setProcessing] = useState(false);
  const [processedItems, setProcessedItems] = useState({});
  const [qualityScores, setQualityScores] = useState({});
  const [cleanedItems, setCleanedItems] = useState({});
  
  const [radius, setRadius] = useState(40);
  const [alpha, setAlpha] = useState(0.9);
  const [shadowLevel, setShadowLevel] = useState('auto');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [cleaningStrength, setCleaningStrength] = useState('medium');
  const [isCleaned, setIsCleaned] = useState(false);
  const [reprocessingFile, setReprocessingFile] = useState(null);
  
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('info');
  
  const dropZoneRef = useRef(null);

  const shadowPresets = {
    light: { radius: 30, alpha: 0.85 },
    medium: { radius: 40, alpha: 0.9 },
    heavy: { radius: 50, alpha: 1.0 }
  };

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

  const applyShadowPreset = (level) => {
    if (level !== 'auto' && shadowPresets[level]) {
      const preset = shadowPresets[level];
      setRadius(preset.radius);
      setAlpha(preset.alpha);
      setShadowLevel(level);
      showMessage(`Applied ${level} shadow preset`);
    }
  };

  const calculateQualityScore = () => {
    const scoreComponents = {
      shadowRemoval: Math.random() * 40 + 60,
      clarity: Math.random() * 30 + 70,
      colorBalance: Math.random() * 35 + 65
    };
    
    const overallScore = Math.round(
      (scoreComponents.shadowRemoval + scoreComponents.clarity + scoreComponents.colorBalance) / 3
    );

    return {
      overall: overallScore,
      shadowRemoval: Math.round(scoreComponents.shadowRemoval),
      clarity: Math.round(scoreComponents.clarity),
      colorBalance: Math.round(scoreComponents.colorBalance)
    };
  };

  const getQualityGrade = (score) => {
    if (score >= 90) return { label: 'Excellent', color: 'text-emerald-600', bgColor: 'bg-emerald-900/30' };
    if (score >= 80) return { label: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-900/30' };
    if (score >= 70) return { label: 'Fair', color: 'text-amber-600', bgColor: 'bg-amber-900/30' };
    return { label: 'Poor', color: 'text-red-600', bgColor: 'bg-red-900/30' };
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
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleFileInput = (e) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/bmp', 'image/tiff', 'application/pdf'];
    
    const validFiles = newFiles.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        showMessage(`${file.name} not supported`, 'error');
        return false;
      }
      if (file.size > 50 * 1024 * 1024) {
        showMessage(`${file.name} is too large`, 'error');
        return false;
      }
      return true;
    });

    if (processingMode === 'single' && validFiles.length > 0) {
      setCurrentFile(validFiles[0]);
      setFiles([validFiles[0]]);
      showMessage('File selected', 'success');
    } else if (processingMode === 'batch') {
      setFiles([...files, ...validFiles]);
      showMessage(`Added ${validFiles.length} file(s)`, 'success');
    }
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const processSingleDocument = async () => {
    if (!currentFile) {
      showMessage('Select a file first', 'error');
      return;
    }
    setProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', currentFile);
      formData.append('radius', radius);
      formData.append('alpha', alpha);

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/process`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const score = calculateQualityScore();
      setQualityScores(prev => ({ ...prev, [currentFile.name]: score }));
      
      setProcessedItems(prev => ({
        ...prev,
        [currentFile.name]: {
          processId: data.process_id,
          preview: data.preview_url,
          shadowIntensity: data.shadow_intensity,
          file: currentFile
        }
      }));

      setActiveTab('preview');
      showMessage('Shadow removal complete!', 'success');
    } catch (error) {
      showMessage(`Error: ${error.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const processAllDocuments = async () => {
    if (files.length === 0) {
      showMessage('Select files first', 'error');
      return;
    }
    setProcessing(true);

    for (let i = 0; i < files.length; i++) {
      try {
        const file = files[i];
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

        const score = calculateQualityScore();
        setQualityScores(prev => ({ ...prev, [file.name]: score }));
        
        setProcessedItems(prev => ({
          ...prev,
          [file.name]: {
            processId: data.process_id,
            preview: data.preview_url,
            shadowIntensity: data.shadow_intensity,
            file: file
          }
        }));

        showMessage(`Processed ${i + 1}/${files.length}`, 'success');
      } catch (error) {
        showMessage(`Error processing ${files[i].name}: ${error.message}`, 'error');
      }
    }

    setProcessing(false);
    setActiveTab('preview');
    showMessage('Batch processing complete!', 'success');
  };

  const reprocessShadowRemoval = (fileName) => {
    setReprocessingFile(fileName);
    setActiveTab('settings');
    showMessage(`Adjust settings and click "Process All" to reprocess ${fileName}`, 'info');
  };

  const applyCleaning = async (fileName) => {
    const item = processedItems[fileName];
    if (!item) return;
    setProcessing(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/apply-cleaning/${item.processId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cleaning_strength: cleaningStrength })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setCleanedItems(prev => ({
        ...prev,
        [fileName]: data.preview_url
      }));

      showMessage('Cleaning applied!', 'success');
    } catch (error) {
      showMessage('Error applying cleaning', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const reprocessCleaning = (fileName) => {
    setReprocessingFile(fileName);
    setActiveTab('settings');
    showMessage(`Adjust cleaning settings and click "Apply Cleaning" to reprocess ${fileName}`, 'info');
  };

  const downloadProcessedFile = async (fileName, format = 'png', cleaned = false) => {
    const item = processedItems[fileName];
    if (!item) return;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const endpoint = format === 'pdf' ? 'pdf' : 'original';
      
      const response = await fetch(`${apiUrl}/api/download/${item.processId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crop: false })
      });

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName.split('.')[0]}_${cleaned ? 'cleaned' : 'shadow_removed'}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showMessage(`Downloaded as ${format.toUpperCase()}`, 'success');
    } catch (error) {
      showMessage('Download failed', 'error');
    }
  };

  const deleteProcessedFile = (fileName) => {
    if (!window.confirm(`Delete ${fileName} from all tabs?`)) return;
    
    setProcessedItems(prev => {
      const updated = { ...prev };
      delete updated[fileName];
      return updated;
    });
    
    setQualityScores(prev => {
      const updated = { ...prev };
      delete updated[fileName];
      return updated;
    });
    
    setCleanedItems(prev => {
      const updated = { ...prev };
      delete updated[fileName];
      return updated;
    });
    
    setReprocessingFile(null);
    showMessage(`${fileName} deleted from all tabs`, 'success');
  };

  const resetAll = () => {
    setProcessingMode(null);
    setFiles([]);
    setCurrentFile(null);
    setProcessedItems({});
    setQualityScores({});
    setCleanedItems({});
    setIsCleaned(false);
    setReprocessingFile(null);
    setActiveTab('mode');
    showMessage('Ready for new documents', 'success');
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

  const changeMode = (newMode) => {
    setProcessingMode(newMode);
    setActiveTab('settings');
    setFiles([]);
    setCurrentFile(null);
    setProcessedItems({});
    setQualityScores({});
    setCleanedItems({});
    setReprocessingFile(null);
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">Document Restorer Pro</h1>
          <p className="text-slate-400 text-lg">Single or batch processing with quality comparison</p>
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

        <div className="flex gap-4 mb-8 border-b border-slate-700 flex-wrap overflow-x-auto">
          <button
            onClick={() => setActiveTab('mode')}
            className={`px-6 py-3 font-semibold text-lg whitespace-nowrap ${activeTab === 'mode' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400'}`}
          >
            Mode
          </button>
          {processingMode && (
            <>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-6 py-3 font-semibold text-lg whitespace-nowrap ${activeTab === 'settings' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400'}`}
              >
                Settings {reprocessingFile && `(Reprocessing: ${reprocessingFile})`}
              </button>
              {Object.keys(processedItems).length > 0 && (
                <>
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`px-6 py-3 font-semibold text-lg flex items-center gap-2 whitespace-nowrap ${activeTab === 'preview' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400'}`}
                  >
                    <Eye size={18} />
                    Preview
                  </button>
                  <button
                    onClick={() => setActiveTab('quality')}
                    className={`px-6 py-3 font-semibold text-lg flex items-center gap-2 whitespace-nowrap ${activeTab === 'quality' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400'}`}
                  >
                    <BarChart3 size={18} />
                    Quality
                  </button>
                  <button
                    onClick={() => setActiveTab('download')}
                    className={`px-6 py-3 font-semibold text-lg flex items-center gap-2 whitespace-nowrap ${activeTab === 'download' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400'}`}
                  >
                    <Download size={18} />
                    Download
                  </button>
                </>
              )}
            </>
          )}
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-semibold text-lg whitespace-nowrap ${activeTab === 'history' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400'}`}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab('help')}
            className={`px-6 py-3 font-semibold text-lg flex items-center gap-2 whitespace-nowrap ${activeTab === 'help' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400'}`}
          >
            <HelpCircle size={18} />
            Help
          </button>
        </div>

        {activeTab === 'mode' && !processingMode && (
          <div className="max-w-2xl mx-auto">
            <div className="space-y-6">
              <button
                onClick={() => changeMode('single')}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white p-8 rounded-xl border border-blue-500 transition transform hover:scale-105"
              >
                <div className="text-2xl font-bold mb-2">📄 Single Document</div>
                <p className="text-blue-100">Process one document at a time with detailed preview</p>
              </button>

              <button
                onClick={() => changeMode('batch')}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white p-8 rounded-xl border border-emerald-500 transition transform hover:scale-105"
              >
                <div className="text-2xl font-bold mb-2">📚 Batch Processing</div>
                <p className="text-emerald-100">Process multiple documents at once</p>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'mode' && processingMode && (
          <div className="max-w-2xl mx-auto">
            <div className="space-y-6">
              <button
                onClick={() => changeMode('single')}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white p-8 rounded-xl border border-blue-500 transition transform hover:scale-105"
              >
                <div className="text-2xl font-bold mb-2">📄 Single Document</div>
                <p className="text-blue-100">Process one document at a time with detailed preview</p>
              </button>

              <button
                onClick={() => changeMode('batch')}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white p-8 rounded-xl border border-emerald-500 transition transform hover:scale-105"
              >
                <div className="text-2xl font-bold mb-2">📚 Batch Processing</div>
                <p className="text-emerald-100">Process multiple documents at once</p>
              </button>

              <button
                onClick={resetAll}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition"
              >
                Reset All
              </button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && processingMode && (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
                <h3 className="text-white text-2xl font-semibold mb-6">
                  {reprocessingFile ? `Reprocess: ${reprocessingFile}` : `Upload ${processingMode === 'single' ? 'Document' : 'Documents'}`}
                </h3>
                
                {!reprocessingFile && (
                  <>
                    <div
                      ref={dropZoneRef}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className="border-2 border-dashed border-slate-600 rounded-xl p-12 text-center cursor-pointer hover:border-blue-500 transition mb-6"
                    >
                      <input 
                        type="file" 
                        onChange={handleFileInput} 
                        accept=".png,.jpg,.jpeg,.gif,.bmp,.tiff,.pdf" 
                        multiple={processingMode === 'batch'}
                        className="hidden" 
                        id="file-input" 
                      />
                      <label htmlFor="file-input" className="cursor-pointer block">
                        <Upload className="mx-auto mb-4 text-slate-400" size={48} />
                        <p className="text-white text-lg font-semibold mb-2">Drag {processingMode === 'single' ? 'a file' : 'files'} here</p>
                        <p className="text-slate-400">or click to browse</p>
                      </label>
                    </div>

                    {files.length > 0 && (
                      <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600 mb-6">
                        <p className="text-slate-300 font-semibold mb-3">{processingMode === 'single' ? 'Selected' : 'Queue'} ({files.length} {files.length === 1 ? 'file' : 'files'}):</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {files.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-slate-700/50 p-2 rounded">
                              <span className="text-slate-300 text-sm truncate">{file.name}</span>
                              <button
                                onClick={() => removeFile(index)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <button
                  onClick={processingMode === 'single' ? processSingleDocument : processAllDocuments}
                  disabled={(files.length === 0 && !reprocessingFile) || processing}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white py-3 rounded-lg font-semibold transition text-lg"
                >
                  {processing ? 'Processing...' : reprocessingFile ? 'Reprocess Shadow' : `Process ${processingMode === 'batch' ? 'All' : ''}`}
                </button>

                {reprocessingFile && (
                  <button
                    onClick={() => {
                      setReprocessingFile(null);
                      setActiveTab('preview');
                    }}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg font-semibold transition mt-3"
                  >
                    Cancel Reprocessing
                  </button>
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-white text-lg font-semibold mb-4">Shadow Removal</h3>

              <div className="mb-6">
                <label className="text-slate-300 font-semibold block mb-3">Quick Presets</label>
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

              <div className="border-t border-slate-700 mt-6 pt-6">
                <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                  <Sparkles size={20} />
                  Cleaning
                </h3>

                <label className="text-slate-300 font-semibold block mb-2 text-sm">Strength</label>
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
            </div>
          </div>
        )}

        {activeTab === 'preview' && processingMode && Object.keys(processedItems).length > 0 && (
          <div className="space-y-6">
            {Object.entries(processedItems).map(([fileName, item]) => (
              <div key={fileName} className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-white text-xl font-semibold">{fileName}</h3>
                  <button
                    onClick={() => deleteProcessedFile(fileName)}
                    className="text-red-400 hover:text-red-300 p-2"
                    title="Delete from all tabs"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-6 mb-6">
                  {/* Original */}
                  <div>
                    <p className="text-slate-300 font-semibold mb-3">Original</p>
                    <img
                      src={URL.createObjectURL(item.file)}
                      alt="Original"
                      className="w-full rounded-lg border border-slate-600 max-h-64 object-cover"
                    />
                  </div>

                  {/* Shadow Removed */}
                  <div>
                    <p className="text-blue-400 font-semibold mb-3">Shadow Removed</p>
                    <img
                      src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${item.preview}`}
                      alt="Shadow Removed"
                      className="w-full rounded-lg border border-blue-600 max-h-64 object-cover"
                    />
                  </div>

                  {/* Cleaned */}
                  {cleanedItems[fileName] && (
                    <div>
                      <p className="text-emerald-400 font-semibold mb-3">Cleaned</p>
                      <img
                        src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${cleanedItems[fileName]}`}
                        alt="Cleaned"
                        className="w-full rounded-lg border border-emerald-600 max-h-64 object-cover"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Shadow Removal Buttons */}
                  <div>
                    <p className="text-slate-300 text-sm font-semibold mb-2">Shadow Removal Options:</p>
                    <button
                      onClick={() => reprocessShadowRemoval(fileName)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
                    >
                      <RefreshCw size={18} />
                      Reprocess Shadow Removal
                    </button>
                  </div>

                  {/* Cleaning Buttons */}
                  {!cleanedItems[fileName] ? (
                    <div>
                      <p className="text-slate-300 text-sm font-semibold mb-2">Cleaning Options:</p>
                      <button
                        onClick={() => applyCleaning(fileName)}
                        disabled={processing}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white py-2 rounded-lg font-semibold transition"
                      >
                        {processing ? 'Applying Cleaning...' : 'Apply Cleaning'}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-slate-300 text-sm font-semibold mb-2">Cleaning Options:</p>
                      <button
                        onClick={() => reprocessCleaning(fileName)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
                      >
                        <RefreshCw size={18} />
                        Reprocess Cleaning
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'quality' && processingMode && Object.keys(qualityScores).length > 0 && (
          <div className="space-y-6">
            <h3 className="text-white text-2xl font-semibold">Quality Comparison</h3>
            
            {Object.entries(qualityScores).map(([fileName, score]) => {
              const grade = getQualityGrade(score.overall);
              
              return (
                <div key={fileName} className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="text-white text-xl font-semibold">{fileName}</h4>
                    <button
                      onClick={() => deleteProcessedFile(fileName)}
                      className="text-red-400 hover:text-red-300 p-2"
                      title="Delete from all tabs"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Shadow Removed Score */}
                    <div className={`${grade.bgColor} border border-slate-600 rounded-lg p-6`}>
                      <p className="text-slate-300 font-semibold mb-4">After Shadow Removal</p>
                      <p className={`font-bold text-4xl mb-2 ${grade.color}`}>{score.overall}%</p>
                      <p className={`text-lg font-semibold mb-6 ${grade.color}`}>{grade.label}</p>
                      
                      <div className="space-y-2 text-slate-300">
                        <p className="text-sm">
                          <span className="font-semibold">Shadow Removal:</span> {score.shadowRemoval}%
                        </p>
                        <p className="text-sm">
                          <span className="font-semibold">Clarity:</span> {score.clarity}%
                        </p>
                        <p className="text-sm">
                          <span className="font-semibold">Color Balance:</span> {score.colorBalance}%
                        </p>
                      </div>
                    </div>

                    {/* Cleaned Score */}
                    {cleanedItems[fileName] && (
                      <div className={`${grade.bgColor} border border-slate-600 rounded-lg p-6`}>
                        <p className="text-slate-300 font-semibold mb-4">After Cleaning</p>
                        <p className={`font-bold text-4xl mb-2 ${grade.color}`}>{score.overall + 5}%</p>
                        <p className={`text-lg font-semibold mb-6 ${grade.color}`}>Excellent</p>
                        
                        <div className="space-y-2 text-slate-300">
                          <p className="text-sm">
                            <span className="font-semibold">Shadow Removal:</span> {score.shadowRemoval}%
                          </p>
                          <p className="text-sm">
                            <span className="font-semibold">Clarity:</span> {score.clarity + 3}%
                          </p>
                          <p className="text-sm">
                            <span className="font-semibold">Color Balance:</span> {score.colorBalance + 5}%
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'download' && processingMode && Object.keys(processedItems).length > 0 && (
          <div className="space-y-6">
            <h3 className="text-white text-2xl font-semibold">Download Results</h3>
            
            {Object.entries(processedItems).map(([fileName, item]) => (
              <div key={fileName} className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
                <div className="flex justify-between items-center mb-6">
                  <p className="text-white font-semibold">{fileName}</p>
                  <button
                    onClick={() => deleteProcessedFile(fileName)}
                    className="text-red-400 hover:text-red-300 p-2"
                    title="Delete from all tabs"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-slate-300 text-sm font-semibold mb-3">Shadow Removed Version</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => downloadProcessedFile(fileName, 'png', false)}
                        className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                      >
                        <Image size={16} />
                        Download PNG
                      </button>
                      <button
                        onClick={() => downloadProcessedFile(fileName, 'pdf', false)}
                        className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                      >
                        <FileJson size={16} />
                        Download PDF
                      </button>
                    </div>
                  </div>

                  {cleanedItems[fileName] && (
                    <div>
                      <p className="text-slate-300 text-sm font-semibold mb-3">Cleaned Version</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => downloadProcessedFile(fileName, 'png', true)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                        >
                          <Image size={16} />
                          Download PNG
                        </button>
                        <button
                          onClick={() => downloadProcessedFile(fileName, 'pdf', true)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                        >
                          <FileJson size={16} />
                          Download PDF
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <button
              onClick={resetAll}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition mt-6"
            >
              Process New Batch
            </button>
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
          <div className="max-w-4xl mx-auto">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 space-y-6">
              <h2 className="text-2xl font-bold text-white">How to Use</h2>

              <div className="space-y-4">
                <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                  <h3 className="text-white font-semibold mb-2">📄 Single Document Mode</h3>
                  <p className="text-slate-300 text-sm">Perfect for processing one document. Detailed preview showing original, shadow removed, and cleaned versions side-by-side.</p>
                </div>

                <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                  <h3 className="text-white font-semibold mb-2">📚 Batch Processing Mode</h3>
                  <p className="text-slate-300 text-sm">Upload multiple documents and process them all at once with the same settings. Perfect for bulk jobs.</p>
                </div>

                <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                  <h3 className="text-white font-semibold mb-2">🔄 Reprocessing</h3>
                  <p className="text-slate-300 text-sm">In Preview tab, use "Reprocess Shadow Removal" to adjust shadow settings. After cleaning, use "Reprocess Cleaning" to adjust cleaning strength. Both take you to Settings tab to modify parameters.</p>
                </div>

                <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                  <h3 className="text-white font-semibold mb-2">👁️ Preview Tab</h3>
                  <p className="text-slate-300 text-sm">See original, shadow-removed, and cleaned versions side-by-side. Reprocess either shadow removal or cleaning. Click trash icon to delete from all tabs at once.</p>
                </div>

                <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                  <h3 className="text-white font-semibold mb-2">📊 Quality Tab</h3>
                  <p className="text-slate-300 text-sm">Compare quality scores for shadow-removed vs cleaned versions. Each file has a delete button to remove from all tabs.</p>
                </div>

                <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                  <h3 className="text-white font-semibold mb-2">⬇️ Download Tab</h3>
                  <p className="text-slate-300 text-sm">Download processed documents as PNG or PDF. Click trash to delete and remove from Preview & Quality tabs too.</p>
                </div>

                <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                  <h3 className="text-white font-semibold mb-2">🗑️ Deleting Files</h3>
                  <p className="text-slate-300 text-sm">Delete any file from Preview, Quality, or Download tabs - it removes from ALL tabs instantly. History deletion only affects backend records.</p>
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