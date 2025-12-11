
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Video, VideoOff, Loader2, XCircle, Camera, ScanLine, CheckCircle2, Sprout, Bug, FlaskConical, Eye, Flower2, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { analyzeSnapshot } from '../services/geminiService';
import { ScanResult } from '../types';

interface LiveAgronomistProps {
  onClose: () => void;
  onSaveScan: (scan: ScanResult) => void;
}

// Configuration
const MODEL_LIVE = 'gemini-2.5-flash-native-audio-preview-09-2025';
const FRAME_RATE = 1.5; 
const JPEG_QUALITY = 0.5;
const MAX_RETRIES = 3;

type ScanMode = 'General' | 'Soil' | 'Pest' | 'Disease' | 'Plant';

interface ZoomCapabilities {
  min: number;
  max: number;
  step: number;
}

const LiveAgronomist: React.FC<LiveAgronomistProps> = ({ onClose, onSaveScan }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  
  // Snapshot/Deep Scan states
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>('General');

  // Camera Control States
  const [zoomCap, setZoomCap] = useState<ZoomCapabilities | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Refs for resource management
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  
  // Flag to strictly gate data transmission
  const isSessionActiveRef = useRef(false);

  // --- Helper Functions ---

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64String = result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const decodeAudioData = async (
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number = 24000,
    numChannels: number = 1
  ): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const decodeBase64 = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const createPcmBlob = (data: Float32Array): { data: string; mimeType: string } => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    
    // Manual base64 encoding for the blob data
    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return {
      data: base64,
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  // --- Camera Controls ---

  const checkCameraCapabilities = (stream: MediaStream) => {
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    const capabilities = (track as any).getCapabilities ? (track as any).getCapabilities() : {};
    
    if (capabilities.zoom) {
      setZoomCap({
        min: capabilities.zoom.min,
        max: capabilities.zoom.max,
        step: capabilities.zoom.step
      });
      // Initial zoom
      const settings = (track as any).getSettings ? (track as any).getSettings() : {};
      if (settings.zoom) {
        setZoomLevel(settings.zoom);
      }
    }
  };

  const handleZoomChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(event.target.value);
    setZoomLevel(newZoom);
    
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track && (track as any).applyConstraints) {
        (track as any).applyConstraints({
          advanced: [{ zoom: newZoom }]
        }).catch((err: any) => console.log('Zoom not supported:', err));
      }
    }
  };

  // --- Main Logic ---

  const stopSession = useCallback(() => {
    console.log("Stopping session...");
    isSessionActiveRef.current = false;
    setIsConnected(false);

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close().catch(e => console.warn("Input ctx close error", e));
      inputAudioContextRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(e => console.warn("Audio ctx close error", e));
      audioContextRef.current = null;
    }
    
    sessionPromiseRef.current = null;
  }, []);

  const startSession = async (attempt = 0) => {
    // Clean up previous attempt fully
    stopSession();
    
    // Backoff delay if retrying
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 1000 * attempt));
    } else {
      await new Promise(r => setTimeout(r, 200));
    }

    try {
      setError(null);
      if (attempt > 0) {
        setRetryCount(attempt);
      }

      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API Key not found");
      }
      
      const ai = new GoogleGenAI({ apiKey });

      // 1. Setup Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      nextStartTimeRef.current = 0;

      // Resume contexts immediately
      try {
        if (inputAudioContextRef.current.state === 'suspended') {
          await inputAudioContextRef.current.resume();
        }
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      } catch (e) {
        console.warn("Audio Context Resume failed", e);
      }

      // 2. Get Media Stream (Camera + Mic)
      // Try to get backend camera first
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      streamRef.current = stream;
      checkCameraCapabilities(stream);

      // Set video source
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // 3. Connect to Gemini Live
      console.log(`Connecting to Gemini Live (Attempt ${attempt + 1})...`);
      
      sessionPromiseRef.current = ai.live.connect({
        model: MODEL_LIVE,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `You are AgriVision, a friendly AI agronomist assistant. 
          You are looking at a video feed from a farmer's camera.
          Identify plants, pests, and soil conditions you see.
          Offer concise, practical, and eco-friendly farming advice. 
          If you see soil, describe its likely composition and health.
          Keep your responses short and conversational.`,
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Connected');
            setIsConnected(true);
            setRetryCount(0); // Reset retry count on success
            isSessionActiveRef.current = true;
            setupAudioInput(stream);
            setupVideoStreaming();
          },
          onmessage: async (message: LiveServerMessage) => {
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
               playAudioResponse(audioData);
            }
          },
          onclose: () => {
            console.log('Gemini Live Closed');
            if (isSessionActiveRef.current) {
               setIsConnected(false);
               isSessionActiveRef.current = false;
            }
          },
          onerror: (e) => {
            console.error('Gemini Live Error', e);
            if (isSessionActiveRef.current) {
               isSessionActiveRef.current = false;
               setIsConnected(false);
               // Trigger retry from error state if we haven't hit max retries
               if (attempt < MAX_RETRIES) {
                  const nextAttempt = attempt + 1;
                  console.log(`Connection error, retrying (${nextAttempt}/${MAX_RETRIES})...`);
                  retryTimeoutRef.current = window.setTimeout(() => startSession(nextAttempt), 2000);
               } else {
                  setError("The service is currently unavailable. Please try again later.");
               }
            }
          }
        }
      });

    } catch (err) {
      console.error("Session start error:", err);
      // Catch initialization errors (e.g. 503 from connect call)
      if (attempt < MAX_RETRIES) {
          const nextAttempt = attempt + 1;
          console.log(`Init error, retrying (${nextAttempt}/${MAX_RETRIES})...`);
          retryTimeoutRef.current = window.setTimeout(() => startSession(nextAttempt), 2000);
      } else {
          setError("Connection failed. Service may be unavailable.");
      }
    }
  };

  const setupAudioInput = (stream: MediaStream) => {
    if (!inputAudioContextRef.current) return;

    try {
      const source = inputAudioContextRef.current.createMediaStreamSource(stream);
      const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      // Visualization
      const analyser = inputAudioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      const updateVolume = () => {
        if (!analyserRef.current || !isSessionActiveRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setVolumeLevel(avg);
        requestAnimationFrame(updateVolume);
      };
      updateVolume();

      scriptProcessor.onaudioprocess = (e) => {
        if (isMuted || !isSessionActiveRef.current) return; 
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createPcmBlob(inputData);
        
        // Use promise to ensure session is ready
        if (sessionPromiseRef.current) {
          sessionPromiseRef.current.then((session) => {
            if (!isSessionActiveRef.current) return; // Double check inside async
            try {
              session.sendRealtimeInput({ media: pcmBlob });
            } catch (err) {
              // Ignore send errors, likely session closed
            }
          }).catch(err => console.debug("Skipping audio frame, session not ready"));
        }
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioContextRef.current.destination);
    } catch (e) {
      console.error("Error setting up audio input:", e);
    }
  };

  const setupVideoStreaming = () => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    
    frameIntervalRef.current = window.setInterval(() => {
      if (isVideoPaused || !videoRef.current || !canvasRef.current || !isSessionActiveRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Lower resolution for streaming to save bandwidth
      canvas.width = 640; 
      canvas.height = 360; 
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(async (blob) => {
        if (blob && isSessionActiveRef.current) {
          const base64Data = await blobToBase64(blob);
          if (sessionPromiseRef.current && isSessionActiveRef.current) {
            sessionPromiseRef.current.then(session => {
              if (!isSessionActiveRef.current) return;
              try {
                session.sendRealtimeInput({
                  media: { data: base64Data, mimeType: 'image/jpeg' }
                });
              } catch(e) {
                // Ignore
              }
            }).catch(() => {});
          }
        }
      }, 'image/jpeg', JPEG_QUALITY);

    }, 1000 / FRAME_RATE);
  };

  const playAudioResponse = async (base64Audio: string) => {
    if (!audioContextRef.current) return;

    try {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const audioBytes = decodeBase64(base64Audio);
      const audioBuffer = await decodeAudioData(audioBytes, audioContextRef.current);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      const currentTime = audioContextRef.current.currentTime;
      const startTime = Math.max(nextStartTimeRef.current, currentTime);
      source.start(startTime);
      
      nextStartTimeRef.current = startTime + audioBuffer.duration;
      
      activeSourcesRef.current.add(source);
      source.onended = () => {
        activeSourcesRef.current.delete(source);
      };
    } catch (e) {
      console.error("Error playing audio", e);
    }
  };

  const handleDeepScan = async () => {
    if (!videoRef.current || !canvasRef.current || isScanning) return;
    
    setIsScanning(true);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // High res for deep scan
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      
      try {
        const result = await analyzeSnapshot(base64, scanMode);
        setScanResult(result);
        
        // Save scan result to history
        onSaveScan({
           id: Date.now().toString(),
           timestamp: Date.now(),
           mode: scanMode,
           analysis: result
        });
      } catch (e) {
        console.error("Scan failed", e);
      }
    }
    
    setIsScanning(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      startSession();
    }, 500);
    
    return () => {
      clearTimeout(timer);
      stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/70 to-transparent text-white">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="font-semibold text-sm tracking-wide">
            {isConnected ? 'AGRIVISION LIVE' : retryCount > 0 ? `RETRYING (${retryCount}/${MAX_RETRIES})...` : 'CONNECTING...'}
          </span>
        </div>
        <button onClick={onClose} className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition">
          <XCircle size={24} />
        </button>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 relative bg-gray-900 overflow-hidden flex items-center justify-center">
        <video 
          ref={videoRef} 
          className="absolute inset-0 w-full h-full object-cover" 
          autoPlay 
          playsInline 
          muted 
        />
        {/* Hidden Canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Flash Effect */}
        {isScanning && <div className="absolute inset-0 bg-white animate-[fadeOut_0.5s_ease-out_forwards] pointer-events-none z-20" />}

        {/* Zoom Controls - Only show if camera supports zoom */}
        {zoomCap && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center bg-black/40 backdrop-blur-md rounded-full py-4 px-2">
            <ZoomIn size={20} className="text-white mb-2" />
            <div className="h-40 w-8 flex items-center justify-center relative">
               <input
                type="range"
                min={zoomCap.min}
                max={zoomCap.max}
                step={zoomCap.step}
                value={zoomLevel}
                onChange={handleZoomChange}
                className="w-40 h-2 bg-white/30 rounded-lg appearance-none cursor-pointer absolute -rotate-90 origin-center"
                style={{ width: '160px' }} // Manual width for rotated element
              />
            </div>
            <ZoomOut size={20} className="text-white mt-2" />
          </div>
        )}

        {/* Mode Selector Overlay - Animated */}
        {!scanResult && (
          <div className="absolute top-20 right-16 z-20 flex flex-col gap-3">
             {[
               { id: 'General', icon: Eye, label: 'General' },
               { id: 'Plant', icon: Flower2, label: 'Plant ID' },
               { id: 'Soil', icon: FlaskConical, label: 'Soil Checker' },
               { id: 'Pest', icon: Bug, label: 'Pest Finder' },
               { id: 'Disease', icon: Sprout, label: 'Disease ID' }
             ].map((mode) => (
               <button 
                 key={mode.id}
                 onClick={() => setScanMode(mode.id as ScanMode)}
                 className={`relative p-3 rounded-full backdrop-blur-md transition-all duration-300 flex items-center gap-2 shadow-lg overflow-hidden group ${
                   scanMode === mode.id 
                     ? 'bg-leaf-600 text-white w-auto px-4' 
                     : 'bg-black/40 text-white/70 hover:bg-black/60 w-12'
                 }`}
               >
                 <mode.icon size={20} className="relative z-10" />
                 
                 <div className={`overflow-hidden transition-all duration-300 ease-out ${scanMode === mode.id ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
                    <span className="text-xs font-semibold whitespace-nowrap relative z-10">{mode.label}</span>
                 </div>
               </button>
             ))}
          </div>
        )}

        {/* Loading Overlay */}
        {!isConnected && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm text-white">
            <Loader2 className="animate-spin mb-4" size={48} />
            <p>{retryCount > 0 ? "Re-establishing Uplink..." : "Initializing Neural Link..."}</p>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center text-white z-40">
            <p className="text-red-400 font-bold text-lg mb-2">System Alert</p>
            <p className="mb-4 text-sm opacity-80 max-w-xs">{error}</p>
            <button onClick={() => { startSession(); }} className="px-6 py-3 bg-green-600 rounded-lg hover:bg-green-700 transition font-bold flex items-center gap-2">
              <RefreshCw size={18} /> Retry Connection
            </button>
          </div>
        )}

        {/* Visualizer Overlay (HUD) */}
        {isConnected && !scanResult && (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pointer-events-none flex flex-col items-center gap-4">
            
            {/* Prominent Mode Subtitle */}
            <div className="px-5 py-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2 shadow-xl transition-all duration-300 animate-in slide-in-from-bottom-5">
              {scanMode === 'General' && <Eye size={16} className="text-leaf-400" />}
              {scanMode === 'Plant' && <Flower2 size={16} className="text-pink-400" />}
              {scanMode === 'Soil' && <FlaskConical size={16} className="text-amber-400" />}
              {scanMode === 'Pest' && <Bug size={16} className="text-red-400" />}
              {scanMode === 'Disease' && <Sprout size={16} className="text-yellow-400" />}
              <span className="text-white font-medium text-sm tracking-wide uppercase">
                {scanMode} Mode Active
              </span>
            </div>

             {/* AI Voice Activity Visualization */}
             <div className="flex items-center justify-center gap-1 h-12">
               {[1,2,3,4,5,6,7].map((i) => (
                 <div 
                   key={i} 
                   className="w-2 bg-green-400 rounded-full transition-all duration-75 shadow-[0_0_10px_#4ade80]"
                   style={{ height: `${Math.max(4, Math.min(48, volumeLevel * (Math.random() + 0.5) * 2))}px` }} 
                 />
               ))}
             </div>
          </div>
        )}

        {/* Scan Result Modal */}
        {scanResult && (
          <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-leaf-400 to-leaf-600"></div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2 text-leaf-700">
                  <ScanLine size={24} />
                  <h3 className="font-bold text-lg">{scanMode} Analysis</h3>
                </div>
                <button onClick={() => setScanResult(null)} className="p-1 hover:bg-gray-100 rounded-full text-gray-400">
                  <XCircle size={24} />
                </button>
              </div>
              
              <div className="prose prose-sm max-h-[60vh] overflow-y-auto mb-6 text-gray-700 leading-relaxed whitespace-pre-wrap">
                {scanResult}
              </div>

              <button 
                onClick={() => setScanResult(null)}
                className="w-full py-3 bg-leaf-600 hover:bg-leaf-700 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="bg-black/90 p-6 pb-8 flex justify-center items-center gap-8 text-white z-20">
         <button 
           onClick={() => setIsMuted(!isMuted)} 
           className={`p-4 rounded-full transition-all ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 hover:bg-white/20'}`}
         >
           {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
         </button>

         {/* Deep Scan / Shutter Button */}
         <div className="relative group cursor-pointer" onClick={handleDeepScan}>
            <div className={`absolute inset-0 bg-green-500 rounded-full blur opacity-20 group-hover:opacity-60 transition duration-500 ${isConnected ? 'animate-pulse-slow' : ''}`} />
            <div className="relative w-20 h-20 rounded-full border-4 border-white flex flex-col items-center justify-center bg-white/10 backdrop-blur-sm hover:scale-105 transition-transform active:scale-95">
                {isScanning ? (
                  <Loader2 className="animate-spin text-white" size={32} />
                ) : (
                  <>
                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center">
                       <Camera className="text-leaf-600" size={24} />
                    </div>
                  </>
                )}
            </div>
            {!isScanning && <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider font-bold text-white/80 whitespace-nowrap">
               Scan {scanMode === 'General' ? '' : scanMode}
            </span>}
         </div>

         <button 
           onClick={() => setIsVideoPaused(!isVideoPaused)}
           className={`p-4 rounded-full transition-all ${isVideoPaused ? 'bg-red-500/20 text-red-400' : 'bg-white/10 hover:bg-white/20'}`}
         >
           {isVideoPaused ? <VideoOff size={24} /> : <Video size={24} />}
         </button>
      </div>
    </div>
  );
};

export default LiveAgronomist;