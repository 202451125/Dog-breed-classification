import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Camera, Upload, Volume2, VolumeX, BookOpen, 
  RefreshCw, Zap, Shield, Heart, Award,
  AlertCircle, X, Search, Globe, Activity
} from 'lucide-react';
import { sound } from './audio.js';

// Curated sample dogs for 1-click testing
const SAMPLE_DOGS = [
  {
    name: 'Golden Retriever',
    breed: 'golden_retriever',
    url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Siberian Husky',
    breed: 'siberian_husky',
    url: 'https://images.unsplash.com/photo-1605568427561-40dd23c2acea?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'German Shepherd',
    breed: 'german_shepherd',
    url: 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'Pug',
    breed: 'pug',
    url: 'https://images.unsplash.com/photo-1517423460469-8b4040ba8f3b?auto=format&fit=crop&w=600&q=80'
  },
  {
    name: 'French Bulldog',
    breed: 'french_bulldog',
    url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=600&q=80'
  }
];

export default function App() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [statusText, setStatusText] = useState('Ready for input');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [muted, setMuted] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [showEncyclopedia, setShowEncyclopedia] = useState(false);
  const [allBreeds, setAllBreeds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [apiOnline, setApiOnline] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const toggleMute = () => {
    sound.muted = !muted;
    setMuted(!muted);
    if (muted) sound.playClick();
  };

  useEffect(() => {
    const fetchHealthAndBreeds = async () => {
      try {
        const healthRes = await fetch(`${API_BASE}/api/health`);
        if (healthRes.ok) setApiOnline(true);
      } catch (e) {
        setApiOnline(false);
      }

      try {
        const breedsRes = await fetch(`${API_BASE}/api/breeds`);
        if (breedsRes.ok) {
          const data = await breedsRes.json();
          setAllBreeds(data.breeds || []);
        }
      } catch (e) {
        setAllBreeds([
          { id: 'golden_retriever', name: 'Golden Retriever', dossier: { group: 'Sporting', origin: 'Scotland' } },
          { id: 'siberian_husky', name: 'Siberian Husky', dossier: { group: 'Working', origin: 'Siberia' } },
          { id: 'german_shepherd', name: 'German Shepherd', dossier: { group: 'Herding', origin: 'Germany' } },
          { id: 'pug', name: 'Pug', dossier: { group: 'Toy', origin: 'China' } }
        ]);
      }
    };

    fetchHealthAndBreeds();
  }, [API_BASE]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      sound.playClick();
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResults(null);
      setError(null);
      stopWebcam();
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      sound.playClick();
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResults(null);
      setError(null);
      stopWebcam();
    }
  };

  const handleSelectSample = async (sample) => {
    sound.playClick();
    stopWebcam();
    setError(null);
    setResults(null);
    setPreviewUrl(sample.url);

    try {
      const resp = await fetch(sample.url);
      const blob = await resp.blob();
      const file = new File([blob], `${sample.breed}.jpg`, { type: 'image/jpeg' });
      setSelectedImage(file);
    } catch (e) {
      console.warn('Sample fetch fallback:', e);
    }
  };

  const startWebcam = async () => {
    sound.playClick();
    setSelectedImage(null);
    setPreviewUrl(null);
    setResults(null);
    setError(null);
    setWebcamActive(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Unable to access webcam. Please check browser permissions.');
      setWebcamActive(false);
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setWebcamActive(false);
  };

  const captureWebcamSnapshot = () => {
    sound.playClick();
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'webcam_capture.jpg', { type: 'image/jpeg' });
        setSelectedImage(file);
        setPreviewUrl(canvas.toDataURL('image/jpeg'));
        stopWebcam();
      }
    }, 'image/jpeg', 0.95);
  };

  const runClassification = async () => {
    if (!selectedImage && !previewUrl) return;

    sound.playScanBlip();
    setIsScanning(true);
    setError(null);
    setResults(null);

    setStatusText('Preprocessing Image (224x224)...');
    await new Promise(r => setTimeout(r, 300));
    setStatusText('Running MobileNetV2 Inference...');
    await new Promise(r => setTimeout(r, 400));
    setStatusText('Classifying 120 Breeds...');

    try {
      const formData = new FormData();
      if (selectedImage) {
        formData.append('file', selectedImage);
      } else if (previewUrl) {
        const res = await fetch(previewUrl);
        const blob = await res.blob();
        formData.append('file', blob, 'sample.jpg');
      }

      const res = await fetch(`${API_BASE}/api/predict`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw new Error(`Server returned code ${res.status}`);
      }

      const data = await res.json();
      setResults(data);
      sound.playSuccess();

      if (data.top_confidence >= 75) {
        confetti({
          particleCount: 75,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#00f5d4', '#9d4edd', '#10b981']
        });
      }
    } catch (err) {
      console.error(err);
      setError('Classification server connection failed. Ensure backend is running.');
    } finally {
      setIsScanning(false);
      setStatusText('Ready for input');
    }
  };

  const filteredBreeds = allBreeds.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.dossier?.group && b.dossier.group.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="app-wrapper">
      {/* Top Header */}
      <header className="app-header">
        <div className="header-container">
          <div className="brand-section">
            <div className="brand-icon">
              <Activity size={22} />
            </div>
            <div>
              <h1 className="brand-title">Dog Breed Classification</h1>
              <p className="brand-subtitle">MobileNetV2 Deep Learning Model</p>
            </div>
          </div>

          <div className="header-actions">
            <div className="status-pill">
              <span className={`status-dot ${apiOnline ? '' : 'offline'}`} />
              <span>{apiOnline ? 'Model Ready' : 'Local Mode'}</span>
            </div>

            <button 
              onClick={() => { sound.playClick(); setShowEncyclopedia(true); }}
              className="icon-btn"
            >
              <BookOpen size={16} />
              <span>120 Breeds</span>
            </button>

            <button 
              onClick={toggleMute}
              className="icon-btn"
              title={muted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="main-content">
        
        {/* Hero Section */}
        <div className="hero-section">
          <div className="hero-badge">
            <Zap size={14} /> 120 Breeds Supported
          </div>
          <h2 className="hero-title">
            Classify Dog Breeds with <span>Deep Learning</span>
          </h2>
          <p className="hero-desc">
            Upload an image, capture with your webcam, or choose a sample dog below to classify its breed and view details in real-time.
          </p>
        </div>

        {/* Quick Sample Dogs */}
        <div className="samples-bar">
          <span className="samples-label">Quick Test:</span>
          {SAMPLE_DOGS.map((sample) => (
            <button
              key={sample.breed}
              onClick={() => handleSelectSample(sample)}
              className="sample-chip"
            >
              🐕 {sample.name}
            </button>
          ))}
        </div>

        {/* 2-Column Main App Grid */}
        <div className="app-grid">
          
          {/* Left Column: Image Scanner Card */}
          <div className={`glass-card ${isScanning ? 'scanning' : ''}`}>
            
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="scanner-viewport"
            >
              {/* HUD Corners */}
              <div className="hud-corner hud-tl" />
              <div className="hud-corner hud-tr" />
              <div className="hud-corner hud-bl" />
              <div className="hud-corner hud-br" />

              {/* Laser Animation when scanning */}
              {isScanning && (
                <>
                  <div className="laser-line" />
                  <div className="laser-grid" />
                </>
              )}

              {/* Mode A: Webcam Stream */}
              {webcamActive ? (
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', bottom: '16px', display: 'flex', gap: '10px' }}>
                    <button onClick={captureWebcamSnapshot} className="btn-primary">
                      <Camera size={16} /> Capture Photo
                    </button>
                    <button onClick={stopWebcam} className="btn-secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : previewUrl ? (
                /* Mode B: Selected Image Preview */
                <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img 
                    src={previewUrl} 
                    alt="Dog Preview" 
                    className="preview-image"
                  />
                  {!isScanning && (
                    <button 
                      onClick={() => { setSelectedImage(null); setPreviewUrl(null); setResults(null); }}
                      style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}
                      title="Clear image"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ) : (
                /* Mode C: Empty Dropzone */
                <div className="dropzone-empty">
                  <div className="dropzone-icon">
                    <Upload size={28} />
                  </div>
                  <div>
                    <h3 className="dropzone-title">Upload a Dog Photo</h3>
                    <p className="dropzone-desc">Drag & drop an image here or choose from your computer.</p>
                  </div>
                  <div className="dropzone-actions">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-primary"
                    >
                      <Upload size={16} /> Choose File
                    </button>
                    <button 
                      onClick={startWebcam}
                      className="btn-secondary"
                    >
                      <Camera size={16} /> Use Webcam
                    </button>
                  </div>
                </div>
              )}

              {/* Truly Hidden Native File Input */}
              <input 
                ref={fileInputRef} 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
              />
            </div>

            {/* Bottom Controls Bar */}
            <div className="controls-bar">
              <div className="status-text">
                <span className="status-dot" />
                <span>{statusText}</span>
              </div>

              <button
                disabled={(!selectedImage && !previewUrl) || isScanning}
                onClick={runClassification}
                className="btn-primary"
                style={{ minWidth: '160px' }}
              >
                {isScanning ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Classifying...
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    Classify Breed
                  </>
                )}
              </button>
            </div>

            {error && (
              <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Right Column: Prediction Results Card */}
          <div className="glass-card">
            {results ? (
              <div className="result-hero-card">
                
                {/* Header: Breed & Confidence */}
                <div className="result-top-header">
                  <div>
                    <div>
                      <span className="tag-badge">Rank #1 Match</span>
                      {results.predictions[0]?.dossier?.group && (
                        <span className="tag-badge alt">
                          {results.predictions[0].dossier.group}
                        </span>
                      )}
                    </div>
                    <h3 className="result-breed-title">
                      {results.top_breed}
                    </h3>
                  </div>

                  <div>
                    <div className="result-confidence-val">
                      {results.top_confidence}%
                    </div>
                    <div className="result-confidence-lbl">
                      Confidence
                    </div>
                  </div>
                </div>

                {/* Intel Chips Grid */}
                <div className="intel-grid">
                  <div className="intel-box">
                    <div className="intel-label">Origin</div>
                    <div className="intel-value">
                      <Globe size={14} color="#00f5d4" />
                      <span>{results.predictions[0]?.dossier?.origin || 'Global'}</span>
                    </div>
                  </div>
                  <div className="intel-box">
                    <div className="intel-label">Lifespan</div>
                    <div className="intel-value">
                      <Heart size={14} color="#f43f5e" />
                      <span>{results.predictions[0]?.dossier?.lifespan || '10 - 14 yrs'}</span>
                    </div>
                  </div>
                  <div className="intel-box">
                    <div className="intel-label">Category</div>
                    <div className="intel-value">
                      <Award size={14} color="#a855f7" />
                      <span>{results.predictions[0]?.dossier?.group || 'Canine'}</span>
                    </div>
                  </div>
                </div>

                {/* Temperament Tags */}
                {results.predictions[0]?.dossier?.temperament && (
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                      Temperament
                    </div>
                    <div>
                      {results.predictions[0].dossier.temperament.map((t, idx) => (
                        <span key={idx} className="tag-badge alt">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trait Meters */}
                <div className="trait-meters">
                  <div className="trait-row">
                    <div className="trait-header">
                      <span>Energy Level</span>
                      <span>{results.predictions[0]?.dossier?.energy || 80}%</span>
                    </div>
                    <div className="trait-bar-track">
                      <div 
                        className="trait-bar-fill" 
                        style={{ width: `${results.predictions[0]?.dossier?.energy || 80}%` }}
                      />
                    </div>
                  </div>

                  <div className="trait-row">
                    <div className="trait-header">
                      <span>Trainability</span>
                      <span>{results.predictions[0]?.dossier?.trainability || 85}%</span>
                    </div>
                    <div className="trait-bar-track">
                      <div 
                        className="trait-bar-fill purple" 
                        style={{ width: `${results.predictions[0]?.dossier?.trainability || 85}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Description */}
                {results.predictions[0]?.dossier?.description && (
                  <p style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.5', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '10px' }}>
                    {results.predictions[0].dossier.description}
                  </p>
                )}

                {/* Top 5 Probability Spectrum */}
                <div className="spectrum-section">
                  <div className="spectrum-title">
                    <span>Top 5 Predicted Breeds</span>
                    <span style={{ color: '#00f5d4' }}>Latency: {results.telemetry?.latency_ms || 45}ms</span>
                  </div>

                  {results.predictions.slice(1).map((pred) => (
                    <div key={pred.id} className="spectrum-row">
                      <div className="spectrum-meta">
                        <span style={{ color: '#cbd5e1' }}>#{pred.rank} {pred.breed}</span>
                        <span style={{ color: '#94a3b8' }}>{pred.confidence}%</span>
                      </div>
                      <div className="spectrum-track">
                        <div 
                          className="spectrum-fill"
                          style={{ width: `${Math.min(100, Math.max(3, pred.confidence))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            ) : (
              /* Blank Awaiting State */
              <div className="results-empty">
                <div className="results-empty-icon">
                  <Shield size={28} />
                </div>
                <div>
                  <h4 style={{ color: '#e2e8f0', fontSize: '0.95rem', fontWeight: 600 }}>Awaiting Image</h4>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                    Upload or select a dog picture on the left to see breed predictions.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>

      </main>

      {/* 120 Breeds Encyclopedia Modal */}
      {showEncyclopedia && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} color="#00f5d4" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>120 Supported Dog Breeds</h3>
              </div>
              <button 
                onClick={() => { sound.playClick(); setShowEncyclopedia(false); }}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-search">
              <input 
                type="text" 
                placeholder="Search dog breeds (e.g. Husky, Golden, Bulldog)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="modal-input"
              />
            </div>

            <div className="modal-list">
              {filteredBreeds.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '0.85rem' }}>
                  No matching breeds found.
                </div>
              ) : (
                filteredBreeds.map((b) => (
                  <div key={b.id} className="modal-item">
                    <div>
                      <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{b.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {b.dossier?.group || 'Standard'} • {b.dossier?.origin || 'Lineage'}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#00f5d4', fontFamily: 'var(--font-mono)' }}>
                      120-Class
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        Dog Breed Classification • MobileNetV2 Deep Learning Model (120 Breeds) • FastAPI & React
      </footer>
    </div>
  );
}
