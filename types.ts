
export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  LIVE_SCANNER = 'LIVE_SCANNER',
  WEATHER = 'WEATHER',
  CHAT = 'CHAT',
  ONBOARDING = 'ONBOARDING',
  CALENDAR = 'CALENDAR',
  SUPPLY_CHAIN = 'SUPPLY_CHAIN',
  ANALYTICS = 'ANALYTICS',
}

export interface UserProfile {
  name: string;
  farmName: string;
  role: string;
  farmSize: string;    
  primaryCrops: string;
  location: string;
  calibrationData?: string; // Analysis from the onboarding scan
  hasOnboarded?: boolean;
  language?: string;
}

export interface ScanResult {
  id: string;
  timestamp: number;
  mode: string;
  analysis: string;
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface WeatherData {
  location: string;
  temperature: string;
  condition: string;
  humidity: string;
  farmingAdvice: string;
  forecast: string;
  sources?: GroundingSource[];
}

export interface MarketItem {
  crop: string;
  price: string;
  trend: 'up' | 'down' | 'stable';
  change: string;
}

export interface FarmTask {
  id: string;
  title: string;
  date: string;
  type: 'sow' | 'fertilize' | 'harvest' | 'spray' | 'water';
  priority: 'high' | 'medium' | 'low';
}

export interface SupplyChainPartner {
  name: string;
  type: string; // e.g., "Wholesaler", "Cooperative", "Market"
  priceOffer: string;
  distance: string;
  contact: string;
}

// --- New Idethon Features Interfaces ---

export interface SoilHealth {
  npk: { n: 'low' | 'optimal' | 'high'; p: 'low' | 'optimal' | 'high'; k: 'low' | 'optimal' | 'high' };
  ph: string;
  moisture: string;
  salinity: string; // e.g. "Low (0.5 dS/m)"
  organicMatter: string; // e.g. "2.5% (Medium)"
  erosionRisk: 'low' | 'medium' | 'high';
  recommendations: string[]; // Organic fertilizers, crop rotation
}

export interface ClimateRisk {
  riskScore: number; // 1-10 scale
  warnings: string[]; // Heatwaves, heavy rain
  resilientCrops: string[];
  sowingWindow: string; // "Best time to sow: Nov 15-20"
}

export interface EnergyData {
  solarPumpHours: string; // "6.5 hours today (09:00 - 15:30)"
  biogasPotential: string; // "High - 3 cattle sufficient"
  recommendation: string;
}

export interface MarketDestination {
  name: string;
  distance: string;
  price: string;
  contact: string;
  type: string;
}

export interface MarketIntel {
  bestTimeToSell: string;
  pricePrediction: string; // "Rising next week"
  chemicalFreeMarkets: string[]; // Names of organic markets
  destinations: MarketDestination[]; // Specific places to sell with contact info
}

export interface UserStats {
  totalHarvest: string;
  revenue: string;
  activeCrops: number;
  efficiency: number;
  history: {
    labels: string[];
    revenue: number[];
    expenses: number[];
  };
}

export interface DashboardData {
  irrigation: {
    status: 'water' | 'delay' | 'monitor' | 'overwatering_alert';
    message: string;
    moisture: string;
  };
  pestForecast: {
    risk: 'low' | 'medium' | 'high';
    alert: string;
    ipmSuggestions: string[]; // Integrated Pest Management
  };
  yieldPrediction: {
    crop: string;
    amount: string;
    confidence: string;
    advice?: string;
  };
  marketPrices: MarketItem[];
  tasks: FarmTask[];
  supplyChain: SupplyChainPartner[];
  // New Sections
  soilHealth: SoilHealth;
  climateRisk: ClimateRisk;
  energy: EnergyData;
  marketIntel: MarketIntel;
  analytics?: UserStats;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // Base64 encoded image string
  video?: string; // Base64 encoded video string
  videoMimeType?: string; // e.g., 'video/mp4'
  timestamp: Date;
  sources?: GroundingSource[];
}

export interface ChatSession {
  id: string;
  title: string;
  lastModified: number;
  preview: string;
  messages: ChatMessage[];
}
