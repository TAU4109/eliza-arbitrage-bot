// ElizaOS Arbitrage Bot - Complete Single File Version
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

console.log("🚀 ElizaOS Complete Arbitrage Bot Starting...");
console.log("🌍 Environment:", process.env.NODE_ENV || "development");
console.log("🚂 Railway:", RAILWAY_ENVIRONMENT || "local");

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

// Config
const config = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
  MIN_PROFIT_THRESHOLD: parseFloat(process.env.MIN_PROFIT_THRESHOLD || "0.5"),
  MAX_GAS_PRICE: parseFloat(process.env.MAX_GAS_PRICE || "50"),
  TRADE_AMOUNT: parseFloat(process.env.TRADE_AMOUNT || "1000"),
};

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
  name: "ArbitrageTrader",
  bio: [
    "AI-powered DeFi arbitrage specialist with real-time market analysis",
    "Expert in cross-DEX price monitoring and opportunity detection"
  ],
  description: "Advanced DeFi arbitrage trading specialist with live data integration",
  personality: "analytical, data-driven, risk-aware, profit-focused",
  knowledge: [
    "Real-time price monitoring across multiple DEXs",
    "Arbitrage opportunity detection and analysis",
    "Gas cost optimization and profit calculation"
  ],
  modelProvider: "anthropic"
};

// HTTP helper
function makeHttpRequest(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: { 'User-Agent': 'ElizaArbitrageBot/1.0', 'Accept': 'application/json' }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (error) { resolve(data); }
        });
      });

      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
      req.end();
    } catch (error) { reject(error); }
  });
}

// Arbitrage Data Collector
class ArbitrageDataCollector {
  constructor(private config: typeof config) {}

  async collectPriceData(tokens: string[]): Promise<PriceData[]> {
    const priceData: PriceData[] = [];
    try {
      console.log(`📊 Collecting price data for tokens: ${tokens.join(', ')}`);

      if (this.config.COINGECKO_API_KEY) {
        const cgPrices = await this.getCoinGeckoPrices(tokens);
        priceData.push(...cgPrices);
        console.log(`✅ CoinGecko: ${cgPrices.length} price points`);
      }

      const dexPrices = await this.getDEXPrices(tokens);
      priceData.push(...dexPrices);
      console.log(`✅ DEX Data: ${dexPrices.length} price points`);

      return priceData;
    } catch (error) {
      console.error("❌ Price data collection error:", error);
      return [];
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
      const tokenAddresses: { [key: string]: string } = {
        'ethereum': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        'usd-coin': '0xA0b86a33E6417b12A13D8C7e5F5D2a47D9ff0B84',
        'bitcoin': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        'dai': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        'chainlink': '0x514910771AF9Ca656af840dff83E8264EcF986CA'
      };

      const priceData: PriceData[] = [];

      for (const token of tokens) {
        if (tokenAddresses[token]) {
          const address = tokenAddresses[token];
          try {
            const url = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
            const response = await makeHttpRequest(url);

            if (response.pairs && Array.isArray(response.pairs)) {
              for (const pair of response.pairs.slice(0, 5)) {
                if (pair.priceUsd && parseFloat(pair.priceUsd) > 0) {
                  priceData.push({
                    exchange: pair.dexId || 'unknown',
                    pair: `${pair.baseToken?.symbol || token}/${pair.quoteToken?.symbol || 'USD'}`,
                    price: parseFloat(pair.priceUsd),
                    volume: parseFloat(pair.volume?.h24 || '0'),
                    timestamp: Date.now()
                  });
                }
              }
            }
          } catch (tokenError) {
            console.error(`Error fetching DEX data for ${token}:`, tokenError);
          }
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      return priceData;
    } catch (error) {
      console.error("DEX price fetch error:", error);
      return [];
    }
  }

  analyzeArbitrageOpportunities(priceData: PriceData[]): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    const tokenGroups: { [key: string]: PriceData[] } = {};
    
    for (const data of priceData) {
      const token = data.pair.split('/')[0].toLowerCase();
      if (!tokenGroups[token]) tokenGroups[token] = [];
      tokenGroups[token].push(data);
    }

    for (const [token, prices] of Object.entries(tokenGroups)) {
      if (prices.length < 2) continue;

      const sortedPrices = prices.sort((a, b) => a.price - b.price);
      const cheapest = sortedPrices[0];
      const mostExpensive = sortedPrices[sortedPrices.length - 1];

      if (cheapest.exchange === mostExpensive.exchange) continue;

      const priceDifference = mostExpensive.price - cheapest.price;
      const profitPercentage = (priceDifference / cheapest.price) * 100;

      if (profitPercentage >= this.config.MIN_PROFIT_THRESHOLD) {
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

    return opportunities.sort((a, b) => b.netProfit - a.netProfit);
  }

  private estimateGasCost(): number {
    const averageGasPrice = 30; // Gwei
    const gasLimit = 300000;
    const ethPrice = 2500;
    return (averageGasPrice * gasLimit * ethPrice) / 1e9;
  }

  private calculateConfidence(cheapest: PriceData, mostExpensive: PriceData, profitPercentage: number): 'low' | 'medium' | 'high' {
    let score = 0;
    if (profitPercentage > 2) score += 2;
    else if (profitPercentage > 1) score += 1;
    if (cheapest.volume > 100000 && mostExpensive.volume > 100000) score += 2;
    else if (cheapest.volume > 10000 && mostExpensive.volume > 10000) score += 1;
    
    const reputableExchanges = ['uniswap', 'sushiswap', 'pancakeswap', 'coingecko_average'];
    if (reputableExchanges.some(ex => cheapest.exchange.includes(ex)) && 
        reputableExchanges.some(ex => mostExpensive.exchange.includes(ex))) score += 1;

    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }
}

// ElizaOS initialization
async function initializeElizaOS(): Promise<boolean> {
  try {
    console.log("🔄 Starting ElizaOS initialization...");
    
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
      console.log("⚠️ Using default character configuration");
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
      console.log("✅ ElizaOS initialization completed successfully");
      return true;
    } catch (runtimeError) {
      console.log("⚠️ AgentRuntime creation failed:", runtimeError);
      serviceStatus.elizaos = 'limited';
      return false;
    }
  } catch (error) {
    console.log("❌ ElizaOS initialization failed:", error instanceof Error ? error.message : String(error));
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
      context += `現在のアービトラージ機会: `;
      topOpps.forEach((opp, i) => {
        context += `${i + 1}. ${opp.token}: ${opp.buyExchange}($${opp.buyPrice.toFixed(4)}) → ${opp.sellExchange}($${opp.sellPrice.toFixed(4)}) 利益${opp.profitPercentage.toFixed(2)}% `;
      });
    }

    if (lowerMessage.includes('監視') || lowerMessage.includes('monitoring')) {
      context += `監視状態: ${monitoringActive ? 'アクティブ' : '停止中'}. `;
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
        arbitrageData: { opportunities: currentOpportunities.slice(0, 5), monitoringActive, serviceStatus }
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
リアルタイムの価格データとアービトラージ機会を分析し、実用的なアドバイスを提供します。
${context ? `現在のデータ: ${context}` : ''}`;

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
    
    if ((lowerMessage.includes('機会') || lowerMessage.includes('opportunity')) && currentOpportunities.length > 0) {
      let response = `現在のアービトラージ機会 (${currentOpportunities.length}件):\n\n`;
      currentOpportunities.slice(0, 5).forEach((opp, i) => {
        response += `${i + 1}. ${opp.token}\n`;
        response += `   📊 ${opp.buyExchange} → ${opp.sellExchange}\n`;
        response += `   💰 利益: $${opp.netProfit.toFixed(2)} (${opp.profitPercentage.toFixed(2)}%)\n`;
        response += `   🎯 信頼度: ${opp.confidence.toUpperCase()}\n\n`;
      });
      return response;
    }

    if (lowerMessage.includes('監視') || lowerMessage.includes('status')) {
      return `📊 アービトラージ監視状況:

🔍 監視状態: ${monitoringActive ? '✅ アクティブ' : '❌ 停止中'}
📈 価格データ: ${serviceStatus.priceFeeds ? '✅ 利用可能' : '❌ 制限中'}
🤖 ElizaOS: ${serviceStatus.elizaos === 'available' ? '✅ 統合済み' : '⚠️ 制限モード'}
💹 検出機会数: ${currentOpportunities.length}件`;
    }

    const responses: { [key: string]: string } = {
      "アービトラージ": `DeFiアービトラージの基本:
• リアルタイム価格監視
• DEX間価格差検出
• 利益計算とガス代考慮
• 信頼度評価システム`,
      "始め方": "1. 価格データ監視 2. 機会検出 3. 設定調整",
      "リスク": "主要リスク: ガス代変動、スリッページ、MEV攻撃、流動性不足"
    };

    for (const [keyword, response] of Object.entries(responses)) {
      if (lowerMessage.includes(keyword)) return response;
    }

    return `DeFiアービトラージボットへようこそ！現在 ${currentOpportunities.length}件の機会を検出中です。`;
  }
}

// Services
const aiService = new AIChatService();

// Service initialization
async function initializeServices() {
  console.log("🔄 Initializing services...");

  try {
    await initializeElizaOS();
    arbitrageCollector = new ArbitrageDataCollector(config);
    console.log("✅ Arbitrage data collector initialized");

    await aiService.generateResponse("テスト");
    serviceStatus.ai = true;
    console.log("✅ AI service ready");

    if (config.COINGECKO_API_KEY) {
      serviceStatus.priceFeeds = true;
      console.log("✅ Price feeds ready");
    }

    console.log("📊 Services initialized:", serviceStatus);
  } catch (error) {
    console.error("⚠️ Service initialization error:", error);
  }
}

// Monitoring
async function startMonitoringLoop() {
  const monitoredTokens = ['ethereum', 'bitcoin', 'usd-coin', 'dai', 'chainlink'];
  const intervalMs = 60000;

  console.log(`🔄 Starting arbitrage monitoring for: ${monitoredTokens.join(', ')}`);

  const runMonitoring = async () => {
    if (!monitoringActive || !arbitrageCollector) return;

    try {
      console.log(`📊 [${new Date().toISOString()}] Collecting price data...`);
      const priceData = await arbitrageCollector.collectPriceData(monitoredTokens);
      console.log(`📈 Collected ${priceData.length} price points`);

      if (priceData.length > 0) {
        const opportunities = arbitrageCollector.analyzeArbitrageOpportunities(priceData);
        currentOpportunities = opportunities;
        console.log(`🎯 Found ${opportunities.length} arbitrage opportunities`);
        
        if (opportunities.length > 0) {
          opportunities.slice(0, 3).forEach((opp, index) => {
            console.log(`${index + 1}. ${opp.token}: ${opp.buyExchange}($${opp.buyPrice.toFixed(4)}) → ${opp.sellExchange}($${opp.sellPrice.toFixed(4)}) | Profit: ${opp.profitPercentage.toFixed(2)}% | Confidence: ${opp.confidence}`);
          });

          const highConfidenceOpps = opportunities.filter(o => o.confidence === 'high');
          if (highConfidenceOpps.length > 0) {
            console.log(`🚨 HIGH CONFIDENCE OPPORTUNITIES: ${highConfidenceOpps.length}`);
          }
        }
      }
    } catch (error) {
      console.error("❌ Monitoring error:", error);
    }
  };

  await runMonitoring();
  const intervalId = setInterval(runMonitoring, intervalMs);
  (global as any).monitoringIntervalId = intervalId;
}

async function toggleArbitrageMonitoring(): Promise<string> {
  if (!arbitrageCollector) return "❌ アービトラージデータ収集器が初期化されていません";

  if (monitoringActive) {
    monitoringActive = false;
    serviceStatus.arbitrageMonitoring = false;
    return "⏹️ アービトラージ監視を停止しました";
  } else {
    monitoringActive = true;
    serviceStatus.arbitrageMonitoring = true;
    startMonitoringLoop();
    return "▶️ アービトラージ監視を開始しました";
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
        agent: "ArbitrageTrader",
        mode: "Command Execution",
        command: "start_monitoring"
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
          response: "⏹️ アービトラージ監視を停止しました",
          timestamp: new Date().toISOString(),
          agent: "ArbitrageTrader",
          mode: "Command Execution"
        };
      } else {
        return {
          response: "⚠️ 監視は既に停止しています",
          timestamp: new Date().toISOString(),
          agent: "ArbitrageTrader"
        };
      }
    }

    if (lowerMessage.includes('価格収集') || lowerMessage.includes('collect prices')) {
      if (!arbitrageCollector) {
        return {
          response: "❌ アービトラージデータ収集器が初期化されていません",
          timestamp: new Date().toISOString(),
          agent: "ArbitrageTrader"
        };
      }

      const tokens = ['ethereum', 'bitcoin', 'usd-coin'];
      const priceData = await arbitrageCollector.collectPriceData(tokens);
      const opportunities = arbitrageCollector.analyzeArbitrageOpportunities(priceData);
      currentOpportunities = opportunities;

      return {
        response: `📊 価格データ収集完了\n\n📈 収集データ: ${priceData.length}件\n🎯 検出機会: ${opportunities.length}件\n${opportunities.length > 0 ? `\n上位機会:\n${opportunities.slice(0, 3).map((opp, i) => `${i + 1}. ${opp.token}: ${opp.profitPercentage.toFixed(2)}% (${opp.confidence})`).join('\n')}` : ''}`,
        timestamp: new Date().toISOString(),
        agent: "ArbitrageTrader",
        mode: "Data Collection"
      };
    }

    const response = await aiService.generateResponse(message);

    return {
      response,
      timestamp: new Date().toISOString(),
      agent: "ArbitrageTrader",
      mode: serviceStatus.elizaos === 'available' ? "ElizaOS Enhanced" : serviceStatus.ai ? "AI Enhanced" : "Rule Based",
      elizaos_status: serviceStatus.elizaos,
      arbitrage_opportunities: currentOpportunities.length,
      monitoring_active: monitoringActive
    };
  } catch (error) {
    console.error("Chat error:", error);
    return {
      response: "申し訳ありませんが、処理中にエラーが発生しました。",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
  }
}

// Web Interface HTML
function getWebInterfaceHTML(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ElizaOS Arbitrage Bot - Complete Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #333; min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; color: white; margin-bottom: 30px; }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .header p { font-size: 1.2rem; opacity: 0.9; }
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
        .confidence { padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; }
        .confidence-high { background: #c6f6d5; color: #22543d; }
        .confidence-medium { background: #fefcbf; color: #744210; }
        .confidence-low { background: #fed7d7; color: #742a2a; }
        .opportunity-details { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; font-size: 0.9rem; }
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
            <h1>🤖 ElizaOS Arbitrage Bot</h1>
            <p>Complete DeFi Arbitrage Monitoring System</p>
        </div>
        
        <div class="dashboard">
            <div class="card">
                <h3>📊 System Status</h3>
                <div class="status-grid">
                    <div class="status-item"><div class="status-indicator" id="elizaos-status"></div><span>ElizaOS</span></div>
                    <div class="status-item"><div class="status-indicator" id="monitoring-status"></div><span>Monitoring</span></div>
                    <div class="status-item"><div class="status-indicator" id="pricefeeds-status"></div><span>Price Data</span></div>
                    <div class="status-item"><div class="status-indicator" id="ai-status"></div><span>AI</span></div>
                </div>
                <div class="controls">
                    <button class="btn btn-primary" onclick="startMonitoring()">📈 Start</button>
                    <button class="btn btn-secondary" onclick="stopMonitoring()">⏹️ Stop</button>
                    <button class="btn btn-success" onclick="collectPrices()">🔄 Collect</button>
                    <button class="btn btn-primary" onclick="refreshData()">🔄 Refresh</button>
                </div>
            </div>
            
            <div class="card">
                <h3>📈 Opportunities</h3>
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
            
            <div class="card opportunities">
                <h3>🎯 Detected Opportunities</h3>
                <div class="opportunities-list" id="opportunities-list">
                    <div class="no-opportunities">Loading data...</div>
                </div>
            </div>
        </div>
        
        <div class="chat-section">
            <div class="card">
                <h3>💬 AI Chat</h3>
                <div class="chat-container">
                    <div class="chat-messages" id="chat-messages">
                        <div class="message message-bot">Hello! I'm your DeFi arbitrage specialist. Ask me anything about opportunities, risks, or use commands like "start monitoring".</div>
                    </div>
                    <div style="margin-bottom: 15px; display: flex; flex-wrap: wrap; gap: 8px;">
                        <small style="width: 100%; color: #718096; margin-bottom: 5px;">Quick Commands:</small>
                        <button class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px;" onclick="quickCommand('Show opportunities')">Opportunities</button>
                        <button class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px;" onclick="quickCommand('System status')">Status</button>
                        <button class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px;" onclick="quickCommand('About risks')">Risks</button>
                        <button class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px;" onclick="quickCommand('How to start')">Start Guide</button>
                    </div>
                    <div class="chat-input-group">
                        <input type="text" class="chat-input" id="chat-input" placeholder="Type your message..." onkeypress="handleChatKeyPress(event)">
                        <button class="btn btn-primary" onclick="sendChatMessage()">Send</button>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="loading" id="loading">🔄 Processing...</div>
    </div>

    <script>
        let systemStatus = {};
        let opportunities = [];
        
        document.addEventListener('DOMContentLoaded', function() {
            refreshData();
            setInterval(refreshData, 30000);
        });
        
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
            } catch (error) {
                console.error('Data refresh error:', error);
                showError('Failed to refresh data');
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
            
            container.innerHTML = opportunities.map(opp => \`
                <div class="opportunity-item">
                    <div class="opportunity-header">
                        <div class="token-name">\${opp.token}</div>
                        <div class="confidence confidence-\${opp.confidence}">\${opp.confidence}</div>
                    </div>
                    <div class="opportunity-details">
                        <div><strong>Buy:</strong> \${opp.buyExchange}<br><strong>Price:</strong> $\${opp.buyPrice.toFixed(4)}</div>
                        <div><strong>Sell:</strong> \${opp.sellExchange}<br><strong>Price:</strong> $\${opp.sellPrice.toFixed(4)}</div>
                        <div><strong>Profit:</strong> $\${opp.netProfit.toFixed(2)}<br><strong>Rate:</strong> \${opp.profitPercentage.toFixed(2)}%</div>
                    </div>
                </div>
            \`).join('');
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
                addChatMessage('start monitoring', data.response, 'success');
                setTimeout(refreshData, 2000);
            } catch (error) {
                showError('Failed to start monitoring');
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
                addChatMessage('collect prices', data.response, 'success');
                setTimeout(refreshData, 3000);
            } catch (error) {
                showError('Failed to collect prices');
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
                'System status': '監視状況を教えて',
                'About risks': 'アービトラージのリスクについて教えて',
                'How to start': 'アービトラージの始め方を教えて'
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
    </script>
</body>
</html>`;
}

// HTTP Server
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
        service: "eliza-arbitrage-bot",
        version: "3.0.0-complete",
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
        elizaos: {
          status: serviceStatus.elizaos,
          agent_available: elizaAgent !== null,
          methods_count: elizaAvailableMethods.length
        }
      }));
    }
    else if (req.url === "/arbitrage") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        arbitrage_system: {
          monitoring_active: monitoringActive,
          opportunities: currentOpportunities,
          total_opportunities: currentOpportunities.length,
          high_confidence_count: currentOpportunities.filter(o => o.confidence === 'high').length,
          medium_confidence_count: currentOpportunities.filter(o => o.confidence === 'medium').length,
          low_confidence_count: currentOpportunities.filter(o => o.confidence === 'low').length,
          last_scan: currentOpportunities.length > 0 ? new Date(currentOpportunities[0].timestamp).toISOString() : null
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
        }
      }));
    }
    else if (req.url === "/config") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        api_keys: {
          ANTHROPIC_API_KEY: config.ANTHROPIC_API_KEY ? "✅ Configured" : "❌ Missing",
          OPENAI_API_KEY: config.OPENAI_API_KEY ? "✅ Configured" : "❌ Missing",
          COINGECKO_API_KEY: config.COINGECKO_API_KEY ? "✅ Configured" : "❌ Missing"
        },
        arbitrage_config: {
          MIN_PROFIT_THRESHOLD: config.MIN_PROFIT_THRESHOLD + "%",
          MAX_GAS_PRICE: config.MAX_GAS_PRICE + " Gwei",
          TRADE_AMOUNT: "$" + config.TRADE_AMOUNT
        },
        services: serviceStatus
      }));
    }
    else if (req.url === "/chat") {
      if (req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          endpoint: "/chat",
          method: "POST",
          description: "Chat with Enhanced ArbitrageTrader AI agent",
          web_interface: {
            available: true,
            url: RAILWAY_SERVICE_NAME ? `https://${RAILWAY_SERVICE_NAME}/` : "http://localhost:3000/",
            features: ["Real-time dashboard", "Interactive controls", "AI chat interface"]
          },
          current_status: {
            monitoring_active: monitoringActive,
            opportunities_available: currentOpportunities.length,
            elizaos_status: serviceStatus.elizaos,
            price_feeds: serviceStatus.priceFeeds
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
        available_endpoints: ["/", "/dashboard", "/health", "/chat", "/arbitrage", "/opportunities", "/config"],
        web_interface: "Access dashboard at /"
      }));
    }
  } catch (error) {
    console.error("Server error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }));
  }
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`📥 ${signal} received, shutting down gracefully...`);
  if (monitoringActive && (global as any).monitoringIntervalId) {
    clearInterval((global as any).monitoringIntervalId);
    console.log("⏹️ Arbitrage monitoring stopped");
  }
  server.close(() => {
    console.log('🔚 Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
async function start() {
  try {
    console.log("🚀 Starting Complete ElizaOS Arbitrage Bot...");
    await initializeServices();
    
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`🎛️ Dashboard: https://${RAILWAY_SERVICE_NAME || 'localhost'}/`);
      console.log(`📊 API: https://${RAILWAY_SERVICE_NAME || 'localhost'}/health`);
      console.log("✅ Complete arbitrage system ready!");
      
      if (serviceStatus.elizaos === 'available') {
        console.log(`🎉 ElizaOS integrated with ${elizaAvailableMethods.length} methods`);
      }
      
      if (config.COINGECKO_API_KEY) {
        console.log("💰 Price feeds ready - start monitoring via dashboard!");
      } else {
        console.log("⚠️ Add COINGECKO_API_KEY for full functionality");
      }
    });
  } catch (error) {
    console.error("❌ Startup failed:", error);
    process.exit(1);
  }
}

start();
