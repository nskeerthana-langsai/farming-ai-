
import React, { useState, useEffect, useRef } from 'react';
import { 
  Leaf, CloudSun, MessageSquare, ChevronRight, Wind, Droplets, MapPin, 
  Camera, Image as ImageIcon, X, BrainCircuit, Globe, ExternalLink, 
  History, Plus, Trash2, Download, Menu, ArrowLeft, Mic, TrendingUp, 
  TrendingDown, Tractor, AlertTriangle, Sprout, ShoppingBag, Truck, 
  CheckCircle2, Phone, Map, Search, Home, MoreVertical, LayoutDashboard, Settings,
  LogOut, Info, UserCheck, Lock, Loader2, AlertCircle, ArrowUp, ArrowDown, Minus,
  Cloud, RefreshCw, HelpCircle, Star, ThumbsUp, Video as VideoIcon, StopCircle,
  ThermometerSun, Zap, LineChart, FileText, BadgeAlert, Scan, SkipForward, FlaskConical, Bug, Flower2, Eye, Calendar, Clock,
  BarChart3, DollarSign, Activity, Languages, Save
} from 'lucide-react';
import LiveAgronomist from './LiveAgronomist';
import { ViewState, WeatherData, ChatMessage, ChatSession, DashboardData, FarmTask, UserProfile, MarketItem, ScanResult, UserStats, SupplyChainPartner } from '../types';
import { getFarmingWeather, chatWithAgronomist, generateFarmDashboard, transcribeAudio, analyzeSnapshot } from '../services/geminiService';

// --- Constants ---
const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

// --- Reusable UI Components ---

const DataAccuracyBanner = ({ isCustom, onScan }: { isCustom: boolean, onScan: () => void }) => (
  <div className={`text-[10px] px-2 py-1.5 rounded-md flex items-center justify-between gap-2 w-full mb-3 shadow-sm border ${
    isCustom 
      ? 'bg-green-50 text-green-800 border-green-200' 
      : 'bg-amber-50 text-amber-800 border-amber-200 cursor-pointer hover:bg-amber-100'
  }`} onClick={!isCustom ? onScan : undefined}>
    <div className="flex items-center gap-1.5">
       {isCustom ? <CheckCircle2 size={12} className="text-green-600" /> : <AlertCircle size={12} className="text-amber-600" />}
       <span className="font-semibold">{isCustom ? 'Customized for your farm' : 'Regional Data Only'}</span>
    </div>
    {!isCustom && <span className="text-[9px] font-bold bg-white/50 px-1.5 py-0.5 rounded text-amber-900 border border-amber-200/50">UPLOAD PHOTO</span>}
  </div>
);

const SimpleLineChart = ({ data }: { data: { label: string, points: number[], color: string }[] }) => {
  if (data.length === 0) return null;
  const height = 180;
  const width = 600;
  const paddingX = 40;
  const paddingY = 20;

  const allPoints = data.flatMap(d => d.points);
  
  // Guard against empty data
  if (allPoints.length === 0) {
    return (
      <div className="w-full h-40 flex items-center justify-center text-gray-400 text-sm bg-gray-50 rounded-lg">
        No trend data available
      </div>
    );
  }

  const min = Math.min(...allPoints) * 0.98;
  const max = Math.max(...allPoints) * 1.02;
  const range = max - min || 1;

  const getY = (val: number) => height - paddingY - ((val - min) / range) * (height - 2 * paddingY);
  const getX = (index: number, total: number) => paddingX + (index / (total - 1)) * (width - 2 * paddingX);

  return (
    <div className="w-full p-4 bg-white border-b border-gray-100">
      <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
        <TrendingUp size={14} /> Trends
      </h4>
      <div className="relative w-full aspect-[3/1] max-h-40">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
             <line key={i} x1={paddingX} y1={paddingY + t * (height - 2 * paddingY)} x2={width - paddingX} y2={paddingY + t * (height - 2 * paddingY)} stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4 4" />
          ))}
          
          {data.map((series, sIdx) => {
             const pathD = series.points.map((p, i) => 
               `${i === 0 ? 'M' : 'L'} ${getX(i, series.points.length)} ${getY(p)}`
             ).join(' ');

             return (
               <g key={sIdx} className="group">
                 <path d={pathD} fill="none" stroke={series.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                 {series.points.map((p, i) => (
                   <circle key={i} cx={getX(i, series.points.length)} cy={getY(p)} r="3" fill="white" stroke={series.color} strokeWidth="2" />
                 ))}
               </g>
             );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 justify-center">
         {data.map((d, i) => (
           <div key={i} className="flex items-center gap-1.5 text-xs font-medium cursor-default">
             <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
             <span className="text-gray-700">{d.label}</span>
           </div>
         ))}
      </div>
    </div>
  );
};

const MarketPricesWidget = ({ marketPrices, userCrops, marketIntel }: { marketPrices: MarketItem[], userCrops?: string, marketIntel?: any }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const isUserCrop = (cropName: string) => {
    if (!userCrops) return false;
    const userCropList = userCrops.toLowerCase().split(',').map(c => c.trim());
    const marketCrop = cropName.toLowerCase();
    return userCropList.some(u => 
      marketCrop.includes(u) || 
      u.includes(marketCrop) || 
      marketCrop.replace(/e?s$/, '') === u || 
      u.replace(/e?s$/, '') === marketCrop
    );
  };

  const sortedPrices = React.useMemo(() => {
    const prices = [...marketPrices];
    return prices.sort((a, b) => {
      const aIsUser = isUserCrop(a.crop);
      const bIsUser = isUserCrop(b.crop);
      if (aIsUser && !bIsUser) return -1;
      if (!aIsUser && bIsUser) return 1;
      return 0;
    });
  }, [marketPrices, userCrops]);

  // Generate Chart Data for Top 5 Crops (after filter)
  const chartData = React.useMemo(() => {
    // Filter by search term first to let user visualize searched crops
    const filtered = sortedPrices.filter(i => i.crop.toLowerCase().includes(searchTerm.toLowerCase()));
    const top5 = filtered.slice(0, 5);
    const colors = ['#16a34a', '#2563eb', '#d97706', '#9333ea', '#dc2626'];
    
    return top5.map((item, index) => {
       // Mock history generation based on current price and trend
       const currentPrice = parseFloat(item.price.replace(/[^0-9.]/g, '')) || 500;
       const points = [];
       let price = currentPrice;
       
       // Reverse engineering approximate history to match current trend
       for (let i = 0; i < 7; i++) {
          points.unshift(price);
          // If trend is UP, previous price was lower. If DOWN, previous price was higher.
          const changeFactor = item.trend === 'up' ? -1 : item.trend === 'down' ? 1 : 0;
          const trendDrift = changeFactor * 0.02; // 2% drift per day based on trend
          
          price = price * (1 + trendDrift + (Math.random() - 0.5) * 0.03); // Add some noise
       }
       
       return {
         label: item.crop,
         points: points,
         color: colors[index % colors.length]
       };
    });
  }, [sortedPrices, searchTerm]);

  return (
    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[700px]">
      <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-white to-gray-50">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <ShoppingBag size={18} className="text-gray-400" /> Market Intelligence
        </h3>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search crops..." 
            className="pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {marketIntel && (
        <div className="bg-blue-50/80 backdrop-blur-sm px-4 py-3 border-b border-blue-100 shrink-0">
           <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600"><LineChart size={16} /></div>
              <div className="flex-1">
                 <div className="flex justify-between items-center">
                    <p className="font-bold text-blue-900 text-sm">Predictor: {marketIntel.pricePrediction}</p>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{marketIntel.bestTimeToSell}</span>
                 </div>
                 {marketIntel.chemicalFreeMarkets && marketIntel.chemicalFreeMarkets.length > 0 && (
                   <div className="mt-1 flex flex-wrap gap-1">
                      {marketIntel.chemicalFreeMarkets.slice(0,3).map((m: string, i: number) => (
                         <span key={i} className="px-1.5 py-0.5 bg-white/60 text-blue-800 rounded border border-blue-200 text-[9px] font-semibold">{m}</span>
                      ))}
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}
      
      {/* Chart Section */}
      <SimpleLineChart data={chartData} />

      <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-200">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0 z-10 shadow-sm ring-1 ring-gray-100">
            <tr>
              <th className="px-5 py-3">Crop</th>
              <th className="px-5 py-3">Price</th>
              <th className="px-5 py-3">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedPrices
              .filter(i => i.crop.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((item, i) => {
                const isRecommended = isUserCrop(item.crop);
                return (
                  <tr key={i} className={`transition-colors ${isRecommended ? 'bg-amber-50/70 hover:bg-amber-100/80' : 'hover:bg-gray-50'}`}>
                    <td className="px-5 py-3">
                      <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                           {isRecommended && <Star size={14} className="text-amber-500 fill-amber-500 animate-in zoom-in" />}
                           <span className={`font-medium text-base ${isRecommended ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>{item.crop}</span>
                        </div>
                        {isRecommended && (
                          <span className="ml-6 flex items-center gap-1 mt-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
                             Given by User
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 font-medium">{item.price}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        item.trend === 'up' ? 'bg-green-100 text-green-700' : 
                        item.trend === 'down' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {item.trend === 'up' && <TrendingUp size={12} />}
                        {item.trend === 'down' && <TrendingDown size={12} />}
                        {item.change}
                      </span>
                    </td>
                  </tr>
                );
              })}
            {marketPrices.length === 0 && (
              <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-400">Loading market data...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Main App Component ---

const App = () => {
  // --- State Initialization with LocalStorage ---

  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('agrivision_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const [weather, setWeather] = useState<WeatherData | null>(() => {
    try {
      const saved = localStorage.getItem('agrivision_weather');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(() => {
    try {
      const saved = localStorage.getItem('agrivision_dashboard');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });
  
  // View State
  const [view, setView] = useState<ViewState>(ViewState.DASHBOARD);
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: 'Hello! I am your AgriVision assistant. Ask me anything about your farm, soil, or crops.', timestamp: new Date() }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [useDeepThinking, setUseDeepThinking] = useState(false);
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Media Inputs State
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingVideo, setPendingVideo] = useState<{data: string, mimeType: string} | null>(null);

  // History State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  // General State
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [isRefreshingDash, setIsRefreshingDash] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isAnalyzingScan, setIsAnalyzingScan] = useState(false);

  // Modals State
  const [activeModal, setActiveModal] = useState<'about' | 'soilHistory' | 'scanHistory' | 'profile' | 'addPartner' | null>(null);
  const [selectedTask, setSelectedTask] = useState<FarmTask | null>(null);
  
  // Supply Chain State
  const [supplyChainSearchTerm, setSupplyChainSearchTerm] = useState('');
  const [partnerForm, setPartnerForm] = useState<SupplyChainPartner>({
    name: '',
    type: '',
    priceOffer: '',
    distance: '',
    contact: ''
  });

  // Login Form State
  const [loginForm, setLoginForm] = useState({
    name: '',
    farmName: '',
    farmSize: '',
    primaryCrops: '',
    location: '',
    language: 'en'
  });

  // Profile Edit State
  const [profileForm, setProfileForm] = useState<UserProfile | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Effects for Persistence ---

  useEffect(() => {
    if (user) {
      localStorage.setItem('agrivision_user', JSON.stringify(user));
      // Trigger onboarding if not complete
      if (!user.hasOnboarded) {
         setIsOnboarding(true);
      }
    } else {
      localStorage.removeItem('agrivision_user');
    }
  }, [user]);

  useEffect(() => {
    if (weather) {
      localStorage.setItem('agrivision_weather', JSON.stringify(weather));
    }
  }, [weather]);

  useEffect(() => {
    if (dashboardData) {
      localStorage.setItem('agrivision_dashboard', JSON.stringify(dashboardData));
      setIsSaving(true);
      const timer = setTimeout(() => setIsSaving(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [dashboardData]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('agrivision_scan_history');
      if (saved) {
        setScanHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load scan history", e);
    }
  }, []);

  const handleSaveScan = (scan: ScanResult) => {
    setScanHistory(prev => {
      const updated = [scan, ...prev];
      localStorage.setItem('agrivision_scan_history', JSON.stringify(updated));
      return updated;
    });
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1000);
  };

  useEffect(() => {
    if (user && !isOnboarding) {
      const fetchData = async () => {
        setIsLoadingWeather(true);
        
        if (user.location && user.location.length > 3) {
           try {
              const wData = await getFarmingWeather(user.location);
              setWeather(wData);
              setIsRefreshingDash(true);
              const dash = await generateFarmDashboard(wData, user);
              setDashboardData(dash);
              setIsLoadingWeather(false);
              setIsRefreshingDash(false);
              return; 
           } catch(e) {
              console.warn("Location string fetch failed, trying GPS...", e);
           }
        }

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                const wData = await getFarmingWeather({ lat: position.coords.latitude, lng: position.coords.longitude });
                setWeather(wData);
                setIsRefreshingDash(true);
                const dash = await generateFarmDashboard(wData, user);
                setDashboardData(dash);
              } catch (e) {
                console.error(e);
              } finally {
                setIsLoadingWeather(false);
                setIsRefreshingDash(false);
              }
            },
            (err) => {
              if (!weather) {
                setWeather({
                    location: user.location || "Location Unavailable",
                    temperature: "--",
                    condition: "Manual Mode",
                    humidity: "--",
                    farmingAdvice: "Please update your location settings.",
                    forecast: "Forecast unavailable."
                });
                // Initialize default empty dashboard
                setDashboardData(null); 
              }
              setIsLoadingWeather(false);
            }
          );
        } else {
           setIsLoadingWeather(false);
        }
      };

      if (!weather || !dashboardData) {
        fetchData();
      }
    }
  }, [user?.name, user?.location, isOnboarding]); 

  useEffect(() => {
    try {
      const saved = localStorage.getItem('agrivision_chats');
      if (saved) {
        setSessions(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  useEffect(() => {
    if (chatMessages.length <= 1 && !currentSessionId) return;
    const saveTimeout = setTimeout(() => {
      saveCurrentSession();
    }, 1000);
    return () => clearTimeout(saveTimeout);
  }, [chatMessages, currentSessionId]);

  const saveCurrentSession = () => {
    const title = chatMessages.find(m => m.role === 'user')?.text.slice(0, 30) + '...' || 'New Conversation';
    const preview = chatMessages[chatMessages.length - 1]?.text.slice(0, 50) + '...' || '';
    
    const newSession: ChatSession = {
      id: currentSessionId || Date.now().toString(),
      title: title,
      lastModified: Date.now(),
      preview: preview,
      messages: chatMessages
    };

    setSessions(prev => {
      const existingIndex = prev.findIndex(s => s.id === newSession.id);
      let updated;
      if (existingIndex >= 0) {
        updated = [...prev];
        updated[existingIndex] = newSession;
      } else {
        updated = [newSession, ...prev];
      }
      updated.sort((a, b) => b.lastModified - a.lastModified);
      localStorage.setItem('agrivision_chats', JSON.stringify(updated));
      return updated;
    });

    if (!currentSessionId) {
      setCurrentSessionId(newSession.id);
    }
  };

  const loadSession = (session: ChatSession) => {
    setChatMessages(session.messages);
    setCurrentSessionId(session.id);
    setIsHistoryOpen(false);
    setView(ViewState.CHAT);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    localStorage.setItem('agrivision_chats', JSON.stringify(updated));
    if (currentSessionId === id) handleNewChat();
  };

  const handleNewChat = () => {
    setChatMessages([{ id: Date.now().toString(), role: 'model', text: 'Hello! I am your AgriVision assistant. Ask me anything about your farm, soil, or crops.', timestamp: new Date() }]);
    setCurrentSessionId(null);
    setIsHistoryOpen(false);
    setView(ViewState.CHAT);
  };

  const handleExportChat = () => {
    const text = chatMessages.map(m => `[${m.role.toUpperCase()}] ${new Date(m.timestamp).toLocaleTimeString()}: ${m.text}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agrivision-chat-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setPendingImage(base64String);
        setPendingVideo(null); // Clear other media
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setPendingVideo({
          data: base64String,
          mimeType: file.type || 'video/mp4'
        });
        setPendingImage(null); // Clear other media
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Onboarding Logic ---
  
  const handleOnboardingScan = (event: React.ChangeEvent<HTMLInputElement>) => {
     const file = event.target.files?.[0];
     if (file) {
       setIsAnalyzingScan(true);
       const reader = new FileReader();
       reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          try {
             const analysis = await analyzeSnapshot(base64, "General Farm");
             completeOnboarding(analysis);
          } catch(e) {
             completeOnboarding(); // Fallback to skip if error
          }
       };
       reader.readAsDataURL(file);
     }
  };

  const completeOnboarding = (calibrationData?: string) => {
     if (user) {
        const updatedUser = { 
           ...user, 
           hasOnboarded: true,
           calibrationData: calibrationData 
        };
        
        // Save initial scan if exists
        if (calibrationData) {
           handleSaveScan({
              id: Date.now().toString(),
              timestamp: Date.now(),
              mode: 'Initial Calibration',
              analysis: calibrationData
           });
        }

        setUser(updatedUser);
        setIsOnboarding(false);
        setIsAnalyzingScan(false);
     }
  };

  const triggerRescan = () => {
    setIsOnboarding(true);
  };

  // --- Audio Recording Logic ---

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          setIsChatLoading(true);
          try {
            const transcription = await transcribeAudio(base64, 'audio/webm');
            if (transcription) {
              setChatInput(prev => (prev ? prev + " " : "") + transcription);
            }
          } catch (e) {
            console.error("Transcription failed", e);
          } finally {
            setIsChatLoading(false);
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied or error", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  // --- Send Logic ---

  const handleSendMessage = async (inputOverride?: string) => {
    const textToSend = inputOverride || chatInput;
    if (!textToSend.trim() && !pendingImage && !pendingVideo) return;
    
    const userMsg: ChatMessage = { 
      id: Date.now().toString(), 
      role: 'user', 
      text: textToSend, 
      image: pendingImage || undefined,
      video: pendingVideo?.data,
      videoMimeType: pendingVideo?.mimeType,
      timestamp: new Date() 
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setPendingImage(null);
    setPendingVideo(null);
    setIsChatLoading(true);

    try {
      // Reconstruct history
      const history = chatMessages.map(m => {
        const parts: any[] = [{ text: m.text }];
        if (m.image) parts.push({ inlineData: { mimeType: 'image/jpeg', data: m.image } });
        if (m.video && m.videoMimeType) parts.push({ inlineData: { mimeType: m.videoMimeType, data: m.video } });
        return { role: m.role, parts };
      });

      const { text, sources } = await chatWithAgronomist(
        history, 
        userMsg.text, 
        userMsg.image,
        userMsg.video ? { data: userMsg.video, mimeType: userMsg.videoMimeType! } : undefined,
        useDeepThinking
      );
      
      const botMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: text || "I didn't catch that.", 
        sources: sources,
        timestamp: new Date() 
      };
      setChatMessages(prev => [...prev, botMsg]);
    } catch (e) {
      console.error(e);
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const toggleTaskPriority = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!dashboardData) return;

    const priorities: FarmTask['priority'][] = ['low', 'medium', 'high'];
    
    const updatedTasks = dashboardData.tasks.map(t => {
      if (t.id === taskId) {
        const currentIndex = priorities.indexOf(t.priority);
        const nextIndex = (currentIndex + 1) % priorities.length;
        return { ...t, priority: priorities[nextIndex] };
      }
      return t;
    });

    setDashboardData({ ...dashboardData, tasks: updatedTasks });
  };

  const sortedTasks = React.useMemo(() => {
    if (!dashboardData) return [];
    const weights = { high: 3, medium: 2, low: 1 };
    return [...dashboardData.tasks].sort((a, b) => {
       const weightA = weights[a.priority] || 1;
       const weightB = weights[b.priority] || 1;
       return weightB - weightA;
    });
  }, [dashboardData]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginForm.name.trim() && loginForm.farmName.trim() && loginForm.farmSize.trim() && loginForm.primaryCrops.trim()) {
      const newUser: UserProfile = {
        name: loginForm.name,
        farmName: loginForm.farmName,
        role: 'Farm Manager',
        farmSize: loginForm.farmSize,
        primaryCrops: loginForm.primaryCrops,
        location: loginForm.location,
        hasOnboarded: false, // Trigger onboarding next
        language: loginForm.language
      };
      setUser(newUser);
    }
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (profileForm) {
      setUser(profileForm);
      setActiveModal(null);
      // Trigger a refresh of the dashboard to reflect new settings if needed
      setDashboardData(null); // This will trigger the fetch effect
    }
  };

  const handleAddPartnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dashboardData) return;
    
    if (partnerForm.name && partnerForm.type && partnerForm.contact) {
      const newPartner = { ...partnerForm };
      const updatedSupplyChain = [...dashboardData.supplyChain, newPartner];
      setDashboardData({ ...dashboardData, supplyChain: updatedSupplyChain });
      setPartnerForm({ name: '', type: '', priceOffer: '', distance: '', contact: '' });
      setActiveModal(null);
    }
  };

  const renderAnalyticsView = () => {
    // Dynamic Data from Dashboard (AI Generated based on user input)
    const stats = dashboardData?.analytics || {
      totalHarvest: "--",
      revenue: "--",
      activeCrops: 0,
      efficiency: 0,
      history: {
        labels: [],
        revenue: [], 
        expenses: []
      }
    };

    const chartData = [
      { label: "Revenue", points: stats.history.revenue, color: '#16a34a' },
      { label: "Expenses", points: stats.history.expenses, color: '#dc2626' }
    ];

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="flex justify-between items-center">
           <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                 <BarChart3 className="text-green-600" size={28} /> Farm Analytics
              </h2>
              <p className="text-gray-500 text-sm mt-1">Projected metrics based on your farm profile ({user?.farmSize}, {user?.primaryCrops})</p>
           </div>
           <div className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm">
              Projected (6 Mo)
           </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           {/* Card 1: Revenue */}
           <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                 <div className="p-2 bg-green-50 text-green-600 rounded-lg"><DollarSign size={20}/></div>
                 <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Est.</span>
              </div>
              <p className="text-gray-500 text-sm">Potential Revenue</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.revenue}</h3>
           </div>
           
           {/* Card 2: Harvest */}
           <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                 <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Tractor size={20}/></div>
                 <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Est.</span>
              </div>
              <p className="text-gray-500 text-sm">Expected Harvest</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.totalHarvest}</h3>
           </div>

           {/* Card 3: Efficiency */}
           <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                 <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Activity size={20}/></div>
                 <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stats.efficiency > 70 ? 'text-blue-600 bg-blue-100' : 'text-amber-600 bg-amber-100'}`}>
                    {stats.efficiency > 70 ? 'Good' : 'Needs Impr.'}
                 </span>
              </div>
              <p className="text-gray-500 text-sm">Efficiency Score</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.efficiency}/100</h3>
           </div>

           {/* Card 4: Active Crops */}
           <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                 <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Sprout size={20}/></div>
              </div>
              <p className="text-gray-500 text-sm">Active Crops</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.activeCrops}</h3>
           </div>
        </div>

        {/* Main Chart Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <SimpleLineChart data={chartData} />
           </div>

           {/* Side Details */}
           <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-4">Crop Performance</h3>
              <div className="space-y-4">
                 {/* Mock performance distribution for visual effect, labels based on user input if possible */}
                 {user?.primaryCrops.split(',').slice(0, 3).map((crop, i) => {
                   const colors = ['bg-amber-500', 'bg-yellow-500', 'bg-green-500'];
                   const val = 90 - (i * 15); 
                   return (
                     <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                           <span className="font-medium text-gray-700 capitalize">{crop.trim()}</span>
                           <span className="text-gray-500">{val}% Yield</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                           <div className={`h-2 rounded-full ${colors[i % 3]}`} style={{ width: `${val}%` }}></div>
                        </div>
                     </div>
                   );
                 })}
                 {(!user?.primaryCrops || user.primaryCrops.length === 0) && <p className="text-sm text-gray-400">No crops defined.</p>}
              </div>
              
              <div className="mt-8 pt-6 border-t border-gray-100">
                 <h4 className="font-bold text-gray-900 mb-3 text-sm">Recent Expenses (Est.)</h4>
                 <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                       <span className="text-gray-600">Fertilizers</span>
                       <span className="font-medium text-red-600">-$450</span>
                    </div>
                    <div className="flex justify-between text-sm">
                       <span className="text-gray-600">Equipment Maint.</span>
                       <span className="font-medium text-red-600">-$120</span>
                    </div>
                    <div className="flex justify-between text-sm">
                       <span className="text-gray-600">Seeds</span>
                       <span className="font-medium text-red-600">-$300</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  };

  const renderSupplyChainView = () => {
    // Search Filtering Logic
    const filteredPartners = dashboardData?.supplyChain.filter(p => 
      p.name.toLowerCase().includes(supplyChainSearchTerm.toLowerCase()) || 
      p.type.toLowerCase().includes(supplyChainSearchTerm.toLowerCase())
    ) || [];

    const filteredDestinations = dashboardData?.marketIntel?.destinations?.filter(d => 
      d.name.toLowerCase().includes(supplyChainSearchTerm.toLowerCase()) || 
      d.type.toLowerCase().includes(supplyChainSearchTerm.toLowerCase())
    ) || [];

    return (
      <div className="space-y-6 animate-in fade-in">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                 <Truck className="text-green-600" size={28} /> Supply Chain Network
              </h2>
              <p className="text-gray-500 text-sm mt-1">Connect directly with buyers, cooperatives, and local markets.</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
               <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search buyers..." 
                    value={supplyChainSearchTerm}
                    onChange={(e) => setSupplyChainSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" 
                  />
               </div>
               <button 
                 onClick={() => setActiveModal('addPartner')}
                 className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap flex items-center gap-2"
               >
                  <Plus size={16} /> Add Partner
               </button>
            </div>
         </div>
  
         {/* Map Placeholder or Visual Summary */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
               <div className="flex items-center gap-2 mb-2 opacity-80"><Truck size={20} /><span className="text-sm font-medium">Logistics</span></div>
               <h3 className="text-2xl font-bold">12 Partners</h3>
               <p className="text-blue-100 text-sm">Available within 50km</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
               <div className="flex items-center gap-2 mb-2 opacity-80"><TrendingUp size={20} /><span className="text-sm font-medium">Best Price</span></div>
               <h3 className="text-2xl font-bold">$420/ton</h3>
               <p className="text-green-100 text-sm">Central Wholesale Market</p>
            </div>
             <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-white shadow-lg">
               <div className="flex items-center gap-2 mb-2 opacity-80"><ShoppingBag size={20} /><span className="text-sm font-medium">Demand</span></div>
               <h3 className="text-2xl font-bold">High</h3>
               <p className="text-amber-100 text-sm">Wheat & Corn in demand</p>
            </div>
         </div>
  
         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredPartners.map((p, i) => (
               <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col hover:border-green-300 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                           <Truck size={20} />
                        </div>
                        <div>
                           <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{p.name}</h3>
                           <span className="text-xs font-medium text-gray-500">{p.type}</span>
                        </div>
                     </div>
                     <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-md flex items-center gap-1">
                        <MapPin size={10} /> {p.distance}
                     </span>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                     <div className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-sm text-gray-500">Price Offer</span>
                        <span className="text-base font-bold text-green-700">{p.priceOffer}</span>
                     </div>
                     <div className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-sm text-gray-500">Contact</span>
                        <span className="text-sm font-medium text-gray-900">{p.contact}</span>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mt-auto">
                     <button onClick={() => window.location.href = `tel:${p.contact}`} className="flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
                        <Phone size={16} /> Call
                     </button>
                     <button 
                        onClick={() => {
                          setView(ViewState.CHAT);
                          setTimeout(() => handleSendMessage(`Help me negotiate with ${p.name} (${p.type}) who is offering ${p.priceOffer}. What should I say?`), 100);
                        }}
                        className="flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition shadow-sm"
                      >
                        <MessageSquare size={16} /> Negotiate
                     </button>
                  </div>
               </div>
            ))}
            
             {filteredDestinations.map((d, i) => (
               <div key={`dest-${i}`} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col hover:border-amber-300 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                           <ShoppingBag size={20} />
                        </div>
                        <div>
                           <h3 className="font-bold text-gray-900 group-hover:text-amber-600 transition-colors">{d.name}</h3>
                           <span className="text-xs font-medium text-gray-500">Marketplace</span>
                        </div>
                     </div>
                     <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-md flex items-center gap-1">
                        <MapPin size={10} /> {d.distance}
                     </span>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                     <div className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-sm text-gray-500">Market Rate</span>
                        <span className="text-base font-bold text-amber-700">{d.price}</span>
                     </div>
                     <div className="flex justify-between items-center py-2 border-b border-gray-50">
                        <span className="text-sm text-gray-500">Type</span>
                        <span className="text-sm font-medium text-gray-900">{d.type}</span>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mt-auto">
                     <button onClick={() => window.location.href = `tel:${d.contact}`} className="flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
                        <Phone size={16} /> Call
                     </button>
                     <button 
                        onClick={() => {
                          const query = `${d.name} near ${user?.location || ''}`;
                          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
                        }}
                        className="flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition shadow-sm"
                      >
                        <Map size={16} /> Navigate
                     </button>
                  </div>
               </div>
            ))}

            {filteredPartners.length === 0 && filteredDestinations.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400">
                    <p>No partners found matching "{supplyChainSearchTerm}".</p>
                </div>
            )}
         </div>
      </div>
    );
  };

  const renderCalendarView = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid = [];
    for (let i = 0; i < firstDay; i++) grid.push(null);
    for (let i = 1; i <= daysInMonth; i++) grid.push(i);

    const getTasksForDay = (day: number) => {
       if (!dashboardData?.tasks) return [];
       return dashboardData.tasks.filter(t => {
          const d = t.date.toLowerCase();
          if (day === today.getDate() && d.includes('today')) return true;
          if (day === today.getDate() + 1 && d.includes('tomorrow')) return true;
          // Simple parsing for dates starting with numbers
          const match = d.match(/^(\d+)/);
          if (match && parseInt(match[1]) === day) return true;
          return false;
       });
    };

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="flex items-center justify-between mb-4">
           <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                 <Calendar className="text-green-600" size={28} /> Farming Calendar
              </h2>
              <p className="text-gray-500 text-sm mt-1">Schedule and task management</p>
           </div>
           <div className="text-lg font-bold text-gray-700 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
              {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
           </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
               {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">{d}</div>
               ))}
            </div>
            <div className="grid grid-cols-7 auto-rows-fr bg-gray-100 gap-px border-b border-gray-200">
               {grid.map((day, i) => (
                  <div key={i} className={`min-h-[140px] bg-white p-2 flex flex-col gap-1 transition-colors hover:bg-gray-50/80 ${!day ? 'bg-gray-50/30' : ''}`}>
                     {day && (
                        <>
                           <div className="flex justify-between items-start">
                              <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold ${
                                 day === today.getDate() ? 'bg-green-600 text-white shadow-md' : 'text-gray-700'
                              }`}>
                                 {day}
                              </span>
                              {day === today.getDate() && <span className="text-[10px] font-bold text-green-600 uppercase">Today</span>}
                           </div>
                           
                           <div className="mt-1 flex-1 space-y-1.5 overflow-y-auto max-h-[100px] no-scrollbar">
                              {getTasksForDay(day).map(task => (
                                 <div 
                                    key={task.id}
                                    onClick={() => setSelectedTask(task)}
                                    className={`p-2 rounded-lg border text-xs font-medium cursor-pointer shadow-sm transition-all hover:scale-[1.02] active:scale-95 ${
                                       task.priority === 'high' ? 'bg-red-50 border-red-100 text-red-700' :
                                       task.priority === 'medium' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                       'bg-blue-50 border-blue-100 text-blue-700'
                                    }`}
                                 >
                                    <p className="truncate">{task.title}</p>
                                 </div>
                              ))}
                              {/* Placeholder for demo if no tasks on current day */}
                              {day === today.getDate() && getTasksForDay(day).length === 0 && (
                                 <div className="text-[10px] text-gray-400 italic text-center mt-4">No tasks planned</div>
                              )}
                           </div>
                        </>
                     )}
                  </div>
               ))}
            </div>
        </div>
      </div>
    );
  };

  const renderLoginView = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-500">
        <div className="bg-green-600 p-8 text-center">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Leaf className="text-green-600" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">AgriVision AI</h1>
            <p className="text-green-100 text-sm mt-2">Intelligent Farming Assistant</p>
        </div>
        
        {/* Language Selection on Login */}
        <div className="flex justify-center gap-2 mt-6">
           {LANGUAGES.map(lang => (
             <button
               key={lang.code}
               type="button"
               onClick={() => setLoginForm({ ...loginForm, language: lang.code })}
               className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                 loginForm.language === lang.code
                   ? 'bg-green-100 border-green-300 text-green-800'
                   : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
               }`}
             >
               {lang.flag} {lang.label}
             </button>
           ))}
        </div>

        <form onSubmit={handleLoginSubmit} className="p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <div className="relative">
              <UserCheck className="absolute left-3 top-3 text-gray-400" size={20} />
              <input 
                type="text" 
                required
                value={loginForm.name}
                onChange={(e) => setLoginForm({...loginForm, name: e.target.value})}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition text-gray-900 placeholder-gray-400"
                placeholder="Enter your name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Farm Name</label>
            <div className="relative">
              <Tractor className="absolute left-3 top-3 text-gray-400" size={20} />
              <input 
                type="text" 
                required
                value={loginForm.farmName}
                onChange={(e) => setLoginForm({...loginForm, farmName: e.target.value})}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition text-gray-900 placeholder-gray-400"
                placeholder="e.g. Green Valley Farms"
              />
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
             <Info className="text-blue-500 shrink-0 mt-0.5" size={18} />
             <p className="text-xs text-blue-700 leading-relaxed">
               <span className="font-bold">Why do we need this?</span><br/>
               We use your farm size and primary crops to calculate precise yield predictions and market prices. Your location helps us fetch relevant weather and soil data.
             </p>
          </div>

          <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Farm Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 text-gray-400" size={20} />
                <input 
                  type="text" 
                  value={loginForm.location}
                  onChange={(e) => setLoginForm({...loginForm, location: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition text-gray-900 placeholder-gray-400"
                  placeholder="e.g. Sacramento, CA"
                />
              </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Farm Size</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 text-gray-400" size={20} />
                <input 
                  type="text" 
                  required
                  value={loginForm.farmSize}
                  onChange={(e) => setLoginForm({...loginForm, farmSize: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition text-gray-900 placeholder-gray-400"
                  placeholder="e.g. 50 acres"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Primary Crops</label>
              <div className="relative">
                <Sprout className="absolute left-3 top-3 text-gray-400" size={20} />
                <input 
                  type="text" 
                  required
                  value={loginForm.primaryCrops}
                  onChange={(e) => setLoginForm({...loginForm, primaryCrops: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition text-gray-900 placeholder-gray-400"
                  placeholder="e.g. Wheat, Corn"
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full py-3.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-lg shadow-green-200"
          >
            <Lock size={18} /> Access Dashboard
          </button>
        </form>
        
        <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
            <p className="text-xs text-gray-400">Secure AI-Powered Platform</p>
        </div>
      </div>
    </div>
  );

  const renderOnboardingView = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
       <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8 text-center animate-in fade-in slide-in-from-bottom-5">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
             <Scan size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Calibrate Your Farm</h2>
          <p className="text-gray-500 mb-8 max-w-sm mx-auto">
             Upload a photo of your field or soil. Our AI will analyze it to provide 
             <span className="font-bold text-green-600"> precision customization</span> for soil health, pests, and risks.
          </p>
          
          {isAnalyzingScan ? (
             <div className="py-8">
                <Loader2 size={40} className="animate-spin text-green-600 mx-auto mb-4" />
                <p className="text-sm font-medium text-gray-600">Analyzing soil composition...</p>
             </div>
          ) : (
             <div className="space-y-4">
                <button 
                  onClick={() => scanInputRef.current?.click()}
                  className="w-full py-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition flex items-center justify-center gap-3 shadow-lg shadow-green-200"
                >
                   <Camera size={20} />
                   Scan / Upload Photo
                </button>
                <input type="file" ref={scanInputRef} className="hidden" accept="image/*" onChange={handleOnboardingScan} />
                
                <button 
                   onClick={() => completeOnboarding()}
                   className="w-full py-3 text-gray-500 font-medium hover:text-gray-800 transition flex items-center justify-center gap-2"
                >
                   Skip for now <SkipForward size={16} />
                </button>
             </div>
          )}
          
          <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-2 text-xs text-gray-400">
             <Info size={14} />
             <span>Skipping uses regional average data instead.</span>
          </div>
       </div>
    </div>
  );

  const renderSidebar = () => (
    <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex flex-col h-full">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mr-3">
            <Leaf className="text-white" size={20} />
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">AgriVision</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {[
            { id: ViewState.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
            { id: ViewState.SUPPLY_CHAIN, icon: Truck, label: 'Supply Chain' },
            { id: ViewState.CALENDAR, icon: Calendar, label: 'Calendar' },
            { id: ViewState.ANALYTICS, icon: BarChart3, label: 'Analytics' },
            { id: ViewState.CHAT, icon: MessageSquare, label: 'AI Consultant' },
            { id: ViewState.LIVE_SCANNER, icon: Camera, label: 'Field Scanner' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => { setView(item.id); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                view === item.id 
                  ? 'bg-green-50 text-green-700' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon size={20} className={`mr-3 ${view === item.id ? 'text-green-600' : 'text-gray-400'}`} />
              {item.label}
            </button>
          ))}
          
           <button
              onClick={() => { setActiveModal('scanHistory'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-50 hover:text-gray-900`}
            >
              <History size={20} className="mr-3 text-gray-400" />
              Scan History
            </button>

          <div className="mt-4 px-4 py-3 bg-blue-50 rounded-lg border border-blue-100 flex items-center gap-2">
             {isSaving ? (
                <RefreshCw size={14} className="text-blue-500 animate-spin" />
             ) : (
                <Cloud size={14} className="text-blue-500" />
             )}
             <span className="text-xs font-medium text-blue-700">
                {isSaving ? "Syncing to Cloud..." : "Cloud Connected"}
             </span>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-1">
           <button 
             onClick={() => {
               if (user) setProfileForm({...user});
               setActiveModal('profile');
             }}
             className="flex items-center w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition"
           >
             <Settings size={20} className="mr-3 text-gray-400" />
             Profile & Settings
           </button>
           <button 
             onClick={() => setActiveModal('about')}
             className="flex items-center w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition"
           >
             <Info size={20} className="mr-3 text-gray-400" />
             About Us
           </button>
           <button 
             onClick={() => {
                setUser(null);
                setWeather(null);
                setDashboardData(null);
                localStorage.removeItem('agrivision_user');
             }}
             className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
           >
             <LogOut size={20} className="mr-3 text-red-400" />
             Logout
           </button>
           
           <div className="mt-4 flex items-center px-4 pt-4 border-t border-gray-100">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.farmName}</p>
              </div>
           </div>
        </div>
      </div>
    </aside>
  );

  const renderDashboardView = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Farm Overview</h1>
           <p className="text-gray-500 text-sm">Welcome back, {user?.name}. Here's your personalized report.</p>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={() => setView(ViewState.LIVE_SCANNER)}
             className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-sm font-medium text-sm"
           >
             <Camera size={18} />
             New Scan
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Weather Card */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-200 flex flex-col justify-between">
           <div className="flex justify-between items-start">
             <div>
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                   <MapPin size={14} />
                   {isLoadingWeather ? "Locating..." : (weather?.location || "Unknown")}
                </div>
                <div className="text-3xl font-bold text-gray-900 mt-1">{weather?.temperature || "--"}</div>
                <div className="text-green-600 font-medium">{weather?.condition}</div>
             </div>
             <div className="p-3 bg-blue-50 text-blue-500 rounded-full">
               <CloudSun size={24} />
             </div>
           </div>
           <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Droplets size={16} className="text-blue-400" />
                <span>Humidity: <span className="font-semibold text-gray-900">{weather?.humidity || "--"}</span></span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Wind size={16} className="text-gray-400" />
                <span>Wind: <span className="font-semibold text-gray-900">5 km/h</span></span>
              </div>
           </div>
        </div>

        {/* Irrigation / Overwatering Alert Card */}
        <div className={`rounded-xl p-5 shadow-sm border flex flex-col justify-between ${
          dashboardData?.irrigation.status === 'overwatering_alert' 
            ? 'bg-red-50 border-red-200' 
            : 'bg-white border-gray-200'
        }`}>
           <DataAccuracyBanner isCustom={!!user?.calibrationData} onScan={triggerRescan} />
           <div className="flex items-center justify-between mb-4">
             <div className={`p-2 rounded-lg ${dashboardData?.irrigation.status === 'overwatering_alert' ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                {dashboardData?.irrigation.status === 'overwatering_alert' ? <BadgeAlert size={20} /> : <Droplets size={20} />}
             </div>
             <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
               dashboardData?.irrigation.status === 'water' ? 'bg-blue-100 text-blue-700' : 
               dashboardData?.irrigation.status === 'delay' ? 'bg-yellow-100 text-yellow-700' :
               dashboardData?.irrigation.status === 'overwatering_alert' ? 'bg-red-200 text-red-800' :
               'bg-green-100 text-green-700'
             }`}>
               {dashboardData?.irrigation.status === 'overwatering_alert' ? 'High Risk' : dashboardData?.irrigation.status}
             </span>
           </div>
           <h3 className="text-gray-500 text-sm font-medium">Soil Moisture & Risk</h3>
           <div className="text-2xl font-bold text-gray-900 mt-1">{dashboardData?.irrigation.moisture || "--"}</div>
           <p className={`text-xs mt-2 ${dashboardData?.irrigation.status === 'overwatering_alert' ? 'text-red-700 font-semibold' : 'text-gray-400'}`}>
             {dashboardData?.irrigation.message || "Analyzing..."}
           </p>
        </div>

        {/* Soil Health Passport Mini Card */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 flex flex-col cursor-pointer hover:border-amber-300 transition group" onClick={() => setActiveModal('soilHistory')}>
           <DataAccuracyBanner isCustom={!!user?.calibrationData} onScan={triggerRescan} />
           <div className="flex items-center justify-between mb-4">
             <div className="p-2 bg-amber-50 rounded-lg text-amber-700"><FileText size={20} /></div>
             <span className="text-xs text-amber-700 font-bold bg-amber-100 px-2 py-1 rounded">HEALTH PASSPORT</span>
           </div>
           <h3 className="text-gray-500 text-sm font-medium">Nutrient Balance</h3>
           {dashboardData?.soilHealth ? (
             <div className="mt-2 space-y-1">
               <div className="flex justify-between text-xs"><span>N:</span><span className="font-bold">{dashboardData.soilHealth.npk.n.toUpperCase()}</span></div>
               <div className="flex justify-between text-xs"><span>P:</span><span className="font-bold">{dashboardData.soilHealth.npk.p.toUpperCase()}</span></div>
               <div className="flex justify-between text-xs"><span>K:</span><span className="font-bold">{dashboardData.soilHealth.npk.k.toUpperCase()}</span></div>
             </div>
           ) : (
             <p className="text-sm text-gray-400 mt-2">Loading...</p>
           )}
           
           <button 
             className={`w-full mt-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm ${
               user?.calibrationData 
                 ? 'bg-green-600 text-white hover:bg-green-700' 
                 : 'bg-blue-600 text-white hover:bg-blue-700'
             }`}
           >
             {user?.calibrationData ? <CheckCircle2 size={18} /> : <Info size={18} />} 
             {user?.calibrationData ? 'View Customized Plan' : 'View Regional Plan'}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {/* Climate Risk & Resilience */}
         <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
               <ThermometerSun size={18} className="text-orange-500" /> Climate Match & Risk
            </h3>
            {dashboardData?.climateRisk ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                    dashboardData.climateRisk.riskScore > 7 ? 'bg-red-100 text-red-600' :
                    dashboardData.climateRisk.riskScore > 4 ? 'bg-yellow-100 text-yellow-600' :
                    'bg-green-100 text-green-600'
                  }`}>
                    {dashboardData.climateRisk.riskScore}/10
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Climate Risk Score</p>
                    <p className="text-xs text-gray-500">{dashboardData.climateRisk.sowingWindow}</p>
                  </div>
                </div>
                
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                  <p className="text-xs font-bold text-orange-800 uppercase mb-1">Alerts</p>
                  <ul className="list-disc list-inside text-xs text-orange-700">
                    {dashboardData.climateRisk.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>

                <div>
                   <p className="text-xs font-bold text-gray-500 mb-1">Resilient Crops:</p>
                   <div className="flex flex-wrap gap-1">
                     {dashboardData.climateRisk.resilientCrops.map((c, i) => (
                       <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">{c}</span>
                     ))}
                   </div>
                </div>
              </div>
            ) : <p className="text-sm text-gray-400">Loading risk analysis...</p>}
         </div>

         {/* Energy & Resources */}
         <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
               <Zap size={18} className="text-yellow-500" /> Energy & Resources
            </h3>
            {dashboardData?.energy ? (
               <div className="space-y-4">
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                     <p className="text-xs text-yellow-800 font-bold uppercase">Solar Pump Forecast</p>
                     <p className="text-lg font-bold text-yellow-900">{dashboardData.energy.solarPumpHours}</p>
                     <p className="text-xs text-yellow-700">{dashboardData.energy.recommendation}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                     <p className="text-xs text-green-800 font-bold uppercase">Biogas Potential</p>
                     <p className="text-sm text-green-900">{dashboardData.energy.biogasPotential}</p>
                  </div>
               </div>
            ) : <p className="text-sm text-gray-400">Loading energy data...</p>}
         </div>
         
         {/* Enhanced Pest Forecast */}
         <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
           <DataAccuracyBanner isCustom={!!user?.calibrationData} onScan={triggerRescan} />
           <div className="flex items-center justify-between mb-4">
             <div className="p-2 bg-red-50 rounded-lg text-red-600"><AlertTriangle size={20} /></div>
             <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
               dashboardData?.pestForecast.risk === 'high' ? 'bg-red-100 text-red-700' : 
               dashboardData?.pestForecast.risk === 'medium' ? 'bg-orange-100 text-orange-700' :
               'bg-green-100 text-green-700'
             }`}>
               {dashboardData?.pestForecast.risk || 'Low'}
             </span>
           </div>
           <h3 className="text-gray-500 text-sm font-medium">Pest & IPM Strategy</h3>
           <div className="text-sm font-medium text-gray-900 mt-2 line-clamp-2 mb-3">
             {dashboardData?.pestForecast.alert || "No immediate alerts."}
           </div>
           {dashboardData?.pestForecast.ipmSuggestions && (
             <div className="bg-gray-50 p-2 rounded text-xs text-gray-600">
               <strong>IPM Advice:</strong>
               <ul className="list-disc list-inside mt-1">
                 {dashboardData.pestForecast.ipmSuggestions.slice(0, 2).map((s, i) => <li key={i}>{s}</li>)}
               </ul>
             </div>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MarketPricesWidget 
            marketPrices={dashboardData?.marketPrices || []} 
            userCrops={user?.primaryCrops}
            marketIntel={dashboardData?.marketIntel} 
        />

        <div className="space-y-6">
           <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl p-5 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-4 right-4 z-10">
                 {user?.calibrationData ? (
                    <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full border border-white/30 font-bold flex items-center gap-1">
                       <CheckCircle2 size={10} /> Customized
                    </span>
                 ) : (
                    <button onClick={triggerRescan} className="text-[10px] bg-amber-400 text-amber-900 px-2 py-1 rounded-full font-bold flex items-center gap-1 hover:bg-amber-300">
                       <AlertCircle size={10} /> Improve Accuracy
                    </button>
                 )}
              </div>
              <div className="flex items-center gap-2 mb-4 opacity-80">
                <Sprout size={18} />
                <span className="text-sm font-medium">Yield Prediction</span>
              </div>
              <h4 className="text-2xl font-bold">{dashboardData?.yieldPrediction.amount || "--"}</h4>
              <p className="text-indigo-200 text-sm mt-1 mb-4">{dashboardData?.yieldPrediction.crop || "Calculating..."}</p>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-xs leading-relaxed text-indigo-100 border border-white/10">
                "{dashboardData?.yieldPrediction.advice || "Connect to weather for analysis"}"
              </div>
           </div>

           <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <DataAccuracyBanner isCustom={!!user?.calibrationData} onScan={triggerRescan} />
              <div className="flex items-center justify-between mb-4">
                 <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                   <Tractor size={18} className="text-gray-400" /> Tasks
                 </h3>
                 <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{sortedTasks.length || 0} Pending</span>
              </div>
              <div className="space-y-3">
                 {sortedTasks.map(task => (
                   <div key={task.id} className="group flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-green-200 hover:bg-green-50 transition cursor-pointer" onClick={() => setSelectedTask(task)}>
                      <div className="mt-0.5 w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-green-500 flex items-center justify-center">
                         <div className="w-2.5 h-2.5 rounded-full bg-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-medium text-gray-800 group-hover:text-green-900">{task.title}</p>
                          <button 
                            onClick={(e) => toggleTaskPriority(task.id, e)}
                            className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition hover:opacity-80 ${
                              task.priority === 'high' ? 'bg-red-100 text-red-600' :
                              task.priority === 'medium' ? 'bg-orange-100 text-orange-600' :
                              'bg-green-100 text-green-600'
                            }`}
                          >
                            {task.priority}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{task.date}</p>
                      </div>
                   </div>
                 ))}
                 {!sortedTasks.length && <p className="text-sm text-gray-400">No tasks for today.</p>}
              </div>
           </div>
        </div>
      </div>
    </div>
  );

  const renderChatView = () => (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600">
               <MessageSquare size={18} />
            </div>
            <div>
               <h2 className="font-bold text-gray-900">AI Consultant</h2>
               <p className="text-xs text-gray-500">{currentSessionId ? 'Active Session' : 'New Conversation'}</p>
            </div>
         </div>
         <div className="flex items-center gap-2">
            <button onClick={handleNewChat} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition" title="New Chat">
               <Plus size={20} />
            </button>
            <button onClick={() => setIsHistoryOpen(true)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition" title="History">
               <History size={20} />
            </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
         {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
               <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 shadow-sm text-sm leading-relaxed ${
                  msg.role === 'user' 
                  ? 'bg-green-600 text-white rounded-br-sm' 
                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
               }`}>
                  {msg.image && (
                    <img src={`data:image/jpeg;base64,${msg.image}`} alt="Upload" className="mb-3 rounded-lg max-h-60 border border-white/10" />
                  )}
                  {msg.video && (
                    <div className="mb-3 rounded-lg overflow-hidden border border-white/10 max-w-xs bg-black">
                      <video src={`data:${msg.videoMimeType || 'video/mp4'};base64,${msg.video}`} controls className="w-full max-h-60" />
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  
                  {msg.sources && msg.sources.length > 0 && (
                     <div className="mt-3 pt-3 border-t border-gray-100/20">
                        <div className="flex flex-wrap gap-2">
                           {msg.sources.map((s, i) => (
                              <a key={i} href={s.uri} target="_blank" rel="noreferrer" className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full ${msg.role === 'user' ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                 <ExternalLink size={10} /> <span className="truncate max-w-[100px]">{s.title}</span>
                              </a>
                           ))}
                        </div>
                     </div>
                  )}
               </div>
            </div>
         ))}
         {isChatLoading && (
            <div className="flex justify-start">
               <div className="bg-white px-5 py-4 rounded-2xl rounded-bl-sm border border-gray-200 shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce delay-200" />
               </div>
            </div>
         )}
         <div ref={chatEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-100">
         {pendingImage && (
            <div className="mb-3 flex items-center gap-2 bg-gray-50 w-fit px-3 py-1.5 rounded-full border border-gray-200">
               <ImageIcon size={14} className="text-gray-500" />
               <span className="text-xs text-gray-600">Image attached</span>
               <button onClick={() => setPendingImage(null)} className="ml-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>
         )}
         {pendingVideo && (
            <div className="mb-3 flex items-center gap-2 bg-gray-50 w-fit px-3 py-1.5 rounded-full border border-gray-200">
               <VideoIcon size={14} className="text-gray-500" />
               <span className="text-xs text-gray-600">Video attached</span>
               <button onClick={() => setPendingVideo(null)} className="ml-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>
         )}
         
         <div className="flex items-center gap-3">
            <button 
               onClick={() => fileInputRef.current?.click()}
               className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition"
               title="Upload Image"
            >
               <Camera size={20} />
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

            <button 
               onClick={() => videoInputRef.current?.click()}
               className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition"
               title="Upload Video"
            >
               <VideoIcon size={20} />
            </button>
            <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={handleVideoUpload} />
            
            <div className="flex-1 bg-gray-100 rounded-xl flex items-center px-4 border border-transparent focus-within:border-green-500 focus-within:bg-white transition-colors relative">
               <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={isRecording ? "Listening..." : "Ask a question..."}
                  className="flex-1 bg-transparent py-3 text-sm focus:outline-none"
                  disabled={isRecording}
               />
               
               {/* Mic Button inside Input */}
               <button 
                 onClick={toggleRecording}
                 className={`p-2 rounded-lg transition-all ${isRecording ? 'text-red-500 animate-pulse bg-red-50' : 'text-gray-400 hover:text-gray-600'}`}
                 title={isRecording ? "Stop Recording" : "Voice Input"}
               >
                 {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
               </button>

               <button onClick={() => setUseDeepThinking(!useDeepThinking)} className={`ml-2 p-1.5 rounded-lg transition ${useDeepThinking ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`} title="Deep Thinking (Gemini Pro)">
                  <BrainCircuit size={16} />
               </button>
            </div>

            <button 
               onClick={() => handleSendMessage()}
               disabled={(!chatInput.trim() && !pendingImage && !pendingVideo) || isRecording}
               className="p-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
               <ChevronRight size={20} />
            </button>
         </div>
      </div>
    </div>
  );
  
  if (!user) {
    return renderLoginView();
  }

  // Show onboarding if needed
  if (isOnboarding) {
    return renderOnboardingView();
  }

  if (user && (!weather || !dashboardData)) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center animate-pulse">
           <div className="w-20 h-20 bg-green-600 rounded-3xl flex items-center justify-center shadow-xl mb-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white/20"></div>
              <Leaf className="text-white animate-bounce" size={40} />
           </div>
           <h2 className="text-xl font-bold text-gray-900 tracking-tight">Initializing Farm Sensors</h2>
           <p className="text-gray-500 mt-3 text-sm font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100 flex items-center gap-2">
             <Loader2 size={14} className="animate-spin text-green-600" />
             {weather ? "Analyzing yield & market data..." : "Connecting to satellite weather streams..."}
           </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
      {renderSidebar()}
      
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-30 flex items-center justify-between px-4">
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
               <Leaf className="text-white" size={18} />
            </div>
            <span className="font-bold text-lg tracking-tight">AgriVision</span>
         </div>
         <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-600">
            <Menu size={24} />
         </button>
      </div>

      <main className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isMobileMenuOpen ? 'opacity-50 pointer-events-none' : ''} pt-16 md:pt-0 md:ml-64`}>
         <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-7xl mx-auto h-full">
               {view === ViewState.DASHBOARD && renderDashboardView()}
               {view === ViewState.SUPPLY_CHAIN && renderSupplyChainView()}
               {view === ViewState.CALENDAR && renderCalendarView()}
               {view === ViewState.ANALYTICS && renderAnalyticsView()}
               {view === ViewState.CHAT && renderChatView()}
            </div>
         </div>
      </main>

      {view === ViewState.LIVE_SCANNER && (
        <LiveAgronomist onClose={() => setView(ViewState.DASHBOARD)} onSaveScan={handleSaveScan} />
      )}

      {/* Scan History Modal */}
      {activeModal === 'scanHistory' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                 <h3 className="font-bold text-lg flex items-center gap-2"><History size={20} className="text-gray-600" /> Scan History</h3>
                 <div className="flex items-center gap-2">
                    {scanHistory.length > 0 && (
                      <button 
                        onClick={() => {
                          setScanHistory([]);
                          localStorage.removeItem('agrivision_scan_history');
                        }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                      >
                        Clear All
                      </button>
                    )}
                    <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                 {scanHistory.length > 0 ? (
                    scanHistory.map((scan) => (
                       <div key={scan.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-green-300 transition-colors shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                             <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg ${
                                   scan.mode === 'Soil' ? 'bg-amber-100 text-amber-700' :
                                   scan.mode === 'Pest' ? 'bg-red-100 text-red-700' :
                                   scan.mode === 'Plant' ? 'bg-pink-100 text-pink-700' :
                                   'bg-blue-100 text-blue-700'
                                }`}>
                                   {scan.mode === 'Soil' ? <FlaskConical size={14} /> :
                                    scan.mode === 'Pest' ? <Bug size={14} /> :
                                    scan.mode === 'Plant' ? <Flower2 size={14} /> :
                                    <Eye size={14} />}
                                </div>
                                <div>
                                   <p className="font-bold text-sm text-gray-800">{scan.mode} Analysis</p>
                                   <div className="flex items-center gap-3 text-[10px] text-gray-400">
                                      <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(scan.timestamp).toLocaleDateString()}</span>
                                      <span className="flex items-center gap-1"><Clock size={10} /> {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                   </div>
                                </div>
                             </div>
                             <button 
                               onClick={() => {
                                  // Delete item
                                  const updated = scanHistory.filter(s => s.id !== scan.id);
                                  setScanHistory(updated);
                                  localStorage.setItem('agrivision_scan_history', JSON.stringify(updated));
                               }}
                               className="text-gray-300 hover:text-red-400 transition"
                             >
                                <Trash2 size={14} />
                             </button>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600 line-clamp-3 leading-relaxed">
                             {scan.analysis}
                          </div>
                       </div>
                    ))
                 ) : (
                    <div className="text-center py-12 text-gray-400">
                       <Scan size={48} className="mx-auto mb-3 opacity-20" />
                       <p>No scan history found.</p>
                       <p className="text-xs mt-1">Use the Field Scanner to save new analyses.</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Add Partner Modal */}
      {activeModal === 'addPartner' && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
               <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <h3 className="font-bold text-lg flex items-center gap-2"><Truck size={20} className="text-green-600" /> Add Partner</h3>
                  <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
               </div>
               <form onSubmit={handleAddPartnerSubmit} className="p-6 space-y-4">
                  <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                     <input 
                       type="text"
                       required
                       value={partnerForm.name}
                       onChange={(e) => setPartnerForm({...partnerForm, name: e.target.value})}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                       placeholder="e.g. Fresh Foods Co-op"
                     />
                  </div>
                  <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                     <select
                       required
                       value={partnerForm.type}
                       onChange={(e) => setPartnerForm({...partnerForm, type: e.target.value})}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                     >
                        <option value="">Select Type</option>
                        <option value="Wholesaler">Wholesaler</option>
                        <option value="Cooperative">Cooperative</option>
                        <option value="Retailer">Retailer</option>
                        <option value="Processor">Processor</option>
                     </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price Offer</label>
                        <input 
                          type="text"
                          value={partnerForm.priceOffer}
                          onChange={(e) => setPartnerForm({...partnerForm, priceOffer: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="e.g. $450/ton"
                        />
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Distance</label>
                        <input 
                          type="text"
                          value={partnerForm.distance}
                          onChange={(e) => setPartnerForm({...partnerForm, distance: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="e.g. 15km"
                        />
                     </div>
                  </div>
                  <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Contact Info</label>
                     <input 
                       type="text"
                       required
                       value={partnerForm.contact}
                       onChange={(e) => setPartnerForm({...partnerForm, contact: e.target.value})}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                       placeholder="Phone or Email"
                     />
                  </div>

                  <div className="pt-4 flex gap-3">
                     <button 
                       type="button" 
                       onClick={() => setActiveModal(null)}
                       className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition"
                     >
                        Cancel
                     </button>
                     <button 
                       type="submit"
                       className="flex-1 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2"
                     >
                        <Save size={18} /> Save Partner
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* Soil Health History Modal (Passport) */}
      {activeModal === 'soilHistory' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-amber-50">
               <div className="flex items-center gap-3">
                 <div className="bg-amber-200 p-2 rounded-lg text-amber-800"><FileText size={24} /></div>
                 <div>
                   <h3 className="font-bold text-xl text-amber-900">Soil Health Passport</h3>
                   <div className="flex items-center gap-2">
                      <p className="text-xs text-amber-700">Historical Tracking & Improvements</p>
                      {user?.calibrationData ? (
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded border border-green-200 font-bold flex items-center gap-1">
                           <CheckCircle2 size={10} /> Verified by Scan
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded border border-gray-200 font-medium">
                           Regional Average
                        </span>
                      )}
                   </div>
                 </div>
               </div>
               <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
               {dashboardData?.soilHealth ? (
                 <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="bg-gray-50 p-4 rounded-xl">
                          <h4 className="font-bold text-gray-700 mb-2">Nutrient Profile (NPK)</h4>
                          <div className="space-y-2">
                             {['n', 'p', 'k'].map((n) => (
                               <div key={n} className="flex items-center gap-2">
                                 <span className="w-4 font-bold uppercase text-xs">{n}</span>
                                 <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                   <div className={`h-full rounded-full ${
                                     (dashboardData.soilHealth.npk as any)[n] === 'optimal' ? 'bg-green-500 w-2/3' : 
                                     (dashboardData.soilHealth.npk as any)[n] === 'high' ? 'bg-yellow-500 w-full' : 'bg-red-500 w-1/3'
                                   }`} />
                                 </div>
                                 <span className="text-xs font-medium uppercase text-gray-500">{(dashboardData.soilHealth.npk as any)[n]}</span>
                               </div>
                             ))}
                          </div>
                       </div>
                       
                       <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-sm">
                          <div className="flex justify-between border-b border-gray-200 pb-1"><span>pH Level</span><span className="font-bold">{dashboardData.soilHealth.ph}</span></div>
                          <div className="flex justify-between border-b border-gray-200 pb-1"><span>Salinity</span><span className="font-bold">{dashboardData.soilHealth.salinity}</span></div>
                          <div className="flex justify-between border-b border-gray-200 pb-1"><span>Organic Matter</span><span className="font-bold">{dashboardData.soilHealth.organicMatter}</span></div>
                          <div className="flex justify-between"><span>Erosion Risk</span><span className={`font-bold uppercase ${dashboardData.soilHealth.erosionRisk === 'high' ? 'text-red-600' : 'text-green-600'}`}>{dashboardData.soilHealth.erosionRisk}</span></div>
                       </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Sprout size={16} /> Recommendations</h4>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {dashboardData.soilHealth.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2 bg-green-50 p-2 rounded-lg text-sm text-green-800">
                             <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                             {rec}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-bold text-gray-800 mb-2">Crop Rotation History</h4>
                      <div className="flex items-center gap-2 overflow-x-auto pb-2">
                         {[2022, 2023, 2024].map((year) => (
                            <div key={year} className="min-w-[120px] bg-white border border-gray-200 p-3 rounded-lg text-center">
                               <p className="text-xs text-gray-400 mb-1">{year}</p>
                               <p className="font-medium text-sm">Legumes</p>
                               <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Nitrogen Fix</span>
                            </div>
                         ))}
                         <div className="min-w-[120px] bg-blue-50 border border-blue-200 p-3 rounded-lg text-center">
                            <p className="text-xs text-blue-500 mb-1">Next Season</p>
                            <p className="font-bold text-sm text-blue-700">{user?.primaryCrops.split(',')[0]}</p>
                         </div>
                      </div>
                    </div>
                 </div>
               ) : <p>Loading Passport Data...</p>}
            </div>
          </div>
        </div>
      )}
      
      {/* Profile Edit Modal */}
      {activeModal === 'profile' && profileForm && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
               <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <h3 className="font-bold text-lg flex items-center gap-2"><Settings size={20} className="text-gray-600" /> Edit Profile</h3>
                  <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
               </div>
               <form onSubmit={handleProfileSave} className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
                  <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                     <input 
                       type="text"
                       required
                       value={profileForm.name}
                       onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                     />
                  </div>
                  <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Farm Name</label>
                     <input 
                       type="text"
                       required
                       value={profileForm.farmName}
                       onChange={(e) => setProfileForm({...profileForm, farmName: e.target.value})}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                     />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Farm Size</label>
                        <input 
                          type="text"
                          required
                          value={profileForm.farmSize}
                          onChange={(e) => setProfileForm({...profileForm, farmSize: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <input 
                          type="text"
                          value={profileForm.location}
                          onChange={(e) => setProfileForm({...profileForm, location: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                     </div>
                  </div>
                  <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Primary Crops</label>
                     <input 
                       type="text"
                       required
                       value={profileForm.primaryCrops}
                       onChange={(e) => setProfileForm({...profileForm, primaryCrops: e.target.value})}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                     />
                  </div>
                  
                  <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                     <div className="grid grid-cols-2 gap-2">
                        {LANGUAGES.map(lang => (
                          <button
                            key={lang.code}
                            type="button"
                            onClick={() => setProfileForm({ ...profileForm, language: lang.code })}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border flex items-center justify-center gap-2 ${
                              profileForm.language === lang.code
                                ? 'bg-green-100 border-green-300 text-green-800 ring-1 ring-green-300'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {lang.flag} {lang.label}
                          </button>
                        ))}
                     </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                     <button 
                       type="button" 
                       onClick={() => setActiveModal(null)}
                       className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition"
                     >
                        Cancel
                     </button>
                     <button 
                       type="submit"
                       className="flex-1 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition"
                     >
                        Save Changes
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}
      
      {activeModal === 'about' && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative">
               <div className="bg-gradient-to-br from-green-600 to-green-800 p-8 text-white text-center">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4">
                     <Leaf size={32} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold">AgriVision AI</h2>
                  <p className="text-green-100 opacity-80 text-sm">Empowering Farmers</p>
                  
                  <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition">
                     <X size={20} />
                  </button>
               </div>
               
               <div className="p-8 text-center space-y-4">
                  <p className="text-gray-600 text-sm font-medium uppercase tracking-wider">Credits</p>
                  
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                     <p className="text-gray-800 font-medium leading-relaxed">
                       This project was done by <br/>
                       <span className="text-green-700 font-bold text-lg">Saivarshan and Akhil</span>
                     </p>
                     <p className="text-gray-500 text-sm mt-2">
                       from <span className="font-semibold text-gray-700">San Academy, Velachery</span><br/>
                       Class 8b
                     </p>
                  </div>
                  
                  <div className="pt-2 text-xs text-gray-400">
                    Version 1.0.0 • AgriVision Systems
                  </div>
               </div>
            </div>
         </div>
      )}

      {selectedTask && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6">
               <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                     <Tractor size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedTask.title}</h3>
                  <p className="text-gray-500 text-sm mt-1">{selectedTask.date}</p>
               </div>
               <div className="space-y-3">
                  <button onClick={() => { 
                     setSelectedTask(null);
                  }} className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2">
                     <CheckCircle2 size={18} /> Mark Complete
                  </button>
                  <button onClick={() => {
                     setSelectedTask(null);
                     setView(ViewState.CHAT);
                     setTimeout(() => handleSendMessage(`How do I perform: ${selectedTask.title}?`), 500);
                  }} className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition">
                     Ask Consultant
                  </button>
               </div>
               <button onClick={() => setSelectedTask(null)} className="mt-4 text-sm text-gray-400 w-full text-center hover:text-gray-600">Dismiss</button>
            </div>
         </div>
      )}

      {isHistoryOpen && (
         <div className="fixed inset-0 z-50 flex">
            <div className="w-80 bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
               <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <h3 className="font-bold text-gray-800">History</h3>
                  <button onClick={() => setIsHistoryOpen(false)}><X size={20} className="text-gray-500" /></button>
               </div>
               <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {sessions.map(s => (
                     <div key={s.id} onClick={() => loadSession(s)} className="p-3 rounded-lg hover:bg-gray-100 cursor-pointer group relative">
                        <h4 className="font-medium text-sm text-gray-900 truncate pr-6">{s.title}</h4>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{s.preview}</p>
                        <button onClick={(e) => deleteSession(e, s.id)} className="absolute right-2 top-3 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
                     </div>
                  ))}
               </div>
               <div className="p-4 border-t border-gray-100">
                  <button onClick={handleExportChat} className="flex items-center justify-center gap-2 w-full py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                     <Download size={16} /> Export
                  </button>
               </div>
            </div>
            <div className="flex-1 bg-black/20 backdrop-blur-sm" onClick={() => setIsHistoryOpen(false)} />
         </div>
      )}
    </div>
  );
};

export default App;
