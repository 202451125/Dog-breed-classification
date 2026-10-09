import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Camera, Upload, Volume2, VolumeX, Sparkles, BookOpen, 
  Github, RefreshCw, Zap, Shield, Heart, Award, CheckCircle2,
  AlertCircle, ChevronRight, X, Search, Globe, Activity
} from 'lucide-react';
import { sound } from './audio.js';

// Fallback curated sample images (Unsplash CDN direct dog portraits)
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
  const [scanStepText, setScanStepText] = useState('STANDBY');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [muted, setMuted] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [showEncyclopedia, setShowEncyclopedia] = useState(false);
  const [allBreeds, setAllBreeds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [apiOnline, setApiOnline] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const particleCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Toggle sound
  const toggleMute = () => {
    sound.muted = !muted;
    setMuted(!muted);
    if (muted) sound.playClick();
  };

  // Check backend health & fetch breed index
  useEffect(() => {
    const fetchHealthAndBreeds = async () => {
      try {
        const healthRes = await fetch(`${API_BASE}/api/health`);
        if (healthRes.ok) {
          setApiOnline(true);
        }
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
        // Fallback default list
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

  // Ambient Star / Particle Field
  useEffect(() => {
    const canvas = particleCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrame;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 45 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.6 + 0.2
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 245, 212, ${p.alpha})`;
        ctx.fill();
      });
      animationFrame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Handle Image File Selection
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

  // Handle Drag & Drop
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

  // Select Sample Dog
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

  // Webcam Controls
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

  // Perform Neural Classification
  const runClassification = async () => {
    if (!selectedImage && !previewUrl) return;

    sound.playScanBlip();
    setIsScanning(true);
    setError(null);
    setResults(null);

    // Audio-visual scanning stage simulation
    setScanStepText('PREPROCESSING TENSOR [224x224x3]...');
    await new Promise(r => setTimeout(r, 400));
    setScanStepText('MOBILENETV2 FEATURE EXTRACTION...');
    await new Promise(r => setTimeout(r, 500));
    setScanStepText('SOFTMAX 120-CLASS TAXONOMY INFERENCE...');

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

      // Confetti celebratory burst for high confidence match
      if (data.top_confidence >= 80) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00f5d4', '#9d4edd', '#ff007f']
        });
      }
    } catch (err) {
      console.error(err);
      setError('Neural classification service error. Ensure the FastAPI backend is running on port 8000.');
    } finally {
      setIsScanning(false);
      setScanStepText('STANDBY');
    }
  };

  // Filtered Breeds for Encyclopedia Modal
  const filteredBreeds = allBreeds.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.dossier?.group && b.dossier.group.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="relative min-h-screen text-slate-100 flex flex-col justify-between overflow-x-hidden">
      {/* Background Ambient Canvas */}
      <canvas ref={particleCanvasRef} className="fixed inset-0 pointer-events-none z-0" />

      {/* Top Cyber Navigation Bar */}
      <header className="relative z-10 w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-400/40 text-cyan-400 shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-bold tracking-wider uppercase bg-gradient-to-r from-cyan-400 via-teal-200 to-purple-400 bg-clip-text text-transparent">
                  CanineVision AI
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800">
                  v2.4
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono tracking-tight">
                NEURAL BIO-SCANNER // 120 CANINE TAXONOMIES
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Backend health status badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${apiOnline ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'}`} />
              <span className="text-slate-300">{apiOnline ? 'NEURAL ENGINE ONLINE' : 'LOCAL SIMULATION'}</span>
            </div>

            {/* Encyclopedia Button */}
            <button 
              onClick={() => { sound.playClick(); setShowEncyclopedia(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-cyan-400/50 hover:text-cyan-300 text-xs font-mono transition"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden md:inline">120 Breeds</span>
            </button>

            {/* Mute/Sound Toggle */}
            <button 
              onClick={toggleMute}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-cyan-400/50 hover:text-cyan-300 transition"
              title={muted ? 'Unmute Sound FX' : 'Mute Sound FX'}
            >
              {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>

            {/* GitHub Link */}
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noreferrer"
              className="p-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-purple-400/50 hover:text-purple-300 transition"
              title="View on GitHub"
            >
              <Github className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8 w-full flex-grow flex flex-col gap-8">
        
        {/* Hero Section Banner */}
        <section className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/50 border border-cyan-500/30 text-cyan-400 text-xs font-mono tracking-wider">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            DEEP CONVOLUTIONAL MOBILENETV2 ARCHITECTURE
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Identify Any Canine Breed in <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Milliseconds</span>
          </h2>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            Drop any dog photograph or activate the live optic camera. Our neural network computes deep feature maps across 120 recognized breeds and generates instant intelligence dossiers.
          </p>
        </section>

        {/* 1-Click Sample Dogs Quick Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider mr-1">Quick Test:</span>
          {SAMPLE_DOGS.map((sample) => (
            <button
              key={sample.breed}
              onClick={() => handleSelectSample(sample)}
              className="glass-pill hover:border-cyan-400 hover:text-cyan-300 text-xs transition active:scale-95 cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              {sample.name}
            </button>
          ))}
        </div>

        {/* Studio Grid: Scanner on Left/Top, Output Dossier on Right/Bottom */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Holographic Laser Scanner */}
          <div className="lg:col-span-6 space-y-4">
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`relative glass-panel overflow-hidden border-2 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[420px] transition-all ${
                isScanning ? 'border-cyan-400 shadow-[0_0_35px_rgba(0,245,212,0.25)]' : 'border-slate-800'
              }`}
            >
              {/* HUD Reticles */}
              <div className="hud-corner hud-tl" />
              <div className="hud-corner hud-tr" />
              <div className="hud-corner hud-bl" />
              <div className="hud-corner hud-br" />

              {/* Mode 1: Webcam Active */}
              {webcamActive ? (
                <div className="relative w-full h-[360px] flex flex-col items-center justify-center rounded-xl overflow-hidden bg-black">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 flex items-center gap-3">
                    <button 
                      onClick={captureWebcamSnapshot}
                      className="btn-cyber bg-cyan-500/20 text-cyan-300 text-sm py-2 px-5 shadow-lg shadow-cyan-500/30"
                    >
                      <Camera className="w-4 h-4" />
                      Capture Snapshot
                    </button>
                    <button 
                      onClick={stopWebcam}
                      className="px-4 py-2 rounded-xl bg-slate-900/90 text-slate-300 border border-slate-700 text-sm hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : previewUrl ? (
                /* Mode 2: Image Preview with Laser Scanning */
                <div className="relative w-full h-[380px] flex items-center justify-center rounded-xl overflow-hidden bg-slate-950/60">
                  <img 
                    src={previewUrl} 
                    alt="Target Canine" 
                    className="w-full h-full object-contain select-none"
                  />

                  {/* Laser Beam & Grid Overlay */}
                  {isScanning && (
                    <>
                      <div className="laser-beam" />
                      <div className="laser-grid-overlay" />
                      {/* Targeting Lock Box */}
                      <div className="absolute inset-16 border-2 border-cyan-400/60 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                        <div className="flex justify-between text-[10px] font-mono text-cyan-400">
                          <span>ACQUIRING_TARGET</span>
                          <span>LOCK: 99.4%</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-cyan-400">
                          <span>RGB_NORM: TRUE</span>
                          <span>TENSOR: OK</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Reset overlay button */}
                  {!isScanning && (
                    <button 
                      onClick={() => { setSelectedImage(null); setPreviewUrl(null); setResults(null); }}
                      className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 text-slate-300 hover:text-rose-400 transition"
                      title="Clear Target"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                /* Mode 3: Empty Dropzone State */
                <div className="text-center p-8 space-y-4">
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                    <Upload className="w-8 h-8 stroke-[1.5]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-200">
                      Upload or Drag Canine Image
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Supports high-resolution JPG, PNG, WEBP formats. Optimal resolution: 224x224 or greater.
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-cyber text-xs py-2 px-4"
                    >
                      <Upload className="w-4 h-4" />
                      Browse Files
                    </button>
                    <button 
                      onClick={startWebcam}
                      className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-purple-400 hover:text-purple-300 text-xs font-medium text-slate-300 transition inline-flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      Webcam Mode
                    </button>
                  </div>
                </div>
              )}

              {/* Hidden file input */}
              <input 
                ref={fileInputRef} 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </div>

            {/* Scanning Controls & Status */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 glass-panel rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs font-mono text-cyan-300 tracking-wider">
                  STATUS: {scanStepText}
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  disabled={(!selectedImage && !previewUrl) || isScanning}
                  onClick={runClassification}
                  className={`btn-cyber w-full sm:w-auto text-sm py-2.5 px-6 font-mono ${
                    (!selectedImage && !previewUrl) || isScanning
                      ? 'opacity-40 cursor-not-allowed border-slate-800'
                      : 'hover:scale-[1.02]'
                  }`}
                >
                  {isScanning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                      COMPUTING...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-cyan-400" />
                      EXECUTE BIO-SCAN
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Right Column: Neural Intelligence Dossier Output */}
          <div className="lg:col-span-6 space-y-6">
            {results ? (
              <div className="space-y-6 animate-fadeIn">
                
                {/* Primary Detected Breed Hero Card */}
                <div className="glass-panel p-6 border-cyan-400/40 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          RANK #1 MATCH
                        </span>
                        {results.predictions[0]?.dossier?.group && (
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {results.predictions[0].dossier.group}
                          </span>
                        )}
                      </div>
                      <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-wide">
                        {results.top_breed}
                      </h3>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl md:text-4xl font-extrabold text-cyan-400 font-mono tracking-tight glow-cyan">
                        {results.top_confidence}%
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">
                        NEURAL CONFIDENCE
                      </span>
                    </div>
                  </div>

                  {/* Breed Key Info Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-800/80">
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-mono uppercase">Origin</div>
                      <div className="text-xs font-medium text-slate-200 mt-0.5 flex items-center gap-1">
                        <Globe className="w-3 h-3 text-cyan-400" />
                        {results.predictions[0]?.dossier?.origin || 'Global'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-mono uppercase">Life Expectancy</div>
                      <div className="text-xs font-medium text-slate-200 mt-0.5 flex items-center gap-1">
                        <Heart className="w-3 h-3 text-rose-400" />
                        {results.predictions[0]?.dossier?.lifespan || '10 - 14 yrs'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 col-span-2 sm:col-span-1">
                      <div className="text-[10px] text-slate-400 font-mono uppercase">AKC Category</div>
                      <div className="text-xs font-medium text-slate-200 mt-0.5 flex items-center gap-1">
                        <Award className="w-3 h-3 text-purple-400" />
                        {results.predictions[0]?.dossier?.group || 'Working'}
                      </div>
                    </div>
                  </div>

                  {/* Temperament Tags */}
                  {results.predictions[0]?.dossier?.temperament && (
                    <div className="mt-4">
                      <div className="text-[10px] text-slate-400 font-mono uppercase mb-1.5">
                        Documented Temperament
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {results.predictions[0].dossier.temperament.map((t, idx) => (
                          <span 
                            key={idx}
                            className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800/80 text-cyan-300 border border-slate-700"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trait Meters */}
                  <div className="mt-4 space-y-2 pt-3 border-t border-slate-800/80">
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                        <span>ENERGY LEVEL</span>
                        <span className="text-cyan-400">{results.predictions[0]?.dossier?.energy || 80}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div 
                          className="h-full bg-cyan-400 rounded-full transition-all duration-1000"
                          style={{ width: `${results.predictions[0]?.dossier?.energy || 80}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                        <span>TRAINABILITY</span>
                        <span className="text-purple-400">{results.predictions[0]?.dossier?.trainability || 85}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div 
                          className="h-full bg-purple-400 rounded-full transition-all duration-1000"
                          style={{ width: `${results.predictions[0]?.dossier?.trainability || 85}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Breed Summary Description */}
                  {results.predictions[0]?.dossier?.description && (
                    <p className="mt-4 text-xs text-slate-300 leading-relaxed bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
                      {results.predictions[0].dossier.description}
                    </p>
                  )}
                </div>

                {/* Top 5 Probability Spectrum */}
                <div className="glass-panel p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      Top-5 Neural Probability Spectrum
                    </h4>
                    <span className="text-[10px] font-mono text-cyan-400">
                      Latency: {results.telemetry?.latency_ms || 45}ms
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {results.predictions.slice(1).map((pred) => (
                      <div key={pred.id} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-300 flex items-center gap-1.5">
                            <span className="text-slate-500">#{pred.rank}</span> {pred.breed}
                          </span>
                          <span className="text-slate-400 font-semibold">{pred.confidence}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(100, Math.max(3, pred.confidence))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              /* Awaiting Input Blank State */
              <div className="glass-panel p-8 text-center flex flex-col items-center justify-center min-h-[420px] space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                  <Shield className="w-8 h-8 stroke-[1.5]" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                    Awaiting Target Input
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select a sample canine above or upload an image to view the deep learning probability spectrum and breed dossier.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>

      </main>

      {/* 120 Breeds Encyclopedia Modal */}
      {showEncyclopedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-2xl max-h-[85vh] glass-panel bg-slate-950/95 border-slate-700 p-6 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white tracking-wide">
                  Canine Taxonomy Database ({allBreeds.length} Breeds)
                </h3>
              </div>
              <button 
                onClick={() => { sound.playClick(); setShowEncyclopedia(false); }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative my-4">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input 
                type="text" 
                placeholder="Search dog breeds (e.g. Golden, Terrier, Husky, Bulldog)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Scrollable Breeds List */}
            <div className="overflow-y-auto flex-grow space-y-2 pr-1">
              {filteredBreeds.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 font-mono">
                  NO MATCHING TAXONOMIES FOUND
                </div>
              ) : (
                filteredBreeds.map((b) => (
                  <div 
                    key={b.id} 
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-cyan-400/40 flex items-center justify-between text-xs transition"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{b.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {b.dossier?.group || 'Standard'} • {b.dossier?.origin || 'Historical Lineage'}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                      MobileNetV2 Class
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900/80 bg-slate-950/80 py-4 px-6 text-center text-xs font-mono text-slate-500">
        <p>
          CanineVision Neural Engine // Powered by MobileNetV2 Transfer Learning • Stanford Dogs Dataset • FastAPI & React
        </p>
      </footer>
    </div>
  );
}
