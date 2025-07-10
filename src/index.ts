// ElizaOS Arbitrage Bot - Enhanced Version with 22+ Token Support
import dotenv from "dotenv";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { join } from "path";
import https from "https";
import { URL } from "url";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3000", 10);
const RAILWAY_ENVIRONMENT = process.env.RAILWAY_ENVIRONMENT;
const RAILWAY_SERVICE_NAME = process.env.RAILWAY_SERVICE_NAME;

console.log("🚀 ElizaOS Enhanced Arbitrage Bot Starting...");
console.log("🌍 Environment:", process.env.NODE_ENV || "development");
console.log("🚂 Railway:", RAILWAY_ENVIRONMENT || "local");
console.log("🎯 Enhanced Mode: 22+ Token Monitoring");

// Error handling
process.on('uncaughtException', (error) => console.error('❌ Uncaught Exception:', error));
process.on('unhandledRejection', (reason) => console.error('❌ Unhandled Rejection:', reason));

// Types
interface PriceData {
  exchange: string;
  pair: string;
  price: number;
  volume: number;
  timestamp: number;
}

interface ArbitrageOpportunity {
  token: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  priceDifference: number;
  potentialProfit: number;
  estimatedGasCost: number;
  netProfit: number;
  profitPercentage: number;
  confidence: 'low' | 'medium' | 'high';
  timestamp: number;
}

interface ValidationResult {
  isValid: boolean;
  reason: string;
  score: number;
  recommendation: 'ACCEPT' | 'CAUTION' | 'REJECT';
}

interface Memory {
  userId: string;
  roomId: string;
  content: { text: string; [key: string]: any };
  [key: string]: any;
}

interface Character {
  name: string;
  bio: string[];
  description?: string;
  personality?: string;
  knowledge?: string[];
  modelProvider?: string;
  [key: string]: any;
}

interface ServiceStatus {
  elizaos: 'available' | 'limited' | 'unavailable';
  ai: boolean;
  blockchain: boolean;
  priceFeeds: boolean;
  arbitrageMonitoring: boolean;
  deployment: 'railway' | 'local';
}

// Enhanced Config
const config = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
  MIN_PROFIT_THRESHOLD: parseFloat(process.env.MIN_PROFIT_THRESHOLD || "0.5"),
  MAX_GAS_PRICE: parseFloat(process.env.MAX_GAS_PRICE || "50"),
  TRADE_AMOUNT: parseFloat(process.env.TRADE_AMOUNT || "1000"),
  // Enhanced Filter Settings
  EMERGENCY_FILTER_ENABLED: process.env.EMERGENCY_FILTER_ENABLED === 'true',
  MAX_PROFIT_RATE: parseFloat(process.env.MAX_PROFIT_RATE || "50"),
  STRICT_VALIDATION: process.env.STRICT_VALIDATION === 'true',
  REJECT_PULSEX: process.env.REJECT_PULSEX === 'true',
  REJECT_POWSWAP: process.env.REJECT_POWSWAP === 'true',
  // Enhanced Monitoring Settings
  ENABLE_EXTENDED_TOKENS: process.env.ENABLE_EXTENDED_TOKENS === 'true',
  MONITOR_DEFI_TOKENS: process.env.MONITOR_DEFI_TOKENS === 'true',
  ENHANCED_LOGGING: process.env.ENHANCED_LOGGING === 'true',
  UPDATE_INTERVAL: parseInt(process.env.UPDATE_INTERVAL || "60000"),
  MAX_CONCURRENT_REQUESTS: parseInt(process.env.MAX_CONCURRENT_REQUESTS || "3"),
  COLLECTION_TIMEOUT: parseInt(process.env.COLLECTION_TIMEOUT || "30000"),
  // DEXScreener API Settings
  DEXSCREENER_API_URL: process.env.DEXSCREENER_API_URL || 'https://api.dexscreener.com/latest',
  DEXSCREENER_RATE_LIMIT_DELAY: parseInt(process.env.DEXSCREENER_RATE_LIMIT_DELAY || '1000'),
  DEXSCREENER_MAX_RETRIES: parseInt(process.env.DEXSCREENER_MAX_RETRIES || '3'),
  DEXSCREENER_TIMEOUT: parseInt(process.env.DEXSCREENER_TIMEOUT || '30000'),
  DEXSCREENER_MIN_LIQUIDITY: parseFloat(process.env.DEXSCREENER_MIN_LIQUIDITY || '10000')
};

// Type for config
type ConfigType = typeof config;

// Global state
let serviceStatus: ServiceStatus = {
  elizaos: 'unavailable',
  ai: false,
  blockchain: false,
  priceFeeds: false,
  arbitrageMonitoring: false,
  deployment: RAILWAY_ENVIRONMENT ? 'railway' : 'local',
};

let elizaAgent: any = null;
let elizaAvailableMethods: string[] = [];
let arbitrageCollector: ArbitrageDataCollector | null = null;
let currentOpportunities: ArbitrageOpportunity[] = [];
let monitoringActive = false;

const defaultCharacter: Character = {
  name: "EnhancedArbitrageTrader",
  bio: [
    "Advanced AI-powered DeFi arbitrage specialist with 22+ token monitoring",
    "Expert in multi-tier cross-DEX price analysis and opportunity detection"
  ],
  description: "Enhanced DeFi arbitrage trading specialist with comprehensive token coverage",
  personality: "analytical, data-driven, risk-aware, profit-focused, detail-oriented",
  knowledge: [
    "Real-time price monitoring across 22+ tokens and multiple DEXs",
    "Multi-tier arbitrage opportunity detection and analysis", 
    "Enhanced filtering and validation systems",
    "Performance optimization and quality assurance"
  ],
  modelProvider: "anthropic"
};

// HTTP helper function
function makeHttpRequest(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: { 
          'User-Agent': 'ElizaEnhancedArbitrageBot/2.0', 
          'Accept': 'application/json' 
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { 
            resolve(JSON.parse(data)); 
          } catch (error) { 
            resolve(data); 
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(config.COLLECTION_TIMEOUT, () => { 
        req.destroy(); 
        reject(new Error('Request timeout')); 
      });
      req.end();
    } catch (error) { 
      reject(error); 
    }
  });
}

// Enhanced Price Ranges Class
class EnhancedPriceRanges {
  static readonly EXTENDED_PRICE_RANGES = {
    // Existing tokens
    'DAI': { min: 0.90, max: 1.10, type: 'stablecoin' },
    'USDC': { min: 0.90, max: 1.10, type: 'stablecoin' },
    'USDT': { min: 0.90, max: 1.10, type: 'stablecoin' },
    'WBTC': { min: 40000, max: 200000, type: 'bitcoin-pegged' },
    'ETH': { min: 1500, max: 15000, type: 'major-crypto' },
    'ETHEREUM': { min: 1500, max: 15000, type: 'major-crypto' },
    'BITCOIN': { min: 40000, max: 200000, type: 'bitcoin-pegged' },
    
    // Enhanced token support
    'LINK': { min: 5, max: 100, type: 'defi' },
    'CHAINLINK': { min: 5, max: 100, type: 'defi' },
    'UNI': { min: 3, max: 50, type: 'defi' },
    'UNISWAP': { min: 3, max: 50, type: 'defi' },
    'AAVE': { min: 50, max: 1000, type: 'defi' },
    'MATIC': { min: 0.3, max: 10, type: 'layer2' },
    'POLYGON': { min: 0.3, max: 10, type: 'layer2' },
    'SOL': { min: 10, max: 500, type: 'layer1' },
    'SOLANA': { min: 10, max: 500, type: 'layer1' },
    'ADA': { min: 0.1, max: 5, type: 'layer1' },
    'CARDANO': { min: 0.1, max: 5, type: 'layer1' },
    'AVAX': { min: 8, max: 200, type: 'layer1' },
    'AVALANCHE': { min: 8, max: 200, type: 'layer1' },
    'COMP': { min: 30, max: 800, type: 'defi' },
    'MKR': { min: 500, max: 5000, type: 'defi' },
    'MAKER': { min: 500, max: 5000, type: 'defi' },
    'GRT': { min: 0.05, max: 3, type: 'infrastructure' },
    'SNX': { min: 1, max: 50, type: 'defi' },
    'CRV': { min: 0.2, max: 10, type: 'defi' },
    'SUSHI': { min: 0.3, max: 15, type: 'defi' },
    'CAKE': { min: 1, max: 30, type: 'defi' },
    'ARB': { min: 0.5, max: 20, type: 'layer2' },
    'OP': { min: 1, max: 50, type: 'layer2' }
  } as const;

  static getPriceRange(token: string): { min: number; max: number; type: string } | null {
    const normalizedToken = token.toUpperCase() as keyof typeof this.EXTENDED_PRICE_RANGES;
    return this.EXTENDED_PRICE_RANGES[normalizedToken] || null;
  }

  static isValidPrice(token: string, price: number): boolean {
    const range = this.getPriceRange(token);
    if (!range) return true;
    return price >= range.min && price <= range.max;
  }
}

// Enhanced Emergency Anomaly Filter
class EmergencyAnomalyFilter {
  private readonly PRICE_RANGES = EnhancedPriceRanges.EXTENDED_PRICE_RANGES;
  private readonly UNRELIABLE_SOURCES = [
    'pulsex', 'pulseX', 'powswap', 'unknown_dex', 'unknown'
  ];
  private readonly MAX_PROFIT_RATE = parseFloat(process.env.MAX_PROFIT_RATE || "50");

  validateOpportunity(opportunity: ArbitrageOpportunity): ValidationResult {
    const validationResult: ValidationResult = {
      isValid: false,
      reason: '',
      score: 0,
      recommendation: 'REJECT'
    };

    // 1. Basic number validation
    if (!this.isValidNumber(opportunity.buyPrice) || !this.isValidNumber(opportunity.sellPrice)) {
      validationResult.reason = 'Invalid price data';
      return validationResult;
    }

    // 2. Enhanced price range validation
    const priceValidation = this.validatePriceRange(opportunity.token, opportunity.buyPrice, opportunity.sellPrice);
    if (!priceValidation.valid) {
      validationResult.reason = `Price out of range: ${priceValidation.reason}`;
      return validationResult;
    }

    // 3. Dynamic profit rate validation based on token type
    const profitValidation = this.validateProfitRate(opportunity);
    if (!profitValidation.valid) {
      validationResult.reason = `Invalid profit rate: ${profitValidation.reason}`;
      return validationResult;
    }

    // 4. Source reliability validation
    const sourceValidation = this.validateSources(opportunity.buyExchange, opportunity.sellExchange);
    if (!sourceValidation.valid) {
      validationResult.reason = `Unreliable source: ${sourceValidation.reason}`;
      return validationResult;
    }

    // 5. Stablecoin special validation
    if (this.isStablecoin(opportunity.token)) {
      const stableValidation = this.validateStablecoin(opportunity);
      if (!stableValidation.valid) {
        validationResult.reason = `Stablecoin anomaly: ${stableValidation.reason}`;
        return validationResult;
      }
    }

    // 6. Enhanced scoring
    validationResult.score = this.calculateScore(opportunity);
    
    if (validationResult.score >= 70) {
      validationResult.isValid = true;
      validationResult.recommendation = 'ACCEPT';
      validationResult.reason = 'Passed all validation checks';
    } else if (validationResult.score >= 40) {
      validationResult.isValid = false;
      validationResult.recommendation = 'CAUTION';
      validationResult.reason = 'Moderate confidence, requires manual review';
    } else {
      validationResult.recommendation = 'REJECT';
      validationResult.reason = 'Low confidence score';
    }

    return validationResult;
  }

  private validatePriceRange(token: string, buyPrice: number, sellPrice: number): { valid: boolean; reason: string } {
    const range = EnhancedPriceRanges.getPriceRange(token);
    
    if (!range) {
      return { valid: true, reason: 'Unknown token, skipping range check' };
    }

    if (!EnhancedPriceRanges.isValidPrice(token, buyPrice)) {
      return { 
        valid: false, 
        reason: `Buy price $${buyPrice} outside range $${range.min}-$${range.max} for ${range.type}` 
      };
    }

    if (!EnhancedPriceRanges.isValidPrice(token, sellPrice)) {
      return { 
        valid: false, 
        reason: `Sell price $${sellPrice} outside range $${range.min}-$${range.max} for ${range.type}` 
      };
    }

    return { valid: true, reason: `Price range valid for ${range.type}` };
  }

  private validateProfitRate(opportunity: ArbitrageOpportunity): { valid: boolean; reason: string } {
    const range = EnhancedPriceRanges.getPriceRange(opportunity.token);
    
    // Token type-specific max profit rates
    const maxProfitRates: { [key: string]: number } = {
      'stablecoin': 5,      // Stablecoins max 5%
      'major-crypto': 25,   // Major crypto max 25%
      'bitcoin-pegged': 25, // Bitcoin-pegged max 25%
      'defi': 50,          // DeFi tokens max 50%
      'layer1': 100,       // Layer 1 tokens max 100%
      'layer2': 100,       // Layer 2 tokens max 100%
      'infrastructure': 150, // Infrastructure tokens max 150%
      'altcoin': 200       // Other altcoins max 200%
    };

    const maxRate = range ? maxProfitRates[range.type] || this.MAX_PROFIT_RATE : this.MAX_PROFIT_RATE;
    
    if (opportunity.profitPercentage > maxRate) {
      return { 
        valid: false, 
        reason: `${opportunity.profitPercentage.toFixed(2)}% exceeds max for ${range?.type || 'unknown'} (${maxRate}%)` 
      };
    }

    return { valid: true, reason: 'Profit rate acceptable' };
  }

  private validateSources(buyExchange: string, sellExchange: string): { valid: boolean; reason: string } {
    const normalizedBuySource = buyExchange.toLowerCase();
    const normalizedSellSource = sellExchange.toLowerCase();

    if (this.UNRELIABLE_SOURCES.some(source => normalizedBuySource.includes(source))) {
      return { 
        valid: false, 
        reason: `Unreliable buy source: ${buyExchange}` 
      };
    }

    if (this.UNRELIABLE_SOURCES.some(source => normalizedSellSource.includes(source))) {
      return { 
        valid: false, 
        reason: `Unreliable sell source: ${sellExchange}` 
      };
    }

    if (normalizedBuySource === normalizedSellSource) {
      return { 
        valid: false, 
        reason: 'Same source for buy and sell' 
      };
    }

    return { valid: true, reason: 'Sources OK' };
  }

  private validateStablecoin(opportunity: ArbitrageOpportunity): { valid: boolean; reason: string } {
    const token = opportunity.token.toUpperCase();
    
    if (!this.isStablecoin(token)) {
      return { valid: true, reason: 'Not a stablecoin' };
    }

    const expectedPrice = 1.0;
    const maxDeviation = 0.05; // 5%

    const buyDeviation = Math.abs(opportunity.buyPrice - expectedPrice) / expectedPrice;
    const sellDeviation = Math.abs(opportunity.sellPrice - expectedPrice) / expectedPrice;

    if (buyDeviation > maxDeviation) {
      return { 
        valid: false, 
        reason: `Buy price deviation ${(buyDeviation * 100).toFixed(2)}% exceeds ${maxDeviation * 100}%` 
      };
    }

    if (sellDeviation > maxDeviation) {
      return { 
        valid: false, 
        reason: `Sell price deviation ${(sellDeviation * 100).toFixed(2)}% exceeds ${maxDeviation * 100}%` 
      };
    }

    return { valid: true, reason: 'Stablecoin prices within acceptable range' };
  }

  private calculateScore(opportunity: ArbitrageOpportunity): number {
    let score = 0;

    // Profit rate score (adaptive based on token type)
    const range = EnhancedPriceRanges.getPriceRange(opportunity.token);
    const tokenType = range?.type || 'unknown';
    
    if (tokenType === 'stablecoin') {
      if (opportunity.profitPercentage >= 0.5 && opportunity.profitPercentage <= 2) score += 40;
      else if (opportunity.profitPercentage <= 5) score += 20;
    } else if (tokenType === 'major-crypto' || tokenType === 'bitcoin-pegged') {
      if (opportunity.profitPercentage >= 1 && opportunity.profitPercentage <= 10) score += 40;
      else if (opportunity.profitPercentage <= 25) score += 20;
    } else {
      if (opportunity.profitPercentage >= 2 && opportunity.profitPercentage <= 15) score += 40;
      else if (opportunity.profitPercentage <= 50) score += 20;
    }

    // Source reliability score
    const sourceReliability = this.getSourceReliability(opportunity.buyExchange) + 
                            this.getSourceReliability(opportunity.sellExchange);
    score += sourceReliability;

    // Token type bonus
    const typeBonus: { [key: string]: number } = {
      'stablecoin': 20,
      'major-crypto': 15,
      'bitcoin-pegged': 15,
      'defi': 10,
      'layer1': 8,
      'layer2': 8,
      'infrastructure': 5
    };
    score += typeBonus[tokenType] || 0;

    return Math.max(0, Math.min(100, score));
  }

  private isValidNumber(value: number): boolean {
    return typeof value === 'number' && !isNaN(value) && value > 0 && isFinite(value);
  }

  private isStablecoin(token: string): boolean {
    const stablecoins = ['DAI', 'USDC', 'USDT', 'BUSD', 'FRAX'];
    return stablecoins.includes(token.toUpperCase());
  }

  private getSourceReliability(source: string): number {
    const reliability: { [key: string]: number } = {
      'coingecko': 15,
      'coingecko_average': 15,
      'binance': 12,
      'coinbase': 12,
      'uniswap': 10,
      'uniswap_v3': 10,
      'sushiswap': 8,
      'curve': 8,
      'pancakeswap': 6,
      'quickswap': 5,
      'pulsex': 0,
      'powswap': 0
    };

    return reliability[source.toLowerCase()] || 5;
  }

  filterOpportunities(opportunities: ArbitrageOpportunity[]): {
    accepted: ArbitrageOpportunity[];
    rejected: ArbitrageOpportunity[];
    summary: {
      total: number;
      accepted: number;
      rejected: number;
      filterEfficiency: string;
    };
  } {
    const accepted: ArbitrageOpportunity[] = [];
    const rejected: ArbitrageOpportunity[] = [];

    console.log(`🔍 Enhanced filtering ${opportunities.length} opportunities...`);

    for (const opportunity of opportunities) {
      const validation = this.validateOpportunity(opportunity);
      
      if (validation.isValid) {
        accepted.push({
          ...opportunity,
          confidence: this.mapScoreToConfidence(validation.score)
        });
        if (config.ENHANCED_LOGGING) {
          console.log(`✅ ACCEPTED: ${opportunity.token} - ${validation.reason} (Score: ${validation.score})`);
        }
      } else {
        rejected.push(opportunity);
        if (config.ENHANCED_LOGGING) {
          console.log(`❌ REJECTED: ${opportunity.token} - ${validation.reason}`);
        }
      }
    }

    const summary = {
      total: opportunities.length,
      accepted: accepted.length,
      rejected: rejected.length,
      filterEfficiency: ((rejected.length / opportunities.length) * 100).toFixed(1)
    };

    console.log(`📊 Enhanced Filter Results: ${accepted.length} accepted, ${rejected.length} rejected (${summary.filterEfficiency}% filtered out)`);

    return { accepted: accepted.sort((a, b) => b.netProfit - a.netProfit), rejected, summary };
  }

  private mapScoreToConfidence(score: number): 'low' | 'medium' | 'high' {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }
}

// Enhanced Arbitrage Data Collector
class ArbitrageDataCollector {
  constructor(private config: ConfigType) {}

  async collectPriceData(tokens: string[]): Promise<PriceData[]> {
    const priceData: PriceData[] = [];
    const startTime = Date.now();
    
    try {
      if (config.ENHANCED_LOGGING) {
        console.log(`📊 Enhanced price collection for ${tokens.length} tokens: ${tokens.join(', ')}`);
      }

      // CoinGecko API (high precision data)
      if (this.config.COINGECKO_API_KEY) {
        try {
          console.log(`   🥇 Fetching high-precision data from CoinGecko...`);
          const cgStartTime = Date.now();
          const cgPrices = await this.getCoinGeckoPrices(tokens);
          const cgTime = Date.now() - cgStartTime;
          
          priceData.push(...cgPrices);
          console.log(`   ✅ CoinGecko: ${cgPrices.length} price points in ${cgTime}ms`);
          
        } catch (cgError: any) {
          console.warn(`   ⚠️ CoinGecko collection failed:`, cgError.message);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // DEX price data collection
      try {
        console.log(`   🌐 Fetching decentralized data from DEX sources...`);
        const dexStartTime = Date.now();
        const dexPrices = await this.getDEXPrices(tokens);
        const dexTime = Date.now() - dexStartTime;
        
        priceData.push(...dexPrices);
        console.log(`   ✅ DEX Sources: ${dexPrices.length} price points in ${dexTime}ms`);
        
      } catch (dexError: any) {
        console.warn(`   ⚠️ DEX collection failed:`, dexError.message);
      }

      const totalTime = Date.now() - startTime;
      console.log(`📈 Enhanced collection completed in ${totalTime}ms with ${priceData.length} data points`);

      return priceData;

    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ Enhanced price collection failed after ${totalTime}ms:`, error);
      return priceData;
    }
  }

  private async getCoinGeckoPrices(tokens: string[]): Promise<PriceData[]> {
    try {
      const tokenIds = tokens.join(',');
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${tokenIds}&vs_currencies=usd&include_24hr_vol=true&x_cg_demo_api_key=${this.config.COINGECKO_API_KEY}`;
      const response = await makeHttpRequest(url);
      const priceData: PriceData[] = [];

      for (const [token, data] of Object.entries(response)) {
        if (data && typeof data === 'object') {
          priceData.push({
            exchange: 'coingecko_average',
            pair: `${token}/usd`,
            price: (data as any).usd || 0,
            volume: (data as any).usd_24h_vol || 0,
            timestamp: Date.now()
          });
        }
      }
      return priceData;
    } catch (error) {
      console.error("CoinGecko price fetch error:", error);
      return [];
    }
  }

  private async getDEXPrices(tokens: string[]): Promise<PriceData[]> {
    try {
      // Complete token addresses mapping for all 22+ tokens
      const tokenAddresses: { [key: string]: string } = {
        // Tier 1: Major Cryptocurrencies
        'ethereum': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',  // WETH
        'bitcoin': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',   // WBTC
        'solana': '0xD31a59c85aE9D8edEFeC411D448f90841571b89c',    // SOL (Wormhole)
        'cardano': '0xAE7ab96520DE3A18E5e111B5EaAb095312D7fE84',   // stETH (ADA proxy)
        
        // Tier 2: Stablecoins
        'usd-coin': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',  // USDC
        'dai': '0x6B175474E89094C44Da98b954EedeAC495271d0F',       // DAI
        'tether': '0xdAC17F958D2ee523a2206206994597C13D831ec7',    // USDT
        
        // Tier 3: DeFi Tokens
        'chainlink': '0x514910771AF9Ca656af840dff83E8264EcF986CA',  // LINK
        'uniswap': '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',    // UNI
        'aave': '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',       // AAVE
        'compound-governance-token': '0xc00e94Cb662C3520282E6f5717214004A7f26888', // COMP
        'maker': '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',      // MKR
        'synthetix-network-token': '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F', // SNX
        
        // Tier 4: Layer 1/Layer 2
        'polygon': '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',    // MATIC
        'avalanche-2': '0x85f138bfEE4ef8e540890CFb48F620571d67Eda3', // WAVAX
        'arbitrum': '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1',    // ARB
        'optimism': '0x4200000000000000000000000000000000000042',    // OP
        
        // Tier 5: Other Important DeFi
        'the-graph': '0xc944E90C64B2c07662A292be6244BDf05Cda44a7',  // GRT
        'curve-dao-token': '0xD533a949740bb3306d119CC777fa900bA034cd52', // CRV
        'pancakeswap-token': '0x152649eA73beAb28c5b49B26eb48f7EAD6d4c898', // CAKE
        'sushiswap': '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2'     // SUSHI
      };

      const priceData: PriceData[] = [];
      const batchSize = 5; // Rate limit consideration
      const delayBetweenBatches = this.config.DEXSCREENER_RATE_LIMIT_DELAY;

      // Process tokens in batches
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        const batchPromises = [];

        for (const token of batch) {
          if (tokenAddresses[token]) {
            const address = tokenAddresses[token];
            batchPromises.push(
              this.fetchDEXScreenerData(token, address)
                .catch(error => {
                  console.error(`DEXScreener error for ${token}:`, error.message);
                  return null;
                })
            );
          } else {
            console.warn(`No contract address configured for token: ${token}`);
          }
        }

        // Process batch requests in parallel
        const batchResults = await Promise.all(batchPromises);
        
        // Add valid results
        for (const result of batchResults) {
          if (result && Array.isArray(result)) {
            priceData.push(...result);
          }
        }

        // Wait before next batch (except for last batch)
        if (i + batchSize < tokens.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      console.log(`DEXScreener: Collected ${priceData.length} price points for ${tokens.length} tokens`);
      return priceData;
    } catch (error) {
      console.error("DEX price fetch error:", error);
      return [];
    }
  }

  // New helper method for individual token data fetching
  private async fetchDEXScreenerData(token: string, address: string): Promise<PriceData[]> {
    try {
      const url = `${this.config.DEXSCREENER_API_URL}/dex/tokens/${address}`;
      const response = await makeHttpRequest(url);
      const priceData: PriceData[] = [];

      if (response.pairs && Array.isArray(response.pairs)) {
        // Filter for high liquidity pairs only
        const validPairs = response.pairs
          .filter(pair => 
            pair.priceUsd && 
            parseFloat(pair.priceUsd) > 0 &&
            pair.liquidity?.usd > this.config.DEXSCREENER_MIN_LIQUIDITY
          )
          .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))
          .slice(0, 5);

        for (const pair of validPairs) {
          priceData.push({
            exchange: pair.dexId || 'unknown_dex',
            pair: `${pair.baseToken?.symbol || token}/${pair.quoteToken?.symbol || 'USD'}`,
            price: parseFloat(pair.priceUsd),
            volume: parseFloat(pair.volume?.h24 || '0'),
            timestamp: Date.now()
          });
        }
      }

      return priceData;
    } catch (error) {
      throw new Error(`Failed to fetch ${token} data: ${error.message}`);
    }
  }

  analyzeArbitrageOpportunities(priceData: PriceData[]): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    const tokenGroups: { [key: string]: PriceData[] } = {};
    
    // Group price data by token
    for (const data of priceData) {
      const token = data.pair.split('/')[0].toLowerCase();
      if (!tokenGroups[token]) tokenGroups[token] = [];
      tokenGroups[token].push(data);
    }

    // Analyze each token group for arbitrage opportunities
    for (const [token, prices] of Object.entries(tokenGroups)) {
      if (prices.length < 2) continue;

      const sortedPrices = prices.sort((a, b) => a.price - b.price);
      const cheapest = sortedPrices[0];
      const mostExpensive = sortedPrices[sortedPrices.length - 1];

      if (cheapest.exchange === mostExpensive.exchange) continue;

      const priceDifference = mostExpensive.price - cheapest.price;
      const profitPercentage = (priceDifference / cheapest.price) * 100;

      // Dynamic minimum threshold based on token type
      const minThreshold = this.getMinProfitThreshold(token);

      if (profitPercentage >= minThreshold) {
        const estimatedGasCost = this.estimateGasCost();
        const potentialProfit = (this.config.TRADE_AMOUNT * profitPercentage) / 100;
        const netProfit = potentialProfit - estimatedGasCost;

        if (netProfit > 0) {
          opportunities.push({
            token: token.toUpperCase(),
            buyExchange: cheapest.exchange,
            sellExchange: mostExpensive.exchange,
            buyPrice: cheapest.price,
            sellPrice: mostExpensive.price,
            priceDifference,
            potentialProfit,
            estimatedGasCost,
            netProfit,
            profitPercentage,
            confidence: this.calculateConfidence(cheapest, mostExpensive, profitPercentage),
            timestamp: Date.now()
          });
        }
      }
    }

    // Apply enhanced filter if enabled
    if (config.EMERGENCY_FILTER_ENABLED) {
      const filter = new EmergencyAnomalyFilter();
      const filteredResults = filter.filterOpportunities(opportunities);

      console.log(`🛡️ Enhanced Filter Applied:`);
      console.log(`📊 Original opportunities: ${opportunities.length}`);
      console.log(`✅ Accepted: ${filteredResults.accepted.length}`);
      console.log(`❌ Rejected: ${filteredResults.rejected.length}`);
      console.log(`🔍 Filter efficiency: ${filteredResults.summary.filterEfficiency}%`);

      return filteredResults.accepted;
    }

    return opportunities.sort((a, b) => b.netProfit - a.netProfit);
  }

  private getMinProfitThreshold(token: string): number {
    const range = EnhancedPriceRanges.getPriceRange(token);
    
    if (!range) return this.config.MIN_PROFIT_THRESHOLD;

    const thresholds: { [key: string]: number } = {
      'stablecoin': 0.1,      // 0.1%
      'major-crypto': 0.5,    // 0.5%
      'bitcoin-pegged': 0.5,  // 0.5%
      'defi': 1.0,           // 1.0%
      'layer1': 2.0,         // 2.0%
      'layer2': 2.0,         // 2.0%
      'infrastructure': 3.0,  // 3.0%
      'altcoin': 5.0         // 5.0%
    };

    return thresholds[range.type] || this.config.MIN_PROFIT_THRESHOLD;
  }

  private estimateGasCost(): number {
    const averageGasPrice = 30; // Gwei
    const gasLimit = 300000;
    const ethPrice = 2500;
    return (averageGasPrice * gasLimit * ethPrice) / 1e9;
  }

  private calculateConfidence(cheapest: PriceData, mostExpensive: PriceData, profitPercentage: number): 'low' | 'medium' | 'high' {
    let score = 0;
    
    // Profit rate scoring
    if (profitPercentage > 5) score += 3;
    else if (profitPercentage > 2) score += 2;
    else if (profitPercentage > 1) score += 1;
    
    // Volume scoring
    if (cheapest.volume > 100000 && mostExpensive.volume > 100000) score += 2;
    else if (cheapest.volume > 10000 && mostExpensive.volume > 10000) score += 1;
    
    // Exchange reliability scoring
    const reputableExchanges = ['uniswap', 'sushiswap', 'pancakeswap', 'coingecko_average', 'curve'];
    if (reputableExchanges.some(ex => cheapest.exchange.includes(ex)) && 
        reputableExchanges.some(ex => mostExpensive.exchange.includes(ex))) score += 1;

    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }
}

// ElizaOS initialization
async function initializeElizaOS(): Promise<boolean> {
  try {
    console.log("🔄 Starting Enhanced ElizaOS initialization...");
    
    let elizaModule: any;
    try {
      elizaModule = await import("@elizaos/core");
      console.log("✅ ElizaOS module imported successfully");
    } catch (importError) {
      console.log("⚠️ ElizaOS import failed:", importError);
      throw importError;
    }

    const AgentRuntime = elizaModule.AgentRuntime || elizaModule.default?.AgentRuntime;
    if (!AgentRuntime) throw new Error("AgentRuntime not available");

    let characterConfig: Character;
    try {
      const characterPath = join(process.cwd(), 'characters', 'arbitrage-trader.character.json');
      const characterData = await readFile(characterPath, 'utf-8');
      characterConfig = JSON.parse(characterData);
      console.log("✅ Character configuration loaded:", characterConfig.name);
    } catch (error) {
      console.log("⚠️ Using enhanced default character configuration");
      characterConfig = defaultCharacter;
    }

    try {
      elizaAgent = new AgentRuntime({
        character: characterConfig,
        databaseAdapter: null,
        token: config.ANTHROPIC_API_KEY || config.OPENAI_API_KEY || "test-token",
        modelProvider: "anthropic"
      });

      elizaAvailableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(elizaAgent))
        .filter(name => typeof elizaAgent[name] === 'function' && name !== 'constructor');

      serviceStatus.elizaos = 'available';
      console.log("✅ Enhanced ElizaOS initialization completed successfully");
      return true;
    } catch (runtimeError) {
      console.log("⚠️ AgentRuntime creation failed:", runtimeError);
      serviceStatus.elizaos = 'limited';
      return false;
    }
  } catch (error) {
    console.log("❌ Enhanced ElizaOS initialization failed:", error instanceof Error ? error.message : String(error));
    serviceStatus.elizaos = 'unavailable';
    return false;
  }
}

// AI Chat Service
class AIChatService {
  async generateResponse(message: string, context?: string): Promise<string> {
    const arbitrageContext = this.buildArbitrageContext(message);
    const fullContext = [context, arbitrageContext].filter(Boolean).join(' ');

    if (serviceStatus.elizaos === 'available' && elizaAgent) {
      try {
        return await this.useElizaAgent(message, fullContext);
      } catch (error) {
        console.log("⚠️ ElizaOS agent error, falling back:", error);
      }
    }

    if (config.ANTHROPIC_API_KEY) {
      try {
        return await this.callAnthropic(message, fullContext);
      } catch (error) {
        console.error('Anthropic API error:', error);
      }
    }

    return this.generateEnhancedRuleBasedResponse(message);
  }

  private buildArbitrageContext(message: string): string {
    const lowerMessage = message.toLowerCase();
    let context = "";

    if (currentOpportunities.length > 0 && 
        (lowerMessage.includes('機会') || lowerMessage.includes('opportunity') || 
         lowerMessage.includes('利益') || lowerMessage.includes('profit'))) {
      
      const topOpps = currentOpportunities.slice(0, 3);
      context += `現在のアービトラージ機会 (${currentOpportunities.length}件): `;
      topOpps.forEach((opp, i) => {
        context += `${i + 1}. ${opp.token}: ${opp.buyExchange}(${opp.buyPrice.toFixed(4)}) → ${opp.sellExchange}(${opp.sellPrice.toFixed(4)}) 利益${opp.profitPercentage.toFixed(2)}% `;
      });
    }

    if (lowerMessage.includes('監視') || lowerMessage.includes('monitoring')) {
      context += `監視状態: ${monitoringActive ? 'アクティブ' : '停止中'}. `;
    }

    if (lowerMessage.includes('トークン') || lowerMessage.includes('token')) {
      const supportedCount = Object.keys(EnhancedPriceRanges.EXTENDED_PRICE_RANGES).length;
      context += `拡張サポート: ${supportedCount}種類のトークン監視中. `;
    }

    return context;
  }

  private async useElizaAgent(message: string, context?: string): Promise<string> {
    const memory: Memory = {
      userId: "web-user",
      roomId: "web-chat",
      content: {
        text: message,
        context: context || "",
        arbitrageData: { 
          opportunities: currentOpportunities.slice(0, 5), 
          monitoringActive, 
          serviceStatus,
          enhancedFeatures: {
            tokenCount: Object.keys(EnhancedPriceRanges.EXTENDED_PRICE_RANGES).length,
            filteringEnabled: config.EMERGENCY_FILTER_ENABLED,
            extendedTokens: config.ENABLE_EXTENDED_TOKENS
          }
        }
      },
      timestamp: new Date().toISOString()
    };

    const methodsToTry = ['processMessage', 'handleMessage', 'composeState', 'processAction', 'evaluate'];

    for (const methodName of methodsToTry) {
      if (elizaAvailableMethods.includes(methodName)) {
        try {
          let result;
          if (methodName === 'processAction') {
            result = await elizaAgent[methodName]('chat', memory);
          } else if (methodName === 'composeState') {
            result = await elizaAgent[methodName](memory);
          } else {
            result = await elizaAgent[methodName](memory);
          }
          
          if (typeof result === 'string') return result;
          else if (result?.content?.text) return result.content.text;
          else if (result?.text) return result.text;
        } catch (methodError) {
          continue;
        }
      }
    }

    throw new Error("No suitable ElizaOS method succeeded");
  }

  private async callAnthropic(message: string, context?: string): Promise<string> {
    const systemPrompt = `あなたは高度なDeFiアービトラージトレーダーです。
22種類以上のトークンをリアルタイムで監視し、多層フィルタリングシステムで機会を分析します。
${context ? `現在のデータ: ${context}` : ''}

拡張機能:
- 5段階のトークン優先度システム
- トークンタイプ別の動的利益率閾値
- 高度な価格検証とリスク評価`;

    const payload = JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: "user", content: message }]
    });

    try {
      return new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'api.anthropic.com',
          port: 443,
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
            'Content-Length': Buffer.byteLength(payload)
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed.content?.[0]?.text || "Anthropic APIからの応答を取得できませんでした。");
            } catch (error) {
              resolve("Anthropic APIの応答解析に失敗しました。");
            }
          });
        });

        req.on('error', () => resolve("Anthropic APIの呼び出しに失敗しました。"));
        req.write(payload);
        req.end();
      });
    } catch (error) {
      return "Anthropic APIの呼び出しに失敗しました。";
    }
  }

  private generateEnhancedRuleBasedResponse(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('サポート') || lowerMessage.includes('support')) {
      const tokenCount = Object.keys(EnhancedPriceRanges.EXTENDED_PRICE_RANGES).length;
      return `🔧 拡張サポート状況:

📊 監視対象: ${tokenCount}種類のトークン
🏦 取引所: 10以上のDEX/CEX
🛡️ セキュリティ: 多層フィルタリング

主要カテゴリ:
• ステーブルコイン: DAI, USDC, USDT
• メジャー暗号通貨: BTC, ETH, SOL, ADA
• DeFiトークン: LINK, UNI, AAVE, COMP, MKR
• レイヤー1/2: MATIC, AVAX, ARB, OP
• インフラ: GRT, CRV, SUSHI, CAKE

詳細情報: /api/enhanced-support`;
    }

    if ((lowerMessage.includes('機会') || lowerMessage.includes('opportunity')) && currentOpportunities.length > 0) {
      let response = `現在のアービトラージ機会 (${currentOpportunities.length}件):\n\n`;
      
      // Group by token type
      const byType = currentOpportunities.reduce((acc: any, opp) => {
        const range = EnhancedPriceRanges.getPriceRange(opp.token);
        const type = range?.type || 'unknown';
        if (!acc[type]) acc[type] = [];
        acc[type].push(opp);
        return acc;
      }, {});

      Object.entries(byType).forEach(([type, opps]: [string, any[]]) => {
        response += `🔸 ${type.toUpperCase()}: ${opps.length}件\n`;
        opps.slice(0, 2).forEach((opp, i) => {
          response += `   ${i + 1}. ${opp.token}: ${opp.profitPercentage.toFixed(2)}% (${opp.confidence})\n`;
        });
      });
      
      return response;
    }

    if (lowerMessage.includes('監視') || lowerMessage.includes('status')) {
      const supportedTokens = Object.keys(EnhancedPriceRanges.EXTENDED_PRICE_RANGES).length;
      return `📊 拡張アービトラージ監視状況:

🔍 監視状態: ${monitoringActive ? '✅ アクティブ' : '❌ 停止中'}
📈 価格データ: ${serviceStatus.priceFeeds ? '✅ 利用可能' : '❌ 制限中'}
🤖 ElizaOS: ${serviceStatus.elizaos === 'available' ? '✅ 統合済み' : '⚠️ 制限モード'}
💹 検出機会数: ${currentOpportunities.length}件

🎯 拡張機能:
• 監視トークン: ${supportedTokens}種類
• 多層フィルタリング: ${config.EMERGENCY_FILTER_ENABLED ? '有効' : '無効'}
• 動的閾値調整: 有効
• 品質保証: リアルタイム`;
    }

    const responses: { [key: string]: string } = {
      "トークン": `🪙 拡張トークンサポート:
• Tier 1 (Major): ETH, BTC, SOL, ADA
• Tier 2 (Stable): USDC, DAI, USDT
• Tier 3 (DeFi): LINK, UNI, AAVE, COMP, MKR, SNX
• Tier 4 (Layer): MATIC, AVAX, ARB, OP
• Tier 5 (Others): GRT, CRV, SUSHI, CAKE`,
      "始め方": "1. 拡張監視開始 2. トークン選択 3. フィルター調整 4. 機会分析",
      "リスク": "主要リスク: ガス代変動、スリッページ、MEV攻撃、流動性不足\n拡張保護: 多層検証、動的閾値、品質監視"
    };

    for (const [keyword, response] of Object.entries(responses)) {
      if (lowerMessage.includes(keyword)) return response;
    }

    return `DeFi拡張アービトラージボットへようこそ！
🎯 現在 ${currentOpportunities.length}件の機会を${Object.keys(EnhancedPriceRanges.EXTENDED_PRICE_RANGES).length}種類のトークンから検出中です。`;
  }
}

// Services initialization
const aiService = new AIChatService();

async function initializeServices() {
  console.log("🔄 Initializing enhanced services...");

  try {
    await initializeElizaOS();
    arbitrageCollector = new ArbitrageDataCollector(config);
    console.log("✅ Enhanced arbitrage data collector initialized");

    await aiService.generateResponse("テスト");
    serviceStatus.ai = true;
    console.log("✅ Enhanced AI service ready");

    if (config.COINGECKO_API_KEY) {
      serviceStatus.priceFeeds = true;
      console.log("✅ Enhanced price feeds ready");
    }

    console.log("📊 Enhanced services initialized:", serviceStatus);
    
  } catch (error) {
    console.error("⚠️ Enhanced service initialization error:", error);
  }
}

// Enhanced Monitoring with 22+ Tokens
async function startMonitoringLoop() {
  const monitoredTokens = [
    // Tier 1: Major Cryptocurrencies
    'ethereum', 'bitcoin', 'solana', 'cardano',
    // Tier 2: Stablecoins  
    'usd-coin', 'dai', 'tether',
    // Tier 3: DeFi Tokens
    'chainlink', 'uniswap', 'aave', 'compound-governance-token', 'maker', 'synthetix-network-token',
    // Tier 4: Layer 1/Layer 2
    'polygon', 'avalanche-2', 'arbitrum', 'optimism',
    // Tier 5: Other Important DeFi
    'the-graph', 'curve-dao-token', 'pancakeswap-token', 'sushiswap'
  ];

  const intervalMs = config.UPDATE_INTERVAL;

  console.log(`🔄 Enhanced monitoring activated with ${monitoredTokens.length} tokens!`);

  const runMonitoring = async () => {
    if (!monitoringActive || !arbitrageCollector) return;

    try {
      console.log(`📊 [${new Date().toISOString()}] Enhanced collection starting...`);
      const startTime = Date.now();
      
      const allPriceData = await arbitrageCollector.collectPriceData(monitoredTokens);
      const collectionTime = Date.now() - startTime;

      if (allPriceData.length > 0) {
        const analysisStartTime = Date.now();
        const opportunities = arbitrageCollector.analyzeArbitrageOpportunities(allPriceData);
        const analysisTime = Date.now() - analysisStartTime;
        
        currentOpportunities = opportunities;
        
        console.log(`🎯 Enhanced analysis (${analysisTime}ms):`);
        console.log(`   💰 Total opportunities: ${opportunities.length}`);
        
        if (opportunities.length > 0) {
          const highConf = opportunities.filter(o => o.confidence === 'high');
          const mediumConf = opportunities.filter(o => o.confidence === 'medium');
          const lowConf = opportunities.filter(o => o.confidence === 'low');
          
          console.log(`   🔴 High confidence: ${highConf.length}`);
          console.log(`   🟡 Medium confidence: ${mediumConf.length}`);
          console.log(`   🟢 Low confidence: ${lowConf.length}`);

          console.log(`   🏆 Top opportunities:`);
          opportunities.slice(0, 3).forEach((opp, index) => {
            const profit = opp.profitPercentage.toFixed(2);
            const netProfit = opp.netProfit.toFixed(2);
            console.log(`      ${index + 1}. ${opp.token}: ${profit}% profit (${netProfit}) | ${opp.buyExchange} → ${opp.sellExchange}`);
          });
        }

        const totalProcessingTime = Date.now() - startTime;
        console.log(`⚡ Performance: ${totalProcessingTime}ms total (${opportunities.length} opportunities)`);

      } else {
        console.log(`❌ No price data collected - check API connections`);
      }

    } catch (error: any) {
      console.error("❌ Enhanced monitoring error:", error);
    }
  };

  console.log(`🚀 Starting enhanced monitoring loop...`);
  await runMonitoring();
  
  const intervalId = setInterval(runMonitoring, intervalMs);
  (global as any).monitoringIntervalId = intervalId;
  
  console.log(`✅ Enhanced monitoring loop established (${intervalMs/1000}s intervals)`);
}

async function toggleArbitrageMonitoring(): Promise<string> {
  if (!arbitrageCollector) return "❌ アービトラージデータ収集器が初期化されていません";

  if (monitoringActive) {
    monitoringActive = false;
    serviceStatus.arbitrageMonitoring = false;
    return "⏹️ 拡張アービトラージ監視を停止しました";
  } else {
    monitoringActive = true;
    serviceStatus.arbitrageMonitoring = true;
    startMonitoringLoop();
    return "▶️ 拡張アービトラージ監視を開始しました (22+ tokens)";
  }
}

// Chat Handler
async function handleChat(message: string, userId: string = "user") {
  try {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('監視開始') || lowerMessage.includes('start monitoring')) {
      const result = await toggleArbitrageMonitoring();
      return {
        response: result,
        timestamp: new Date().toISOString(),
        agent: "EnhancedArbitrageTrader",
        mode: "Enhanced Command Execution",
        command: "start_enhanced_monitoring",
        tokenCount: Object.keys(EnhancedPriceRanges.EXTENDED_PRICE_RANGES).length
      };
    }

    if (lowerMessage.includes('監視停止') || lowerMessage.includes('stop monitoring')) {
      if (monitoringActive) {
        monitoringActive = false;
        serviceStatus.arbitrageMonitoring = false;
        if ((global as any).monitoringIntervalId) {
          clearInterval((global as any).monitoringIntervalId);
        }
        return {
          response: "⏹️ 拡張アービトラージ監視を停止しました",
          timestamp: new Date().toISOString(),
          agent: "EnhancedArbitrageTrader",
          mode: "Enhanced Command Execution"
        };
      } else {
        return {
          response: "⚠️ 監視は既に停止しています",
          timestamp: new Date().toISOString(),
          agent: "EnhancedArbitrageTrader"
        };
      }
    }

    if (lowerMessage.includes('価格収集') || lowerMessage.includes('collect prices')) {
      if (!arbitrageCollector) {
        return {
          response: "❌ 拡張アービトラージデータ収集器が初期化されていません",
          timestamp: new Date().toISOString(),
          agent: "EnhancedArbitrageTrader"
        };
      }

      const tokens = ['ethereum', 'bitcoin', 'usd-coin', 'chainlink', 'uniswap', 'polygon'];
      const priceData = await arbitrageCollector.collectPriceData(tokens);
      const opportunities = arbitrageCollector.analyzeArbitrageOpportunities(priceData);
      currentOpportunities = opportunities;

      return {
        response: `📊 拡張価格データ収集完了\n\n📈 収集データ: ${priceData.length}件\n🎯 検出機会: ${opportunities.length}件\n🪙 対象トークン: ${tokens.length}件\n${opportunities.length > 0 ? `\n上位機会:\n${opportunities.slice(0, 3).map((opp, i) => `${i + 1}. ${opp.token}: ${opp.profitPercentage.toFixed(2)}% (${opp.confidence})`).join('\n')}` : ''}`,
        timestamp: new Date().toISOString(),
        agent: "EnhancedArbitrageTrader",
        mode: "Enhanced Data Collection"
      };
    }

    const response = await aiService.generateResponse(message);

    return {
      response,
      timestamp: new Date().toISOString(),
      agent: "EnhancedArbitrageTrader",
      mode: serviceStatus.elizaos === 'available' ? "Enhanced ElizaOS" : serviceStatus.ai ? "Enhanced AI" : "Enhanced Rule Based",
      elizaos_status: serviceStatus.elizaos,
      arbitrage_opportunities: currentOpportunities.length,
      monitoring_active: monitoringActive,
      enhanced_features: {
        total_tokens_supported: Object.keys(EnhancedPriceRanges.EXTENDED_PRICE_RANGES).length,
        filtering_enabled: config.EMERGENCY_FILTER_ENABLED,
        extended_tokens_enabled: config.ENABLE_EXTENDED_TOKENS
      }
    };
  } catch (error: any) {
    console.error("Enhanced chat error:", error);
    return {
      response: "申し訳ありませんが、処理中にエラーが発生しました。",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
  }
}

// Enhanced HTTP Server
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    if (req.url === "/" || req.url === "/dashboard") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(getWebInterfaceHTML());
      return;
    }
    
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "healthy",
        service: "enhanced-eliza-arbitrage-bot",
        version: "4.0.0-enhanced",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: {
          railway: RAILWAY_ENVIRONMENT || "local",
          service: RAILWAY_SERVICE_NAME,
          region: process.env.RAILWAY_REGION
        },
        services: serviceStatus,
        arbitrage: {
          monitoring_active: monitoringActive,
          opportunities_count: currentOpportunities.length,
          last_update: currentOpportunities.length > 0 ? new Date(currentOpportunities[0].timestamp).toISOString() : null,
          config: {
            min_profit_threshold: config.MIN_PROFIT_THRESHOLD + "%",
            max_gas_price: config.MAX_GAS_PRICE + " Gwei",
            trade_amount: "$" + config.TRADE_AMOUNT
          }
        },
        enhanced_features: {
          total_tokens_supported: Object.keys(EnhancedPriceRanges.EXTENDED_PRICE_RANGES).length,
          filtering_enabled: config.EMERGENCY_FILTER_ENABLED,
          extended_tokens_enabled: config.ENABLE_EXTENDED_TOKENS,
          enhanced_logging: config.ENHANCED_LOGGING,
          update_interval: config.UPDATE_INTERVAL + "ms"
        },
        elizaos: {
          status: serviceStatus.elizaos,
          agent_available: elizaAgent !== null,
          methods_count: elizaAvailableMethods.length
        }
      }));
    }
    else if (req.url === "/opportunities") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        opportunities: currentOpportunities,
        summary: {
          total: currentOpportunities.length,
          high_confidence: currentOpportunities.filter(o => o.confidence === 'high').length,
          medium_confidence: currentOpportunities.filter(o => o.confidence === 'medium').length,
          low_confidence: currentOpportunities.filter(o => o.confidence === 'low').length,
          potential_profit: currentOpportunities.reduce((sum, opp) => sum + opp.netProfit, 0),
          last_update: currentOpportunities.length > 0 ? new Date(currentOpportunities[0].timestamp).toISOString() : null
        },
        monitoring: {
          active: monitoringActive,
          service_status: serviceStatus.arbitrageMonitoring
        },
        enhanced_features: {
          total_tokens_monitored: Object.keys(EnhancedPriceRanges.EXTENDED_PRICE_RANGES).length,
          filtering_active: config.EMERGENCY_FILTER_ENABLED
        }
      }));
    }
    else if (req.url === "/chat") {
      if (req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          endpoint: "/chat",
          method: "POST",
          description: "Chat with Enhanced ArbitrageTrader AI agent (22+ tokens)",
          web_interface: {
            available: true,
            url: RAILWAY_SERVICE_NAME ? `https://${RAILWAY_SERVICE_NAME}/` : "http://localhost:3000/",
            features: ["Enhanced real-time dashboard", "Multi-tier token monitoring", "Advanced filtering", "Enhanced AI chat interface"]
          },
          current_status: {
            monitoring_active: monitoringActive,
            opportunities_available: currentOpportunities.length,
            elizaos_status: serviceStatus.elizaos,
            price_feeds: serviceStatus.priceFeeds,
            emergency_filter_active: config.EMERGENCY_FILTER_ENABLED,
            enhanced_features_active: config.ENABLE_EXTENDED_TOKENS
          },
          enhanced_capabilities: {
            total_tokens_supported: Object.keys(EnhancedPriceRanges.EXTENDED_PRICE_RANGES).length,
            tier_system: "5-tier priority monitoring",
            advanced_filtering: config.EMERGENCY_FILTER_ENABLED,
            dynamic_thresholds: "Token-type specific profit validation"
          }
        }));
      } else if (req.method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
          try {
            const { message, userId } = JSON.parse(body);
            if (!message) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Message is required" }));
              return;
            }

            const chatResponse = await handleChat(message, userId);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(chatResponse));
          } catch (parseError) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON" }));
          }
        });
      }
    }
    else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "Not Found",
        available_endpoints: ["/", "/dashboard", "/health", "/chat", "/opportunities"],
        web_interface: "Access enhanced dashboard at /"
      }));
    }
  } catch (error: any) {
    console.error("Enhanced server error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }));
  }
});

// Enhanced Web Interface HTML
function getWebInterfaceHTML(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ElizaOS Enhanced Arbitrage Bot - 22+ Token Monitoring</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #333; min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; color: white; margin-bottom: 30px; }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .header p { font-size: 1.2rem; opacity: 0.9; }
        .enhancement-badge { background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 20px; font-size: 0.9rem; margin-top: 10px; display: inline-block; }
        .dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .card { background: white; border-radius: 15px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); transition: transform 0.3s ease; }
        .card:hover { transform: translateY(-5px); }
        .card h3 { color: #4a5568; margin-bottom: 15px; font-size: 1.3rem; }
        .status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .status-item { display: flex; align-items: center; gap: 10px; }
        .status-indicator { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
        .status-active { background-color: #48bb78; }
        .status-inactive { background-color: #ed8936; }
        .status-error { background-color: #f56565; }
        .controls { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0; }
        .btn { padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s ease; text-decoration: none; display: inline-block; }
        .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .btn-secondary { background: #e2e8f0; color: #4a5568; }
        .btn-success { background: #48bb78; color: white; }
        .btn-danger { background: #f56565; color: white; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
        .opportunities { grid-column: 1 / -1; }
        .opportunities-list { max-height: 400px; overflow-y: auto; }
        .opportunity-item { background: #f7fafc; border-radius: 8px; padding: 15px; margin-bottom: 10px; border-left: 4px solid #667eea; }
        .opportunity-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .token-name { font-size: 1.2rem; font-weight: bold; color: #2d3748; }
        .token-type { font-size: 0.8rem; background: #e2e8f0; padding: 2px 8px; border-radius: 12px; margin-left: 8px; }
        .confidence { padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; }
        .confidence-high { background: #c6f6d5; color: #22543d; }
        .confidence-medium { background: #fefcbf; color: #744210; }
        .confidence-low { background: #fed7d7; color: #742a2a; }
        .opportunity-details { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; font-size: 0.9rem; }
        .enhanced-stats { grid-column: 1 / -1; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-top: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .stat-item { text-align: center; }
        .stat-number { font-size: 2rem; font-weight: bold; margin-bottom: 5px; }
        .stat-label { font-size: 0.9rem; opacity: 0.9; }
        .chat-section { grid-column: 1 / -1; margin-top: 30px; }
        .chat-container { background: white; border-radius: 15px; padding: 25px; height: 400px; display: flex; flex-direction: column; }
        .chat-messages { flex: 1; overflow-y: auto; margin-bottom: 20px; padding: 15px; background: #f7fafc; border-radius: 8px; }
        .message { margin-bottom: 15px; padding: 10px 15px; border-radius: 8px; }
        .message-user { background: #667eea; color: white; margin-left: 20%; }
        .message-bot { background: #e2e8f0; color: #2d3748; margin-right: 20%; }
        .chat-input-group { display: flex; gap: 10px; }
        .chat-input { flex: 1; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 1rem; }
        .chat-input:focus { outline: none; border-color: #667eea; }
        .loading { display: none; text-align: center; color: #667eea; font-weight: bold; }
        .no-opportunities { text-align: center; color: #718096; font-style: italic; padding: 40px; }
        @media (max-width: 768px) { .dashboard { grid-template-columns: 1fr; } .opportunity-details { grid-template-columns: 1fr; } .header h1 { font-size: 2rem; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 ElizaOS Enhanced Arbitrage Bot</h1>
            <p>Complete DeFi Arbitrage Monitoring System</p>
            <div class="enhancement-badge">✨ Enhanced: 22+ Token Multi-Tier Monitoring</div>
        </div>
        
        <div class="dashboard">
            <div class="card">
                <h3>📊 Enhanced System Status</h3>
                <div class="status-grid">
                    <div class="status-item"><div class="status-indicator" id="elizaos-status"></div><span>ElizaOS</span></div>
                    <div class="status-item"><div class="status-indicator" id="monitoring-status"></div><span>Monitoring</span></div>
                    <div class="status-item"><div class="status-indicator" id="pricefeeds-status"></div><span>Price Data</span></div>
                    <div class="status-item"><div class="status-indicator" id="ai-status"></div><span>AI</span></div>
                </div>
                <div class="controls">
                    <button class="btn btn-primary" onclick="startMonitoring()">🚀 Start Enhanced</button>
                    <button class="btn btn-secondary" onclick="stopMonitoring()">⏹️ Stop</button>
                    <button class="btn btn-success" onclick="collectPrices()">🔄 Collect</button>
                    <button class="btn btn-primary" onclick="refreshData()">🔄 Refresh</button>
                </div>
            </div>
            
            <div class="card">
                <h3>📈 Enhanced Opportunities</h3>
                <div style="text-align: center; margin: 20px 0;">
                    <div style="font-size: 3rem; font-weight: bold; color: #667eea;" id="total-opportunities">-</div>
                    <div style="color: #718096;">Total Found</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; text-align: center;">
                    <div><div style="font-size: 1.5rem; font-weight: bold; color: #48bb78;" id="high-confidence">-</div><div style="font-size: 0.8rem; color: #718096;">HIGH</div></div>
                    <div><div style="font-size: 1.5rem; font-weight: bold; color: #ed8936;" id="medium-confidence">-</div><div style="font-size: 0.8rem; color: #718096;">MEDIUM</div></div>
                    <div><div style="font-size: 1.5rem; font-weight: bold; color: #f56565;" id="low-confidence">-</div><div style="font-size: 0.8rem; color: #718096;">LOW</div></div>
                </div>
            </div>

            <div class="card enhanced-stats">
                <h3>🎯 Enhanced System Statistics</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-number" id="token-count">22+</div>
                        <div class="stat-label">Monitored Tokens</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number" id="tier-count">5</div>
                        <div class="stat-label">Priority Tiers</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number" id="filter-efficiency">100%</div>
                        <div class="stat-label">Filter Efficiency</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number" id="uptime">0h</div>
                        <div class="stat-label">System Uptime</div>
                    </div>
                </div>
            </div>
            
            <div class="card opportunities">
                <h3>🎯 Detected Enhanced Opportunities</h3>
                <div class="opportunities-list" id="opportunities-list">
                    <div class="no-opportunities">Loading enhanced data...</div>
                </div>
            </div>
        </div>
        
        <div class="chat-section">
            <div class="card">
                <h3>💬 Enhanced AI Chat</h3>
                <div class="chat-container">
                    <div class="chat-messages" id="chat-messages">
                        <div class="message message-bot">Hello! I'm your enhanced DeFi arbitrage specialist with 22+ token monitoring. Ask me about opportunities, supported tokens, or use commands like "start monitoring".</div>
                    </div>
                    <div style="margin-bottom: 15px; display: flex; flex-wrap: wrap; gap: 8px;">
                        <small style="width: 100%; color: #718096; margin-bottom: 5px;">Enhanced Quick Commands:</small>
                        <button class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px;" onclick="quickCommand('Show opportunities')">Opportunities</button>
                        <button class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px;" onclick="quickCommand('Enhanced status')">Enhanced Status</button>
                        <button class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px;" onclick="quickCommand('Supported tokens')">Supported Tokens</button>
                        <button class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px;" onclick="quickCommand('About risks')">Risks</button>
                    </div>
                    <div class="chat-input-group">
                        <input type="text" class="chat-input" id="chat-input" placeholder="Ask about enhanced features..." onkeypress="handleChatKeyPress(event)">
                        <button class="btn btn-primary" onclick="sendChatMessage()">Send</button>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="loading" id="loading">🔄 Processing Enhanced Data...</div>
    </div>

    <script>
        let systemStatus = {};
        let opportunities = [];
        let startTime = Date.now();
        
        document.addEventListener('DOMContentLoaded', function() {
            refreshData();
            setInterval(refreshData, 30000);
            setInterval(updateUptime, 60000);
        });

        function updateUptime() {
            const hours = Math.floor((Date.now() - startTime) / (1000 * 60 * 60));
            document.getElementById('uptime').textContent = hours + 'h';
        }
        
        async function refreshData() {
            try {
                const healthResponse = await fetch('/health');
                const healthData = await healthResponse.json();
                systemStatus = healthData;
                updateStatusIndicators(healthData);
                
                const oppResponse = await fetch('/opportunities');
                const oppData = await oppResponse.json();
                opportunities = oppData.opportunities || [];
                updateOpportunitiesSummary(oppData.summary || {});
                updateOpportunitiesList(opportunities);
                updateEnhancedStats(oppData);
            } catch (error) {
                console.error('Enhanced data refresh error:', error);
                showError('Failed to refresh enhanced data');
            }
        }

        function updateEnhancedStats(data) {
            if (data.summary && data.summary.total > 0) {
                const efficiency = ((data.summary.total - opportunities.length) / data.summary.total * 100).toFixed(0);
                document.getElementById('filter-efficiency').textContent = efficiency + '%';
            }
        }
        
        function updateStatusIndicators(data) {
            document.getElementById('elizaos-status').className = 'status-indicator ' + (data.services?.elizaos === 'available' ? 'status-active' : 'status-inactive');
            document.getElementById('monitoring-status').className = 'status-indicator ' + (data.arbitrage?.monitoring_active ? 'status-active' : 'status-inactive');
            document.getElementById('pricefeeds-status').className = 'status-indicator ' + (data.services?.priceFeeds ? 'status-active' : 'status-inactive');
            document.getElementById('ai-status').className = 'status-indicator ' + (data.services?.ai ? 'status-active' : 'status-inactive');
        }
        
        function updateOpportunitiesSummary(summary) {
            document.getElementById('total-opportunities').textContent = summary.total || 0;
            document.getElementById('high-confidence').textContent = summary.high_confidence || 0;
            document.getElementById('medium-confidence').textContent = summary.medium_confidence || 0;
            document.getElementById('low-confidence').textContent = summary.low_confidence || 0;
        }
        
        function updateOpportunitiesList(opportunities) {
            const container = document.getElementById('opportunities-list');
            
            if (opportunities.length === 0) {
                container.innerHTML = '<div class="no-opportunities">No profitable arbitrage opportunities detected.</div>';
                return;
            }
            
            container.innerHTML = opportunities.map(opp => {
                const tokenTypes = {
                    'ETH': 'major', 'BTC': 'major', 'SOL': 'major', 'ADA': 'major',
                    'USDC': 'stable', 'DAI': 'stable', 'USDT': 'stable',
                    'LINK': 'defi', 'UNI': 'defi', 'AAVE': 'defi', 'COMP': 'defi',
                    'MATIC': 'layer2', 'AVAX': 'layer1', 'ARB': 'layer2', 'OP': 'layer2'
                };
                const tokenType = tokenTypes[opp.token] || 'other';
                
                return \`
                <div class="opportunity-item">
                    <div class="opportunity-header">
                        <div>
                            <span class="token-name">\${opp.token}</span>
                            <span class="token-type">\${tokenType}</span>
                        </div>
                        <div class="confidence confidence-\${opp.confidence}">\${opp.confidence}</div>
                    </div>
                    <div class="opportunity-details">
                        <div><strong>Buy:</strong> \${opp.buyExchange}<br><strong>Price:</strong> $\${opp.buyPrice.toFixed(4)}</div>
                        <div><strong>Sell:</strong> \${opp.sellExchange}<br><strong>Price:</strong> $\${opp.sellPrice.toFixed(4)}</div>
                        <div><strong>Profit:</strong> $\${opp.netProfit.toFixed(2)}<br><strong>Rate:</strong> \${opp.profitPercentage.toFixed(2)}%</div>
                    </div>
                </div>
                \`;
            }).join('');
        }
        
        async function startMonitoring() {
            try {
                showLoading();
                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'start monitoring' })
                });
                const data = await response.json();
                addChatMessage('start enhanced monitoring', data.response, 'success');
                setTimeout(refreshData, 2000);
            } catch (error) {
                showError('Failed to start enhanced monitoring');
            } finally {
                hideLoading();
            }
        }
        
        async function stopMonitoring() {
            try {
                showLoading();
                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'stop monitoring' })
                });
                const data = await response.json();
                addChatMessage('stop monitoring', data.response, 'info');
                setTimeout(refreshData, 2000);
            } catch (error) {
                showError('Failed to stop monitoring');
            } finally {
                hideLoading();
            }
        }
        
        async function collectPrices() {
            try {
                showLoading();
                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'collect prices' })
                });
                const data = await response.json();
                addChatMessage('collect enhanced prices', data.response, 'success');
                setTimeout(refreshData, 3000);
            } catch (error) {
                showError('Failed to collect enhanced prices');
            } finally {
                hideLoading();
            }
        }
        
        async function sendChatMessage() {
            const input = document.getElementById('chat-input');
            const message = input.value.trim();
            if (!message) return;
            
            try {
                addChatMessage(message, '', 'user');
                input.value = '';
                showLoading();
                
                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: message })
                });
                
                const data = await response.json();
                addChatMessage('', data.response, 'bot');
                
                if (message.includes('monitor') || message.includes('price') || message.includes('opportunit')) {
                    setTimeout(refreshData, 2000);
                }
            } catch (error) {
                addChatMessage('', 'Error occurred. Please try again.', 'error');
            } finally {
                hideLoading();
            }
        }
        
        function quickCommand(command) {
            const commands = {
                'Show opportunities': '現在のアービトラージ機会を教えて',
                'Enhanced status': '拡張監視状況を教えて',
                'Supported tokens': 'サポートされているトークンを教えて',
                'About risks': 'アービトラージのリスクについて教えて'
            };
            document.getElementById('chat-input').value = commands[command] || command;
            sendChatMessage();
        }
        
        function handleChatKeyPress(event) {
            if (event.key === 'Enter') {
                sendChatMessage();
            }
        }
        
        function addChatMessage(userMessage, botResponse, type) {
            const chatMessages = document.getElementById('chat-messages');
            
            if (userMessage) {
                const userDiv = document.createElement('div');
                userDiv.className = 'message message-user';
                userDiv.textContent = userMessage;
                chatMessages.appendChild(userDiv);
            }
            
            if (botResponse) {
                const botDiv = document.createElement('div');
                botDiv.className = \`message message-bot \${type ? 'message-' + type : ''}\`;
                botDiv.innerHTML = botResponse.replace(/\\n/g, '<br>');
                chatMessages.appendChild(botDiv);
            }
            
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        function showLoading() { document.getElementById('loading').style.display = 'block'; }
        function hideLoading() { document.getElementById('loading').style.display = 'none'; }
        function showError(message) { addChatMessage('', \`❌ \${message}\`, 'error'); }

        updateUptime();
    </script>
</body>
</html>`;
}

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`📥 ${signal} received, shutting down enhanced system gracefully...`);
  if (monitoringActive && (global as any).monitoringIntervalId) {
    clearInterval((global as any).monitoringIntervalId);
    console.log("⏹️ Enhanced arbitrage monitoring stopped");
  }
  server.close(() => {
    console.log('🔚 Enhanced server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start enhanced server
async function start() {
  try {
    console.log("🚀 Starting Enhanced ElizaOS Arbitrage Bot...");
    await initializeServices();
    
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🌐 Enhanced server running on port ${PORT}`);
      console.log(`🎛️ Enhanced Dashboard: ${RAILWAY_SERVICE_NAME ? `https://${RAILWAY_SERVICE_NAME}/` : `http://localhost:${PORT}/`}`);
      console.log(`📊 Health API: ${RAILWAY_SERVICE_NAME ? `https://${RAILWAY_SERVICE_NAME}/health` : `http://localhost:${PORT}/health`}`);
      console.log("✅ Enhanced arbitrage system ready!");
      
      if (serviceStatus.elizaos === 'available') {
        console.log(`🎉 ElizaOS integrated with ${elizaAvailableMethods.length} methods`);
      }
      
      if (config.COINGECKO_API_KEY) {
        console.log("💰 Enhanced price feeds ready - start monitoring via dashboard!");
      } else {
        console.log("⚠️ Add COINGECKO_API_KEY for full enhanced functionality");
      }

      const tokenCount = Object.keys(EnhancedPriceRanges.EXTENDED_PRICE_RANGES).length;
      console.log(`🛡️ Enhanced Filter: ${config.EMERGENCY_FILTER_ENABLED ? 'ENABLED' : 'DISABLED'}`);
      console.log(`📊 Token Support: ${tokenCount} tokens across 5 tiers`);
      console.log(`🔍 Enhanced Validation: ${config.STRICT_VALIDATION ? 'ON' : 'OFF'}`);
      console.log(`⚡ Update Interval: ${config.UPDATE_INTERVAL}ms`);
      console.log(`🎯 Enhanced Features: ${config.ENABLE_EXTENDED_TOKENS ? 'ACTIVE' : 'INACTIVE'}`);
      console.log(`🌐 DEXScreener: ${config.DEXSCREENER_MIN_LIQUIDITY} min liquidity`);
      
      console.log(`
🎯 ENHANCED SYSTEM READY
=======================
• 22+ Token Monitoring: ETH, BTC, SOL, ADA, LINK, UNI, AAVE, MATIC, etc.
• 5-Tier Priority System: Major → Stable → DeFi → Layer1/2 → Others
• Advanced Filtering: Multi-layer validation and anomaly detection
• Dynamic Thresholds: Token-type specific profit rate validation
• Enhanced Logging: Detailed performance and quality metrics
• Real-time Dashboard: Live monitoring with enhanced statistics
• DEXScreener Integration: Complete contract addresses for all tokens

🚀 Ready for enhanced arbitrage monitoring!
      `);
    });
  } catch (error) {
    console.error("❌ Enhanced startup failed:", error);
    process.exit(1);
  }
}

start();
