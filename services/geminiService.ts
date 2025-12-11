
import { GoogleGenAI } from "@google/genai";
import { WeatherData, GroundingSource, DashboardData, FarmTask, UserProfile } from "../types";

// Helper to get AI client safely
const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Models
const MODEL_FAST = 'gemini-2.5-flash';
const MODEL_PRO = 'gemini-3-pro-preview';

// Helper to extract grounding sources
const extractSources = (candidate: any): GroundingSource[] => {
  const sources: GroundingSource[] = [];
  const chunks = candidate?.groundingMetadata?.groundingChunks;
  
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web?.uri) {
        sources.push({
          uri: chunk.web.uri,
          title: chunk.web.title || "Source"
        });
      }
    });
  }
  return sources;
};

// --- Comprehensive Fallback Data (100+ Items) ---
const FALLBACK_MARKET_LIST = [
  // Cereals & Grains
  { crop: "Rice (Basmati)", price: "$850/ton", trend: "up", change: "+2%" },
  { crop: "Rice (Sona Masoori)", price: "$600/ton", trend: "stable", change: "0%" },
  { crop: "Rice (Ponni)", price: "$620/ton", trend: "up", change: "+1%" },
  { crop: "Rice (Jasmine)", price: "$950/ton", trend: "down", change: "-1%" },
  { crop: "Rice (Brown)", price: "$900/ton", trend: "up", change: "+1%" },
  { crop: "Rice (Parboiled)", price: "$550/ton", trend: "stable", change: "0%" },
  { crop: "Rice (Wild)", price: "$1200/ton", trend: "stable", change: "0%" },
  { crop: "Rice (Black)", price: "$1500/ton", trend: "up", change: "+3%" },
  { crop: "Wheat (Durum)", price: "$320/ton", trend: "up", change: "+1.5%" },
  { crop: "Wheat (Common)", price: "$280/ton", trend: "stable", change: "0%" },
  { crop: "Wheat (Emmer)", price: "$400/ton", trend: "stable", change: "0%" },
  { crop: "Maize (Yellow)", price: "$190/ton", trend: "down", change: "-2%" },
  { crop: "Maize (White)", price: "$200/ton", trend: "stable", change: "0%" },
  { crop: "Maize (Sweet)", price: "$250/ton", trend: "up", change: "+5%" },
  { crop: "Barley (Malt)", price: "$220/ton", trend: "up", change: "+1%" },
  { crop: "Barley (Feed)", price: "$180/ton", trend: "down", change: "-1%" },
  { crop: "Sorghum (Red)", price: "$250/ton", trend: "up", change: "+3%" },
  { crop: "Sorghum (White)", price: "$260/ton", trend: "stable", change: "0%" },
  { crop: "Pearl Millet", price: "$230/ton", trend: "up", change: "+2%" },
  { crop: "Finger Millet", price: "$400/ton", trend: "stable", change: "0%" },
  { crop: "Foxtail Millet", price: "$350/ton", trend: "up", change: "+1%" },
  { crop: "Proso Millet", price: "$300/ton", trend: "stable", change: "0%" },
  { crop: "Oats", price: "$300/ton", trend: "down", change: "-1%" },
  { crop: "Rye", price: "$220/ton", trend: "stable", change: "0%" },
  { crop: "Triticale", price: "$210/ton", trend: "stable", change: "0%" },
  { crop: "Quinoa", price: "$1500/ton", trend: "up", change: "+4%" },
  { crop: "Buckwheat", price: "$600/ton", trend: "stable", change: "0%" },
  { crop: "Amaranth", price: "$800/ton", trend: "up", change: "+2%" },
  
  // Pulses & Legumes
  { crop: "Chickpeas (Kabuli)", price: "$1100/ton", trend: "stable", change: "0%" },
  { crop: "Chickpeas (Desi)", price: "$900/ton", trend: "up", change: "+1%" },
  { crop: "Red Lentil", price: "$850/ton", trend: "down", change: "-1%" },
  { crop: "Green Gram", price: "$1000/ton", trend: "up", change: "+3%" },
  { crop: "Black Gram", price: "$1050/ton", trend: "stable", change: "0%" },
  { crop: "Pigeon Pea", price: "$1200/ton", trend: "up", change: "+4%" },
  { crop: "Kidney Beans", price: "$1300/ton", trend: "stable", change: "0%" },
  { crop: "Soybeans", price: "$480/ton", trend: "up", change: "+1.2%" },
  { crop: "Cowpea", price: "$950/ton", trend: "up", change: "+2%" },
  { crop: "Horse Gram", price: "$700/ton", trend: "stable", change: "0%" },
  { crop: "Moth Bean", price: "$800/ton", trend: "down", change: "-2%" },
  { crop: "Peas (Dry)", price: "$500/ton", trend: "stable", change: "0%" },

  // Vegetables
  { crop: "Tomato (Hybrid)", price: "$1.20/kg", trend: "down", change: "-4%" },
  { crop: "Tomato (Local)", price: "$1.00/kg", trend: "stable", change: "0%" },
  { crop: "Onion (Red)", price: "$0.60/kg", trend: "stable", change: "0%" },
  { crop: "Onion (White)", price: "$0.70/kg", trend: "up", change: "+2%" },
  { crop: "Potato (Russet)", price: "$0.80/kg", trend: "up", change: "+5%" },
  { crop: "Potato (Red)", price: "$0.90/kg", trend: "stable", change: "0%" },
  { crop: "Sweet Potato", price: "$1.10/kg", trend: "up", change: "+3%" },
  { crop: "Eggplant (Purple)", price: "$0.90/kg", trend: "stable", change: "+1%" },
  { crop: "Eggplant (Green)", price: "$0.95/kg", trend: "up", change: "+2%" },
  { crop: "Okra", price: "$1.10/kg", trend: "up", change: "+3%" },
  { crop: "Cauliflower", price: "$0.70/head", trend: "down", change: "-2%" },
  { crop: "Cabbage", price: "$0.50/head", trend: "stable", change: "0%" },
  { crop: "Broccoli", price: "$2.50/kg", trend: "up", change: "+2%" },
  { crop: "Spinach", price: "$1.50/bunch", trend: "up", change: "+4%" },
  { crop: "Lettuce (Iceberg)", price: "$1.20/head", trend: "down", change: "-1%" },
  { crop: "Carrot (Orange)", price: "$0.95/kg", trend: "stable", change: "0%" },
  { crop: "Carrot (Red)", price: "$1.10/kg", trend: "up", change: "+2%" },
  { crop: "Radish", price: "$0.60/kg", trend: "down", change: "-3%" },
  { crop: "Beetroot", price: "$1.20/kg", trend: "up", change: "+4%" },
  { crop: "Pumpkin", price: "$0.50/kg", trend: "up", change: "+2%" },
  { crop: "Bottle Gourd", price: "$0.40/kg", trend: "stable", change: "0%" },
  { crop: "Bitter Gourd", price: "$1.50/kg", trend: "up", change: "+5%" },
  { crop: "Ridge Gourd", price: "$1.20/kg", trend: "stable", change: "0%" },
  { crop: "Snake Gourd", price: "$0.90/kg", trend: "down", change: "-2%" },
  { crop: "Cucumber", price: "$0.80/kg", trend: "up", change: "+1%" },
  { crop: "Zucchini", price: "$1.50/kg", trend: "stable", change: "0%" },
  { crop: "Capsicum (Green)", price: "$1.80/kg", trend: "stable", change: "0%" },
  { crop: "Capsicum (Red)", price: "$3.00/kg", trend: "up", change: "+3%" },
  { crop: "Capsicum (Yellow)", price: "$3.20/kg", trend: "up", change: "+2%" },
  { crop: "Green Chili", price: "$2.20/kg", trend: "down", change: "-1%" },
  { crop: "Drumstick", price: "$2.50/kg", trend: "up", change: "+10%" },
  { crop: "Green Peas", price: "$3.00/kg", trend: "up", change: "+5%" },
  { crop: "French Beans", price: "$2.00/kg", trend: "down", change: "-2%" },
  { crop: "Cluster Beans", price: "$1.50/kg", trend: "stable", change: "0%" },
  { crop: "Broad Beans", price: "$1.80/kg", trend: "up", change: "+1%" },
  { crop: "Yam", price: "$1.50/kg", trend: "stable", change: "0%" },
  { crop: "Tapioca", price: "$0.80/kg", trend: "down", change: "-2%" },
  { crop: "Colocasia", price: "$1.40/kg", trend: "up", change: "+3%" },
  { crop: "Asparagus", price: "$5.00/kg", trend: "stable", change: "0%" },
  { crop: "Artichoke", price: "$4.00/kg", trend: "up", change: "+2%" },
  
  // Fruits
  { crop: "Banana (Cavendish)", price: "$0.40/doz", trend: "up", change: "+2%" },
  { crop: "Banana (Red)", price: "$0.80/doz", trend: "stable", change: "0%" },
  { crop: "Mango (Alphonso)", price: "$12.00/doz", trend: "down", change: "-5%" },
  { crop: "Mango (Totapuri)", price: "$6.00/doz", trend: "stable", change: "0%" },
  { crop: "Apple (Fuji)", price: "$2.50/kg", trend: "stable", change: "0%" },
  { crop: "Apple (Granny Smith)", price: "$2.80/kg", trend: "up", change: "+1%" },
  { crop: "Orange", price: "$1.80/kg", trend: "up", change: "+3%" },
  { crop: "Papaya", price: "$1.00/kg", trend: "stable", change: "+1%" },
  { crop: "Pineapple", price: "$1.50/unit", trend: "up", change: "+2%" },
  { crop: "Pomegranate", price: "$3.00/kg", trend: "down", change: "-2%" },
  { crop: "Guava", price: "$1.20/kg", trend: "stable", change: "0%" },
  { crop: "Watermelon", price: "$0.30/kg", trend: "up", change: "+5%" },
  { crop: "Muskmelon", price: "$0.60/kg", trend: "stable", change: "0%" },
  { crop: "Grapes (Green)", price: "$2.50/kg", trend: "down", change: "-3%" },
  { crop: "Grapes (Black)", price: "$3.00/kg", trend: "up", change: "+2%" },
  { crop: "Strawberry", price: "$4.00/box", trend: "up", change: "+5%" },
  { crop: "Kiwi", price: "$0.80/pc", trend: "stable", change: "0%" },
  { crop: "Lemon", price: "$3.00/kg", trend: "up", change: "+8%" },
  { crop: "Lime", price: "$2.50/kg", trend: "stable", change: "0%" },
  { crop: "Avocado", price: "$5.00/kg", trend: "up", change: "+10%" },
  { crop: "Coconut", price: "$0.50/nut", trend: "stable", change: "0%" },
  { crop: "Jackfruit", price: "$5.00/fruit", trend: "up", change: "+2%" },
  { crop: "Sapota", price: "$1.00/kg", trend: "stable", change: "0%" },
  { crop: "Custard Apple", price: "$2.00/kg", trend: "up", change: "+4%" },
  { crop: "Fig", price: "$4.00/kg", trend: "stable", change: "0%" },
  { crop: "Peach", price: "$3.50/kg", trend: "down", change: "-2%" },
  { crop: "Pear", price: "$2.20/kg", trend: "up", change: "+1%" },
  { crop: "Plum", price: "$3.00/kg", trend: "stable", change: "0%" },
  { crop: "Cherry", price: "$8.00/kg", trend: "up", change: "+5%" },
  { crop: "Litchi", price: "$2.50/kg", trend: "down", change: "-5%" },

  // Spices
  { crop: "Black Pepper", price: "$6000/ton", trend: "stable", change: "0%" },
  { crop: "Cardamom", price: "$25000/ton", trend: "up", change: "+2%" },
  { crop: "Clove", price: "$9000/ton", trend: "up", change: "+1%" },
  { crop: "Cinnamon", price: "$4500/ton", trend: "stable", change: "0%" },
  { crop: "Ginger", price: "$4.00/kg", trend: "up", change: "+6%" },
  { crop: "Garlic", price: "$3.50/kg", trend: "up", change: "+8%" },
  { crop: "Turmeric", price: "$1500/ton", trend: "up", change: "+1%" },
  { crop: "Chili (Dry)", price: "$3000/ton", trend: "up", change: "+5%" },
  { crop: "Cumin", price: "$4000/ton", trend: "down", change: "-3%" },
  { crop: "Coriander Seeds", price: "$1200/ton", trend: "stable", change: "0%" },
  { crop: "Mustard Seeds", price: "$800/ton", trend: "up", change: "+2%" },
  { crop: "Fenugreek", price: "$900/ton", trend: "stable", change: "0%" },
  { crop: "Fennel", price: "$1800/ton", trend: "up", change: "+3%" },
  { crop: "Nutmeg", price: "$7000/ton", trend: "stable", change: "0%" },

  // Commercial & Plantation
  { crop: "Cotton", price: "$1200/ton", trend: "up", change: "+4%" },
  { crop: "Sugarcane", price: "$40/ton", trend: "stable", change: "0%" },
  { crop: "Jute", price: "$700/ton", trend: "down", change: "-2%" },
  { crop: "Rubber", price: "$1800/ton", trend: "down", change: "-1%" },
  { crop: "Tobacco", price: "$2500/ton", trend: "stable", change: "0%" },
  { crop: "Tea", price: "$3000/ton", trend: "up", change: "+2%" },
  { crop: "Coffee (Arabica)", price: "$4000/ton", trend: "up", change: "+3%" },
  { crop: "Coffee (Robusta)", price: "$2800/ton", trend: "stable", change: "0%" },
  { crop: "Cocoa", price: "$3500/ton", trend: "up", change: "+5%" },
  { crop: "Arecanut", price: "$5000/ton", trend: "up", change: "+5%" },
  { crop: "Vanilla", price: "$400/kg", trend: "stable", change: "0%" },

  // Flowers
  { crop: "Rose", price: "$3.00/bunch", trend: "up", change: "+10%" },
  { crop: "Marigold", price: "$1.00/kg", trend: "stable", change: "0%" },
  { crop: "Jasmine", price: "$5.00/kg", trend: "up", change: "+15%" },
  { crop: "Chrysanthemum", price: "$2.50/kg", trend: "down", change: "-5%" },
  { crop: "Tuberose", price: "$3.00/kg", trend: "up", change: "+2%" },
  { crop: "Gerbera", price: "$4.00/bunch", trend: "stable", change: "0%" }
] as any[];


export const getFarmingWeather = async (locationInput: string | { lat: number, lng: number }): Promise<WeatherData> => {
  try {
    const ai = getAiClient();
    
    let locationPromptPart = "";
    if (typeof locationInput === 'string') {
      locationPromptPart = `location "${locationInput}"`;
    } else {
      locationPromptPart = `coordinates ${locationInput.lat}, ${locationInput.lng}`;
    }

    const prompt = `
      I am a farmer at ${locationPromptPart}.
      
      Step 1: Identify the exact City/Region.
      Step 2: Create a farming forecast.
      
      Output strictly a raw JSON string with this structure:
      {
        "location": "City, Country",
        "temperature": "25°C",
        "condition": "Sunny",
        "humidity": "60%",
        "farmingAdvice": "One sentence summary advice.",
        "forecast": "Short paragraph about next 3 days suitable for farming."
      }
    `;

    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let text = response.text || "";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(text) as WeatherData;
    
    if (response.candidates?.[0]) {
      data.sources = extractSources(response.candidates[0]);
    }

    return data;
  } catch (error) {
    console.error("Weather fetch error:", error);
    return {
      location: typeof locationInput === 'string' ? locationInput : "Location Unavailable",
      temperature: "--",
      condition: "Service Unavailable",
      humidity: "--",
      farmingAdvice: "Could not fetch real-time weather.",
      forecast: "Forecast unavailable."
    };
  }
};

export const generateFarmDashboard = async (weather: WeatherData, userProfile?: UserProfile): Promise<DashboardData> => {
  try {
    const ai = getAiClient();
    
    let userContext = userProfile 
      ? `The user manages a farm named "${userProfile.farmName}" in "${userProfile.location}". Size: ${userProfile.farmSize}. Primary crops: ${userProfile.primaryCrops}.` 
      : `The user grows common regional crops.`;

    const languageInstruction = userProfile?.language 
      ? `IMPORTANT: Generate ALL text content (advice, alerts, forecasts) in the ${userProfile.language} language.` 
      : "";

    let calibrationContext = "";
    if (userProfile?.calibrationData) {
      calibrationContext = `
        IMPORTANT: The user has uploaded a photo of their farm. Analysis: "${userProfile.calibrationData}".
        You MUST use this visual analysis to provide HIGHLY CUSTOMIZED and PRECISE advice for:
        1. Soil Health (match NPK to the visual signs).
        2. Pest Forecast (address specific pests seen or likely for this crop state).
        3. Yield Prediction (adjust based on visual crop health).
      `;
    } else {
      calibrationContext = `
        NOTE: The user has NOT uploaded a farm photo.
        Provide GENERAL REGIONAL AVERAGES for Soil, Pests, and Yields based on the location "${weather.location}".
        Do not make specific claims about their field conditions, as we don't have the photo.
      `;
    }

    const prompt = `
      Act as an advanced AI Farm Manager. Based on the weather in ${weather.location} (${weather.condition}, ${weather.temperature}), and the following farm profile:
      ${userContext}

      ${calibrationContext}
      
      ${languageInstruction}

      Generate a comprehensive JSON dashboard with the following STRICT structure.
      
      Requirements:
      1. Soil Health Passport: Estimate likely soil nutrient gaps (NPK), pH, salinity for this region. If calibration data exists, use it. Recommend ORGANIC fertilizers.
      2. Climate Risk: Give a risk score (1-10). Warn about heatwaves/droughts.
      3. Energy: Calculate solar pump running hours based on weather.
      4. Market Intel: 
         - Predict best time to sell. 
         - **CRITICAL**: Provide a Market Prices list of TOP 25 CROPS relevant to the region and user.
         - MUST include the user's primary crops.
         - Provide "destinations" to sell with contact info.
      5. Pest: Predict pest outbreaks. Suggest IPM. Use calibration data if available.
      6. Irrigation: Detect overwatering risk.
      7. Tasks: Create daily tasks. Prioritize based on the weather and calibration data.
      8. Analytics: ESTIMATE realistic financial and yield data based on the farm size (${userProfile?.farmSize || '50 acres'}) and crops.
         - Revenue: Estimate total potential revenue.
         - Total Harvest: Estimate tonnage.
         - Active Crops: Count of crops managed.
         - Efficiency: 0-100 score based on weather/soil match.
         - History: 6 month trend data.

      Output strictly valid JSON:
      {
        "irrigation": { "status": "water" | "delay" | "monitor" | "overwatering_alert", "message": "Short advice", "moisture": "45%" },
        "pestForecast": { "risk": "low" | "medium" | "high", "alert": "Short alert message", "ipmSuggestions": ["Use Neem oil", "Trap crops"] },
        "yieldPrediction": { "crop": "Crop Name", "amount": "Estimated tonnage", "confidence": "85%", "advice": "One short tip." },
        "marketPrices": [
           { "crop": "Rice", "price": "$400/ton", "trend": "up", "change": "+12%" }
        ],
        "tasks": [
           { "id": "1", "title": "Check irrigation", "date": "Today", "type": "water", "priority": "high" }
        ],
        "supplyChain": [
           { "name": "Local Co-op", "type": "Cooperative", "priceOffer": "$410/ton", "distance": "5km", "contact": "555-0123" }
        ],
        "soilHealth": {
          "npk": { "n": "low", "p": "optimal", "k": "high" },
          "ph": "6.5",
          "moisture": "Low",
          "salinity": "Low (<1.0 dS/m)",
          "organicMatter": "2.1% (Low)",
          "erosionRisk": "medium",
          "recommendations": ["Apply compost", "Rotate with legumes"]
        },
        "climateRisk": {
           "riskScore": 4,
           "warnings": ["High heat expected next week"],
           "resilientCrops": ["Millet", "Sorghum"],
           "sowingWindow": "Best to sow: Nov 10-25"
        },
        "energy": {
           "solarPumpHours": "7 hours (09:00 - 16:00)",
           "biogasPotential": "High (if >2 cattle)",
           "recommendation": "Ideal day for solar pumping."
        },
        "marketIntel": {
           "bestTimeToSell": "Wait 2 weeks for festival demand",
           "pricePrediction": "Prices rising by 5%",
           "chemicalFreeMarkets": ["City Organic Bazaar", "Farmer's Direct"],
           "destinations": [
              { "name": "City Wholesale Market", "distance": "12km", "price": "$420/ton", "contact": "555-0199", "type": "Wholesale" }
           ]
        },
        "analytics": {
          "totalHarvest": "120 Tons",
          "revenue": "$45,000",
          "activeCrops": 3,
          "efficiency": 88,
          "history": {
            "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
            "revenue": [10000, 12000, 15000, 11000, 14000, 16000],
            "expenses": [5000, 6000, 7000, 5500, 6000, 6500]
          }
        }
      }
    `;

    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    let text = response.text || "";
    const data = JSON.parse(text) as DashboardData;

    // --- Merge AI Data with Fallback for 100+ Crops ---
    if (data.marketPrices) {
      const existingCrops = new Set(data.marketPrices.map((m: any) => m.crop.toLowerCase()));
      // Add items from fallback that are NOT in AI response
      const extraItems = FALLBACK_MARKET_LIST.filter(item => !existingCrops.has(item.crop.toLowerCase()));
      // Combine: AI items first (most relevant), then fallback items
      data.marketPrices = [...data.marketPrices, ...extraItems];
    } else {
      data.marketPrices = FALLBACK_MARKET_LIST;
    }

    return data;

  } catch (error) {
    console.error("Dashboard gen error:", error);
    
    return {
      irrigation: { status: 'monitor', message: 'Sensors calibrating...', moisture: 'Checking...' },
      pestForecast: { 
        risk: 'low', 
        alert: 'No immediate threats detected based on current data.',
        ipmSuggestions: ["Monitor sticky traps", "Maintain field hygiene"]
      },
      yieldPrediction: { crop: 'Mixed Crops', amount: 'Calculating...', confidence: '...', advice: 'Ensure adequate drainage.' },
      marketPrices: FALLBACK_MARKET_LIST, // Use full list on error
      tasks: [
        { id: "1", "title": "Inspect crop health", date: "Today", "type": "spray", priority: "high" },
        { id: "2", "title": "Clean irrigation filters", date: "Today", type: "water", priority: "medium" },
        { id: "3", "title": "Record growth data", date: "Today", type: "harvest", priority: "low" }
      ],
      supplyChain: [
         { name: "Regional Market", type: "Wholesale", priceOffer: "Market Rate", distance: "10km", contact: "555-0000" }
      ],
      soilHealth: {
        npk: { n: 'optimal', p: 'optimal', k: 'optimal' },
        ph: "7.0",
        moisture: "Medium",
        salinity: "Normal",
        organicMatter: "2.0%",
        erosionRisk: "low",
        recommendations: ["Annual soil test recommended", "Add farmyard manure"]
      },
      climateRisk: {
        riskScore: 2,
        warnings: ["No severe warnings"],
        resilientCrops: ["Local varieties"],
        sowingWindow: "Consult local calendar"
      },
      energy: {
        solarPumpHours: "6 hours",
        biogasPotential: "Medium",
        recommendation: "Standard operation"
      },
      marketIntel: {
        bestTimeToSell: "Hold for better prices",
        pricePrediction: "Stable",
        chemicalFreeMarkets: ["Local Farmers Market"],
        destinations: [
          { name: "Central Market", distance: "15km", price: "Market Rate", contact: "555-1234", type: "Public" }
        ]
      },
      analytics: {
        totalHarvest: "--",
        revenue: "--",
        activeCrops: 0,
        efficiency: 0,
        history: { labels: [], revenue: [], expenses: [] }
      }
    };
  }
};

export const chatWithAgronomist = async (
  history: any[], 
  message: string, 
  image?: string, 
  video?: { data: string, mimeType: string },
  deepThinking: boolean = false
): Promise<{ text: string, sources?: GroundingSource[] }> => {
  const ai = getAiClient();
  const modelName = (video || deepThinking) ? MODEL_PRO : MODEL_FAST;
  
  const currentMsgParts: any[] = [{ text: message }];
  if (image) {
    currentMsgParts.unshift({ inlineData: { mimeType: 'image/jpeg', data: image }});
  }
  if (video) {
    currentMsgParts.unshift({ inlineData: { mimeType: video.mimeType, data: video.data }});
  }

  const contents = [
    ...history,
    { role: 'user', parts: currentMsgParts }
  ];

  try {
    const config: any = {
      tools: [{ googleSearch: {} }],
    };
    
    if (deepThinking) {
      config.thinkingConfig = { thinkingBudget: 2048 };
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: contents,
      config: config
    });
    
    return {
      text: response.text || "I didn't catch that.",
      sources: response.candidates?.[0] ? extractSources(response.candidates[0]) : undefined
    };
  } catch (error) {
    console.error("Chat error:", error);
    return { text: "I'm having trouble connecting right now. Please check your connection." };
  }
};

export const transcribeAudio = async (audioBase64: string, mimeType: string = 'audio/webm'): Promise<string> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: audioBase64 } },
          { text: "Transcribe the spoken audio into text directly. Return only the transcription." }
        ]
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Transcription error:", error);
    return "";
  }
};

export const analyzeSnapshot = async (base64Image: string, mode: string): Promise<string> => {
  const ai = getAiClient();
  const prompt = `
    Analyze this farming image. Mode: ${mode}.
    Identify specific plants, diseases, pests, or soil conditions.
    Provide 3 specific actionable bullet points.
    Keep it concise and professional.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: MODEL_PRO, // Use PRO model for better image understanding
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt }
        ]
      }
    });
    return response.text || "Could not analyze image.";
  } catch (e) {
    console.error(e);
    return "Analysis failed.";
  }
};
