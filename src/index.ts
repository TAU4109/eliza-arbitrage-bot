// ElizaOS Arbitrage Bot - Data Collection Integration
import dotenv from "dotenv";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { join } from "path";
import https from "https";

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || "3000", 10);
const RAILWAY_ENVIRONMENT = process.env.RAILWAY_ENVIRONMENT;
const RAILWAY_SERVICE_NAME = process.env.RAILWAY_SERVICE_NAME;

console.log("🚀 ElizaOS Arbitrage Bot with Data Collection...");
console.log("🌍 Environment:", process.env.NODE_ENV || "development");
console.log("🚂 Railway Environment:", RAILWAY_ENVIRONMENT || "local");

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// データ型定義
interface PriceData {
  exchange: string;
  pair: string;
  price: number;
  volume: number;
  timestamp: number;
  gasEstimate?: number;
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
  content: {
    text: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface Character {
  name: string;
  bio: string[];
  description?: string;
  personality?: string;
  knowledge?: string[];
  modelProvider?: string;
  plugins?: string[];
  settings?: { [key: string]: any };
  [key: string]: any;
}

// 環境変数設定
const config = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  INFURA_PROJECT_ID: process.env.INFURA_PROJECT_ID,
  ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY,
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
  DEXSCREENER_API: process.env.DEXSCREENER_API,
  MIN_PROFIT_THRESHOLD: parseFloat(process.env.MIN_PROFIT_THRESHOLD || "0.5"),
  MAX_GAS_PRICE: parseFloat(process.env.MAX_GAS_PRICE || "50"),
  TRADE_AMOUNT: parseFloat(process.env.TRADE_AMOUNT || "1000"),
};

// サービス状態管理
interface ServiceStatus {
  elizaos: 'available' | 'limited' | 'unavailable';
  ai: boolean;
  blockchain: boolean;
  priceFeeds: boolean;
  arbitrageMonitoring: boolean;
  deployment: 'railway' | 'local';
}

let serviceStatus: ServiceStatus = {
  elizaos: 'unavailable',
  ai: false,
  blockchain: false,
  priceFeeds: false,
  arbitrageMonitoring: false,
  deployment: RAILWAY_ENVIRONMENT ? 'railway' : 'local',
};

// グローバル変数
let elizaAgent: any = null;
let elizaAvailableMethods: string[] = [];
let arbitrageCollector: ArbitrageDataCollector | null = null;
let currentOpportunities: ArbitrageOpportunity[] = [];
let monitoringActive = false;

// デフォルトキャラクター
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
    "Gas cost optimization and profit calculation",
    "Risk assessment and confidence scoring",
    "DEX liquidity analysis and volume tracking"
  ],
  modelProvider: "anthropic"
};

// HTTP request helper
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
          'User-Agent': 'ElizaArbitrageBot/1.0',
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
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    } catch (error) {
      reject(error);
    }
  });
}

// アービトラージデータ収集クラス
class ArbitrageDataCollector {
  private config: typeof config;

  constructor(configData: typeof config) {
    this.config = configData;
  }

  // 複数の取引所から価格データを収集
  async collectPriceData(tokens: string[]): Promise<PriceData[]> {
    const priceData: PriceData[] = [];

    try {
      console.log(`📊 Collecting price data for tokens: ${tokens.join(', ')}`);

      // CoinGecko データ（CEX価格の参考）
      if (this.config.COINGECKO_API_KEY) {
        const cgPrices = await this.getCoinGeckoPrices(tokens);
        priceData.push(...cgPrices);
        console.log(`✅ CoinGecko: ${cgPrices.length} price points`);
      }

      // DEX価格データ（DEXScreener使用）
      const dexPrices = await this.getDEXPrices(tokens);
      priceData.push(...dexPrices);
      console.log(`✅ DEX Data: ${dexPrices.length} price points`);

      return priceData;
    } catch (error) {
      console.error("❌ Price data collection error:", error);
      return [];
    }
  }

  // CoinGecko APIから価格取得
  private async getCoinGeckoPrices(tokens: string[]): Promise<PriceData[]> {
    try {
      const tokenIds = tokens.join(',');
      const apiKey = this.config.COINGECKO_API_KEY;
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${tokenIds}&vs_currencies=usd&include_24hr_vol=true&x_cg_demo_api_key=${apiKey}`;
      
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

  // DEX価格データ取得（DEXScreener API使用）
  private async getDEXPrices(tokens: string[]): Promise<PriceData[]> {
    try {
      // 主要なトークンアドレス
      const tokenAddresses: { [key: string]: string } = {
        'ethereum': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        'usd-coin': '0xA0b86a33E6417b12A13D8C7e5F5D2a47D9ff0B84', // USDC
        'bitcoin': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
        'dai': '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
        'chainlink': '0x514910771AF9Ca656af840dff83E8264EcF986CA' // LINK
      };

      const priceData: PriceData[] = [];

      for (const token of tokens) {
        if (tokenAddresses[token]) {
          const address = tokenAddresses[token];
          
          try {
            const url = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
            const response = await makeHttpRequest(url);

            if (response.pairs && Array.isArray(response.pairs)) {
              // 主要なDEXからデータを抽出
              const dexFilter = ['uniswap', 'sushiswap', 'pancakeswap'];
              
              for (const pair of response.pairs.slice(0, 5)) { // 上位5ペアのみ
                if (pair.priceUsd && parseFloat(pair.priceUsd) > 0) {
                  const dexId = pair.dexId || 'unknown';
                  
                  priceData.push({
                    exchange: dexId,
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

          // API制限を考慮して少し待機
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      return priceData;
    } catch (error) {
      console.error("DEX price fetch error:", error);
      return [];
    }
  }

  // アービトラージ機会の分析
  analyzeArbitrageOpportunities(priceData: PriceData[]): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    
    // トークンごとにグループ化
    const tokenGroups: { [key: string]: PriceData[] } = {};
    
    for (const data of priceData) {
      const token = data.pair.split('/')[0].toLowerCase();
      if (!tokenGroups[token]) {
        tokenGroups[token] = [];
      }
      tokenGroups[token].push(data);
    }

    for (const [token, prices] of Object.entries(tokenGroups)) {
      if (prices.length < 2) continue;

      // 価格でソート
      const sortedPrices = prices.sort((a, b) => a.price - b.price);
      const cheapest = sortedPrices[0];
      const mostExpensive = sortedPrices[sortedPrices.length - 1];

      // 同じ取引所は除外
      if (cheapest.exchange === mostExpensive.exchange) continue;

      const priceDifference = mostExpensive.price - cheapest.price;
      const profitPercentage = (priceDifference / cheapest.price) * 100;

      // 最小利益閾値をチェック
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

  // ガス代推定（簡略化）
  private estimateGasCost(): number {
    const averageGasPrice = 30; // Gwei
    const gasLimit = 300000; // 複雑なDEX取引の推定
    const ethPrice = 2500; // USD (動的に取得することを推奨)
    
    return (averageGasPrice * gasLimit * ethPrice) / 1e9; // USD
  }

  // 機会の信頼度計算
  private calculateConfidence(
    cheapest: PriceData, 
    mostExpensive: PriceData, 
    profitPercentage: number
  ): 'low' | 'medium' | 'high' {
    let score = 0;

    // 価格差が大きいほど高スコア
    if (profitPercentage > 2) score += 2;
    else if (profitPercentage > 1) score += 1;

    // 取引量が大きいほど高スコア
    if (cheapest.volume > 100000 && mostExpensive.volume > 100000) score += 2;
    else if (cheapest.volume > 10000 && mostExpensive.volume > 10000) score += 1;

    // 有名なDEX同士なら高スコア
    const reputableExchanges = ['uniswap', 'sushiswap', 'pancakeswap', 'coingecko_average'];
    if (reputableExchanges.some(ex => cheapest.exchange.includes(ex)) && 
        reputableExchanges.some(ex => mostExpensive.exchange.includes(ex))) {
      score += 1;
    }

    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }
}

// ElizaOS 初期化
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
    
    if (!AgentRuntime) {
      throw new Error("AgentRuntime not available");
    }

    // キャラクター設定のロード
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

    // AgentRuntime インスタンス作成
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

// AI Chat Service（アービトラージデータ統合）
class AIChatService {
  async generateResponse(message: string, context?: string): Promise<string> {
    // アービトラージ関連の質問を検出
    const arbitrageContext = this.buildArbitrageContext(message);
    const fullContext = [context, arbitrageContext].filter(Boolean).join(' ');

    // ElizaOSエージェントを試行
    if (serviceStatus.elizaos === 'available' && elizaAgent) {
      try {
        return await this.useElizaAgent(message, fullContext);
      } catch (error) {
        console.log("⚠️ ElizaOS agent error, falling back:", error);
      }
    }

    // フォールバック: 直接API
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

    // 現在の機会情報を追加
    if (currentOpportunities.length > 0 && 
        (lowerMessage.includes('機会') || lowerMessage.includes('opportunity') || 
         lowerMessage.includes('利益') || lowerMessage.includes('profit'))) {
      
      const topOpps = currentOpportunities.slice(0, 3);
      context += `現在のアービトラージ機会: `;
      
      topOpps.forEach((opp, i) => {
        context += `${i + 1}. ${opp.token}: ${opp.buyExchange}($${opp.buyPrice.toFixed(4)}) → ${opp.sellExchange}($${opp.sellPrice.toFixed(4)}) 利益${opp.profitPercentage.toFixed(2)}% `;
      });
    }

    // 監視状態情報
    if (lowerMessage.includes('監視') || lowerMessage.includes('monitoring')) {
      context += `監視状態: ${monitoringActive ? 'アクティブ' : '停止中'}. `;
    }

    // サービス状態情報
    if (lowerMessage.includes('状態') || lowerMessage.includes('status')) {
      context += `価格データ: ${serviceStatus.priceFeeds ? '利用可能' : '制限中'}, アービトラージ監視: ${serviceStatus.arbitrageMonitoring ? '動作中' : '停止中'}. `;
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
          serviceStatus
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
          
          if (typeof result === 'string') {
            return result;
          } else if (result?.content?.text) {
            return result.content.text;
          } else if (result?.text) {
            return result.text;
          }
          
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

専門知識:
- リアルタイム価格監視とDEX間価格差分析
- アービトラージ機会の検出と収益性評価
- ガス代最適化と利益計算
- リスク評価と信頼度スコアリング
- 流動性分析と取引量評価

${context ? `現在のデータ: ${context}` : ''}`;

    const payload = JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: "user", content: message }]
    });

    const options = {
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
    };

    const response = await makeHttpRequest(`https://api.anthropic.com/v1/messages`);
    return response.content?.[0]?.text || "Anthropic APIからの応答を取得できませんでした。";
  }

  private generateEnhancedRuleBasedResponse(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    // アービトラージ機会の表示
    if ((lowerMessage.includes('機会') || lowerMessage.includes('opportunity')) && currentOpportunities.length > 0) {
      let response = `現在のアービトラージ機会 (${currentOpportunities.length}件):\n\n`;
      
      currentOpportunities.slice(0, 5).forEach((opp, i) => {
        response += `${i + 1}. ${opp.token}\n`;
        response += `   📊 ${opp.buyExchange} → ${opp.sellExchange}\n`;
        response += `   💰 利益: $${opp.netProfit.toFixed(2)} (${opp.profitPercentage.toFixed(2)}%)\n`;
        response += `   🎯 信頼度: ${opp.confidence.toUpperCase()}\n`;
        response += `   ⛽ ガス代: $${opp.estimatedGasCost.toFixed(2)}\n\n`;
      });
      
      return response;
    }

    // 監視状況の表示
    if (lowerMessage.includes('監視') || lowerMessage.includes('status')) {
      return `📊 アービトラージ監視状況:

🔍 監視状態: ${monitoringActive ? '✅ アクティブ' : '❌ 停止中'}
📈 価格データ: ${serviceStatus.priceFeeds ? '✅ 利用可能' : '❌ 制限中'}
🤖 ElizaOS: ${serviceStatus.elizaos === 'available' ? '✅ 統合済み' : '⚠️ 制限モード'}
💹 検出機会数: ${currentOpportunities.length}件

設定:
• 最小利益閾値: ${config.MIN_PROFIT_THRESHOLD}%
• 最大ガス価格: ${config.MAX_GAS_PRICE} Gwei
• 取引金額: $${config.TRADE_AMOUNT}`;
    }

    // 基本的なアービトラージ情報
    const responses: { [key: string]: string } = {
      "アービトラージ": `DeFiアービトラージの基本:

📊 現在の機能:
• リアルタイム価格監視
• DEX間価格差検出
• 利益計算とガス代考慮
• 信頼度評価システム

🎯 検出可能な機会:
• Uniswap vs SushiSwap
• DEX vs CEX価格差
• クロスチェーン価格差

現在の機会を確認するには「機会」と入力してください。`,

      "始め方": `アービトラージ監視の始め方:

1. 📊 価格データ監視
   • CoinGecko API統合
   • DEXScreener連携
   
2. 🔍 機会検出
   • 自動スキャニング
   • 利益計算
   
3. ⚙️ 設定調整
   • 利益閾値: ${config.MIN_PROFIT_THRESHOLD}%
   • ガス上限: ${config.MAX_GAS_PRICE} Gwei

「監視状況」で現在の状態を確認できます。`,

      "リスク": `アービトラージのリスク管理:

⚠️ 主要リスク:
• ガス代変動 (現在制限: ${config.MAX_GAS_PRICE} Gwei)
• スリッページ (大口取引時)
• MEV攻撃 (フロントランニング)
• 流動性不足

🛡️ 対策:
• 最小利益閾値設定 (${config.MIN_PROFIT_THRESHOLD}%以上)
• ガス価格上限設定
• 信頼度スコアリング
• 段階的実行`
    };

    for (const [keyword, response] of Object.entries(responses)) {
      if (lowerMessage.includes(keyword)) {
        return response;
      }
    }

    return `DeFiアービトラージボットへようこそ！

利用可能なコマンド:
• 「機会」- 現在のアービトラージ機会
• 「監視状況」- システム状態確認
• 「アービトラージ」- 基本情報
• 「リスク」- リスク管理情報
• 「始め方」- 使用方法

現在 ${currentOpportunities.length}件の機会を検出中です。`;
  }
}

// サービス
const aiService = new AIChatService();

// サービス初期化
async function initializeServices() {
  console.log("🔄 Initializing enhanced services...");

  try {
    // ElizaOS 初期化
    await initializeElizaOS();

    // アービトラージデータ収集器の初期化
    arbitrageCollector = new ArbitrageDataCollector(config);
    console.log("✅ Arbitrage data collector initialized");

    // AI Service Test
    await aiService.generateResponse("テスト");
    serviceStatus.ai = true;
    console.log("✅ AI service ready");

    // 価格フィード機能テスト
    if (config.COINGECKO_API_KEY) {
      serviceStatus.priceFeeds = true;
      console.log("✅ Price feeds ready");
    }

    console.log("📊 Enhanced services initialized:", serviceStatus);
  } catch (error) {
    console.error("⚠️ Service initialization error:", error);
  }
}

// アービトラージ監視の開始/停止
async function toggleArbitrageMonitoring(): Promise<string> {
  if (!arbitrageCollector) {
    return "❌ アービトラージデータ収集器が初期化されていません";
  }

  if (monitoringActive) {
    monitoringActive = false;
    serviceStatus.arbitrageMonitoring = false;
    return "⏹️ アービトラージ監視を停止しました";
  } else {
    monitoringActive = true;
    serviceStatus.arbitrageMonitoring = true;
    
    // 監視開始
    startMonitoringLoop();
    return "▶️ アービトラージ監視を開始しました";
  }
}

// 監視ループ
async function startMonitoringLoop() {
  const monitoredTokens = ['ethereum', 'bitcoin', 'usd-coin', 'dai', 'chainlink'];
  const intervalMs = 60000; // 1分間隔

  console.log(`🔄 Starting arbitrage monitoring for: ${monitoredTokens.join(', ')}`);
  console.log(`⏱️ Monitoring interval: ${intervalMs / 1000} seconds`);

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
          // 上位3つの機会をログ出力
          opportunities.slice(0, 3).forEach((opp, index) => {
            console.log(`${index + 1}. ${opp.token}: ${opp.buyExchange}(${opp.buyPrice.toFixed(4)}) → ${opp.sellExchange}(${opp.sellPrice.toFixed(4)}) | Profit: ${opp.profitPercentage.toFixed(2)}% | Confidence: ${opp.confidence}`);
          });

          // 高信頼度の機会をアラート
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

  // 初回実行
  await runMonitoring();

  // 定期実行
  const intervalId = setInterval(runMonitoring, intervalMs);

  // グローバルに保存（停止時に使用）
  (global as any).monitoringIntervalId = intervalId;
}

// Chat Handler（アービトラージ機能統合）
async function handleChat(message: string, userId: string = "user") {
  try {
    // 特別なコマンドをチェック
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
          mode: "Command Execution",
          command: "stop_monitoring"
        };
      } else {
        return {
          response: "⚠️ 監視は既に停止しています",
          timestamp: new Date().toISOString(),
          agent: "ArbitrageTrader",
          mode: "Command Execution"
        };
      }
    }

    // 手動データ収集コマンド
    if (lowerMessage.includes('価格収集') || lowerMessage.includes('collect prices')) {
      if (!arbitrageCollector) {
        return {
          response: "❌ アービトラージデータ収集器が初期化されていません",
          timestamp: new Date().toISOString(),
          agent: "ArbitrageTrader",
          mode: "Error"
        };
      }

      const tokens = ['ethereum', 'bitcoin', 'usd-coin'];
      const priceData = await arbitrageCollector.collectPriceData(tokens);
      const opportunities = arbitrageCollector.analyzeArbitrageOpportunities(priceData);
      currentOpportunities = opportunities;

      return {
        response: `📊 価格データ収集完了
        
📈 収集データ: ${priceData.length}件
🎯 検出機会: ${opportunities.length}件
${opportunities.length > 0 ? `\n上位機会:\n${opportunities.slice(0, 3).map((opp, i) => 
  `${i + 1}. ${opp.token}: ${opp.profitPercentage.toFixed(2)}% (${opp.confidence})`
).join('\n')}` : ''}`,
        timestamp: new Date().toISOString(),
        agent: "ArbitrageTrader",
        mode: "Data Collection",
        dataCollected: priceData.length,
        opportunitiesFound: opportunities.length
      };
    }

    // 通常のAI応答
    const response = await aiService.generateResponse(message);

    return {
      response,
      timestamp: new Date().toISOString(),
      agent: "ArbitrageTrader",
      mode: serviceStatus.elizaos === 'available' ? "ElizaOS Enhanced" : 
            serviceStatus.ai ? "AI Enhanced" : "Rule Based",
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
    if (req.url === "/" || req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "healthy",
        service: "eliza-arbitrage-bot",
        version: "2.0.0-data-collection",
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
          last_scan: currentOpportunities.length > 0 ? new Date(currentOpportunities[0].timestamp).toISOString() : null,
          configuration: {
            min_profit_threshold: config.MIN_PROFIT_THRESHOLD,
            max_gas_price: config.MAX_GAS_PRICE,
            trade_amount: config.TRADE_AMOUNT,
            monitored_tokens: ['ethereum', 'bitcoin', 'usd-coin', 'dai', 'chainlink']
          },
          api_status: {
            coingecko: config.COINGECKO_API_KEY ? "configured" : "missing",
            dexscreener: "available",
            price_feeds: serviceStatus.priceFeeds ? "active" : "inactive"
          }
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
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          RAILWAY_ENVIRONMENT,
          RAILWAY_SERVICE_NAME,
          PORT
        },
        api_keys: {
          ANTHROPIC_API_KEY: config.ANTHROPIC_API_KEY ? "✅ Configured" : "❌ Missing",
          OPENAI_API_KEY: config.OPENAI_API_KEY ? "✅ Configured" : "❌ Missing",
          COINGECKO_API_KEY: config.COINGECKO_API_KEY ? "✅ Configured" : "❌ Missing",
          ALCHEMY_API_KEY: config.ALCHEMY_API_KEY ? "✅ Configured" : "❌ Missing"
        },
        arbitrage_config: {
          MIN_PROFIT_THRESHOLD: config.MIN_PROFIT_THRESHOLD + "%",
          MAX_GAS_PRICE: config.MAX_GAS_PRICE + " Gwei",
          TRADE_AMOUNT: "$" + config.TRADE_AMOUNT
        },
        services: serviceStatus,
        recommendations: [
          !config.ANTHROPIC_API_KEY && !config.OPENAI_API_KEY && "Add AI API key for enhanced chat",
          !config.COINGECKO_API_KEY && "Add CoinGecko API key for price data",
          !config.ALCHEMY_API_KEY && "Add Alchemy API key for blockchain data"
        ].filter(Boolean)
      }));
    }
    else if (req.url === "/chat") {
      if (req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          endpoint: "/chat",
          method: "POST",
          description: "Chat with the Enhanced ArbitrageTrader AI agent with real-time data",
          usage: {
            url: "https://eliza-arbitrage-bot-production.up.railway.app/chat",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body_format: {
              message: "string (required)",
              userId: "string (optional, defaults to 'user')"
            }
          },
          special_commands: [
            {
              command: "監視開始 / start monitoring",
              description: "Start real-time arbitrage monitoring"
            },
            {
              command: "監視停止 / stop monitoring", 
              description: "Stop arbitrage monitoring"
            },
            {
              command: "価格収集 / collect prices",
              description: "Manual price data collection"
            },
            {
              command: "機会 / opportunities",
              description: "Show current arbitrage opportunities"
            },
            {
              command: "監視状況 / status",
              description: "Show monitoring status"
            }
          ],
          examples: [
            {
              request: { message: "監視開始" },
              description: "Start arbitrage monitoring"
            },
            {
              request: { message: "現在のアービトラージ機会を教えて" },
              description: "Ask about current opportunities"
            },
            {
              request: { message: "価格収集" },
              description: "Manual data collection"
            }
          ],
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
      } else {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ 
          error: "Method Not Allowed", 
          allowed_methods: ["GET", "POST"]
        }));
      }
    }
    else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "Not Found",
        available_endpoints: ["/", "/health", "/chat", "/arbitrage", "/opportunities", "/config"]
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
  
  // 監視停止
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
    console.log("🚀 Starting Enhanced Arbitrage Bot with Data Collection...");
    
    await initializeServices();
    
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`🔗 Health: http://localhost:${PORT}/health`);
      console.log(`📊 Arbitrage: http://localhost:${PORT}/arbitrage`);
      console.log(`🎯 Opportunities: http://localhost:${PORT}/opportunities`);
      console.log(`💬 Chat: http://localhost:${PORT}/chat`);
      console.log("✅ Enhanced arbitrage bot ready!");
      
      if (serviceStatus.elizaos === 'available') {
        console.log(`🎉 ElizaOS integrated with ${elizaAvailableMethods.length} methods`);
      }
      
      if (config.COINGECKO_API_KEY) {
        console.log("💰 Price feeds configured - ready for monitoring");
      } else {
        console.log("⚠️ Add COINGECKO_API_KEY for price monitoring");
      }
    });
    
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
}

start();
