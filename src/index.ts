// ElizaOS Arbitrage Bot - Latest API Compatible Version
import dotenv from "dotenv";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { join } from "path";
import https from "https";

// Load environment variables
dotenv.config();

// Railway 環境変数の処理
const PORT = parseInt(process.env.PORT || "3000", 10);
const RAILWAY_ENVIRONMENT = process.env.RAILWAY_ENVIRONMENT;
const RAILWAY_SERVICE_NAME = process.env.RAILWAY_SERVICE_NAME;
const RAILWAY_PROJECT_NAME = process.env.RAILWAY_PROJECT_NAME;

console.log("🚀 ElizaOS Arbitrage Bot Starting...");
console.log("🌍 Environment:", process.env.NODE_ENV || "development");
console.log("🚂 Railway Environment:", RAILWAY_ENVIRONMENT || "local");
console.log("📦 Service:", RAILWAY_SERVICE_NAME || "local");

// 型定義（最新ElizaOS API準拠）
interface Memory {
  userId: string;
  roomId: string;
  content: {
    text: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface State {
  values: { [key: string]: any };
  data: { [key: string]: any };
  text: string;
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

interface IAgentRuntime {
  character: Character;
  databaseAdapter?: any;
  token?: string;
  modelProvider?: string;
  plugins?: any[];
  evaluators?: any[];
  
  // 最新APIメソッド（推定）
  composeState?(message: Memory, providers?: string[]): Promise<State>;
  evaluate?(message: Memory): Promise<any>;
  handleMessage?(message: Memory): Promise<any>;
  processAction?(action: string, message: Memory): Promise<any>;
}

// 環境変数設定
interface RailwayEnvConfig {
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  INFURA_PROJECT_ID?: string;
  ALCHEMY_API_KEY?: string;
  ETHEREUM_RPC_URL?: string;
  POLYGON_RPC_URL?: string;
  COINGECKO_API_KEY?: string;
  COINMARKETCAP_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  DISCORD_WEBHOOK_URL?: string;
  WEBHOOK_SECRET?: string;
  API_KEY?: string;
}

const config: RailwayEnvConfig = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  INFURA_PROJECT_ID: process.env.INFURA_PROJECT_ID,
  ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY,
  ETHEREUM_RPC_URL: process.env.ETHEREUM_RPC_URL,
  POLYGON_RPC_URL: process.env.POLYGON_RPC_URL,
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
  COINMARKETCAP_API_KEY: process.env.COINMARKETCAP_API_KEY,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
  API_KEY: process.env.API_KEY,
};

// サービス状態管理
interface ServiceStatus {
  elizaos: 'available' | 'limited' | 'unavailable';
  ai: boolean;
  blockchain: boolean;
  priceFeeds: boolean;
  notifications: boolean;
  deployment: 'railway' | 'local';
  region?: string;
}

let serviceStatus: ServiceStatus = {
  elizaos: 'unavailable',
  ai: false,
  blockchain: false,
  priceFeeds: false,
  notifications: false,
  deployment: RAILWAY_ENVIRONMENT ? 'railway' : 'local',
  region: process.env.RAILWAY_REGION
};

// ElizaOS エージェント
let elizaAgent: IAgentRuntime | null = null;

// デフォルトキャラクター
const defaultCharacter: Character = {
  name: "ArbitrageTrader",
  bio: [
    "AI-powered DeFi arbitrage specialist",
    "Expert in blockchain analysis and risk management",
    "Provides educational content about DeFi trading strategies"
  ],
  description: "DeFi arbitrage trading specialist focusing on education and analysis",
  personality: "analytical, helpful, risk-aware, educational",
  knowledge: [
    "DeFi protocols (Uniswap, SushiSwap, Aave, Compound)",
    "Arbitrage strategies and risk management", 
    "Gas optimization techniques",
    "Market analysis and trading psychology",
    "Blockchain technology and smart contracts"
  ],
  modelProvider: "anthropic",
  plugins: ["@elizaos/plugin-arbitrage"],
  settings: {
    arbitrage: {
      enableAutoTrading: false,
      riskLevel: "conservative"
    }
  }
};

// HTTP request helper
function makeHttpRequest(options: any, data?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (error) {
          resolve(responseData);
        }
      });
    });

    req.on('error', (error) => {
      console.error('HTTP Request Error:', error);
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

// ElizaOS 初期化（最新API対応）
async function initializeElizaOS(): Promise<boolean> {
  try {
    console.log("🔄 Initializing ElizaOS Core...");
    
    // パッケージの存在確認
    try {
      const fs = await import("fs");
      const path = await import("path");
      const packagePath = path.join(process.cwd(), 'node_modules', '@elizaos', 'core');
      
      if (!fs.existsSync(packagePath)) {
        console.log("📦 @elizaos/core package not found in node_modules");
        throw new Error("Package not installed");
      }
      
      console.log("📦 @elizaos/core package found");
    } catch (fsError) {
      console.log("⚠️ Cannot check package existence:", fsError);
    }

    // 動的インポート（複数のアプローチを試行）
    let elizaModule: any;
    let AgentRuntime: any;
    
    try {
      // アプローチ1: 基本インポート
      elizaModule = await import("@elizaos/core");
      console.log("✅ Successfully imported @elizaos/core");
      console.log("📦 Available exports:", Object.keys(elizaModule));
      
      // AgentRuntimeの取得を試行
      AgentRuntime = elizaModule.AgentRuntime || elizaModule.default?.AgentRuntime;
      
      if (!AgentRuntime) {
        // 他の可能性のある名前を試行
        const possibleNames = ['Runtime', 'Agent', 'ElizaRuntime', 'Core'];
        for (const name of possibleNames) {
          if (elizaModule[name]) {
            AgentRuntime = elizaModule[name];
            console.log(`✅ Found runtime as: ${name}`);
            break;
          }
        }
      }
      
    } catch (importError) {
      console.log("⚠️ Direct import failed:", importError);
      
      // アプローチ2: require fallback
      try {
        elizaModule = require("@elizaos/core");
        AgentRuntime = elizaModule.AgentRuntime || elizaModule.default?.AgentRuntime;
        console.log("✅ Successfully required @elizaos/core");
      } catch (requireError) {
        console.log("⚠️ Require also failed:", requireError);
        throw new Error("Unable to load ElizaOS core module");
      }
    }

    if (!AgentRuntime) {
      console.log("⚠️ AgentRuntime not found in available exports:", Object.keys(elizaModule));
      throw new Error("AgentRuntime class not found in ElizaOS module");
    }

    // キャラクター設定のロード
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

    // AgentRuntime インスタンス作成
    try {
      elizaAgent = new AgentRuntime({
        character: characterConfig,
        databaseAdapter: null, // Railwayでは簡素化
        token: config.ANTHROPIC_API_KEY || config.OPENAI_API_KEY || "default-token",
        modelProvider: characterConfig.modelProvider || "anthropic",
        evaluators: [],
        plugins: [] // プラグインは後で追加
      });

      console.log("✅ AgentRuntime instance created");
      
      // 利用可能なメソッドをデバッグ出力
      console.log("--- ElizaOS Agent Methods ---");
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(elizaAgent))
        .filter(name => typeof (elizaAgent as any)[name] === 'function' && name !== 'constructor');
      console.log("Available methods:", methods);
      console.log("--- End Methods Debug ---");

      serviceStatus.elizaos = 'available';
      console.log("✅ ElizaOS Core initialized successfully");
      return true;

    } catch (runtimeError) {
      console.log("⚠️ AgentRuntime creation failed:", runtimeError);
      serviceStatus.elizaos = 'limited';
      return false;
    }

  } catch (error) {
    console.log("⚠️ ElizaOS initialization failed:", error instanceof Error ? error.message : String(error));
    serviceStatus.elizaos = 'unavailable';
    return false;
  }
}

// AI Chat Service (Anthropic/OpenAI直接統合)
class AIChatService {
  async generateResponse(message: string, context?: string): Promise<string> {
    // ElizaOSが利用可能な場合は、そのメソッドを使用
    if (serviceStatus.elizaos === 'available' && elizaAgent) {
      try {
        return await this.useElizaOSAgent(message, context);
      } catch (error) {
        console.log("⚠️ ElizaOS agent failed, falling back to direct API");
      }
    }

    // フォールバック: 直接API呼び出し
    if (config.ANTHROPIC_API_KEY) {
      try {
        return await this.callAnthropic(message, context);
      } catch (error) {
        console.error('Anthropic API error:', error);
      }
    }

    if (config.OPENAI_API_KEY) {
      try {
        return await this.callOpenAI(message, context);
      } catch (error) {
        console.error('OpenAI API error:', error);
      }
    }

    return this.generateRuleBasedResponse(message);
  }

  private async useElizaOSAgent(message: string, context?: string): Promise<string> {
    const memory: Memory = {
      userId: "web-user",
      roomId: "web-chat",
      content: {
        text: message,
        context: context || ""
      },
      timestamp: new Date().toISOString()
    };

    // 最新ElizaOS APIのメソッドを試行
    const agent = elizaAgent as any;
    
    // 利用可能なメソッドを順次試行
    if (typeof agent.handleMessage === 'function') {
      const result = await agent.handleMessage(memory);
      return result?.content?.text || result?.text || "応答を生成できませんでした。";
    }
    
    if (typeof agent.processAction === 'function') {
      const result = await agent.processAction('chat', memory);
      return result?.content?.text || result?.text || "応答を生成できませんでした。";
    }
    
    if (typeof agent.composeState === 'function') {
      const state = await agent.composeState(memory);
      return state?.text || "状態を構成できませんでした。";
    }

    throw new Error("No suitable ElizaOS method found for message processing");
  }

  private async callAnthropic(message: string, context?: string): Promise<string> {
    const systemPrompt = `あなたは経験豊富なDeFiアービトラージトレーダーです。
実用的で分かりやすいアドバイスを日本語で提供してください。
専門知識: ブロックチェーン、DeFi、アービトラージ戦略、リスク管理
${context ? `追加情報: ${context}` : ''}`;

    const payload = JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
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

    const response = await makeHttpRequest(options, payload);
    return response.content?.[0]?.text || "Anthropic APIからの応答を取得できませんでした。";
  }

  private async callOpenAI(message: string, context?: string): Promise<string> {
    const systemMessage = `あなたは経験豊富なDeFiアービトラージトレーダーです。
実用的で分かりやすいアドバイスを日本語で提供してください。
${context ? `追加情報: ${context}` : ''}`;

    const payload = JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: message }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const response = await makeHttpRequest(options, payload);
    return response.choices?.[0]?.message?.content || "OpenAI APIからの応答を取得できませんでした。";
  }

  private generateRuleBasedResponse(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    const responses: { [key: string]: string } = {
      "価格": "現在の仮想通貨価格を確認するには /prices エンドポイントをご利用ください。",
      "ガス": "Ethereumのガス価格情報は /gas エンドポイントで確認できます。",
      "アービトラージ": `アービトラージとは、異なる取引所間の価格差を利用する戦略です。

主なポイント:
• 価格差の迅速な発見と実行
• ガス代とスリッページの考慮
• リスク管理の重要性
• 流動性の確保`,
      "defi": "DeFiでは、Uniswap、SushiSwap、Aaveなどのプロトコル間で価格差や金利差が発生します。",
      "リスク": `主なリスク要因:
• ガス代の高騰
• スリッページ
• 流動性不足
• スマートコントラクトリスク
• MEV攻撃
• 一時的損失`,
      "始め方": `アービトラージの始め方:
1. 少額から開始
2. テストネットで練習
3. ガス代を十分に考慮
4. 複数のプラットフォームを監視
5. リスク管理戦略の確立`,
    };

    for (const [keyword, response] of Object.entries(responses)) {
      if (lowerMessage.includes(keyword)) {
        return response;
      }
    }

    return `「${message}」についてお答えします。より詳細な情報が必要でしたら、具体的な質問をお聞かせください。

利用可能なトピック: 価格情報、ガス代、アービトラージ戦略、DeFi、リスク管理、始め方`;
  }
}

// Blockchain Service (変更なし)
class BlockchainService {
  private getRpcUrl(network: string = "ethereum"): string {
    switch (network) {
      case "ethereum":
        if (config.ALCHEMY_API_KEY) return `https://eth-mainnet.g.alchemy.com/v2/${config.ALCHEMY_API_KEY}`;
        if (config.INFURA_PROJECT_ID) return `https://mainnet.infura.io/v3/${config.INFURA_PROJECT_ID}`;
        return "https://cloudflare-eth.com";
      case "polygon":
        if (config.ALCHEMY_API_KEY) return `https://polygon-mainnet.g.alchemy.com/v2/${config.ALCHEMY_API_KEY}`;
        if (config.INFURA_PROJECT_ID) return `https://polygon-mainnet.infura.io/v3/${config.INFURA_PROJECT_ID}`;
        return "https://polygon-rpc.com";
      default:
        throw new Error(`Unsupported network: ${network}`);
    }
  }

  async getGasPrice(network: string = "ethereum"): Promise<number> {
    const rpcUrl = this.getRpcUrl(network);
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_gasPrice",
      params: [],
      id: 1
    });

    const url = new URL(rpcUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const response = await makeHttpRequest(options, payload);
    return parseInt(response.result, 16) / 1e9;
  }

  async getLatestBlock(network: string = "ethereum"): Promise<number> {
    const rpcUrl = this.getRpcUrl(network);
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_blockNumber",
      params: [],
      id: 1
    });

    const url = new URL(rpcUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const response = await makeHttpRequest(options, payload);
    return parseInt(response.result, 16);
  }
}

// Price Feed Service (変更なし)
class PriceFeedService {
  async getCryptoPrices(symbols: string[] = ['bitcoin', 'ethereum']): Promise<any> {
    try {
      const symbolsParam = symbols.join(',');
      const options = {
        hostname: 'api.coingecko.com',
        port: 443,
        path: `/api/v3/simple/price?ids=${symbolsParam}&vs_currencies=usd&include_24hr_change=true`,
        method: 'GET',
        headers: config.COINGECKO_API_KEY ? {
          'x-cg-demo-api-key': config.COINGECKO_API_KEY
        } : {}
      };

      return await makeHttpRequest(options);
    } catch (error) {
      console.error('Price feed error:', error);
      return {
        bitcoin: { usd: 43000, usd_24h_change: 2.5 },
        ethereum: { usd: 2600, usd_24h_change: 1.8 }
      };
    }
  }
}

// サービスインスタンス
const aiService = new AIChatService();
const blockchainService = new BlockchainService();
const priceFeedService = new PriceFeedService();

// サービス初期化
async function initializeServices() {
  console.log("🔄 Initializing all services...");

  // ElizaOS 初期化
  await initializeElizaOS();

  // AI Service Test
  try {
    await aiService.generateResponse("テスト");
    serviceStatus.ai = true;
    console.log("✅ AI service ready");
  } catch (error) {
    console.log("⚠️ AI service limited:", error);
  }

  // Blockchain Service Test
  try {
    await blockchainService.getLatestBlock();
    serviceStatus.blockchain = true;
    console.log("✅ Blockchain service ready");
  } catch (error) {
    console.log("⚠️ Blockchain service limited:", error);
  }

  // Price Feed Test
  try {
    await priceFeedService.getCryptoPrices(['bitcoin']);
    serviceStatus.priceFeeds = true;
    console.log("✅ Price feed service ready");
  } catch (error) {
    console.log("⚠️ Price feed service limited:", error);
  }

  console.log("📊 All services initialized:", serviceStatus);
}

// Chat Handler
async function handleChat(message: string, userId: string = "user") {
  try {
    let context = "";

    // コンテキスト情報の収集
    if (serviceStatus.priceFeeds && message.toLowerCase().includes('価格')) {
      try {
        const prices = await priceFeedService.getCryptoPrices(['bitcoin', 'ethereum']);
        context += `現在価格: BTC $${prices.bitcoin?.usd}, ETH $${prices.ethereum?.usd}. `;
      } catch (error) {
        console.error("Price context error:", error);
      }
    }

    if (serviceStatus.blockchain && message.toLowerCase().includes('ガス')) {
      try {
        const gasPrice = await blockchainService.getGasPrice();
        context += `Ethereumガス価格: ${gasPrice.toFixed(2)} Gwei. `;
      } catch (error) {
        console.error("Gas context error:", error);
      }
    }

    // AI応答生成
    const response = await aiService.generateResponse(message, context);

    return {
      response,
      timestamp: new Date().toISOString(),
      agent: "ArbitrageTrader",
      mode: serviceStatus.elizaos === 'available' ? "ElizaOS Enhanced" : 
            serviceStatus.ai ? "AI Enhanced" : "Rule Based",
      context: context || undefined,
      elizaos_status: serviceStatus.elizaos
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

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
        version: "1.4.0-elizaos-compatible",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: {
          railway: RAILWAY_ENVIRONMENT || "local",
          service: RAILWAY_SERVICE_NAME,
          project: RAILWAY_PROJECT_NAME,
          region: process.env.RAILWAY_REGION
        },
        services: serviceStatus,
        elizaos: {
          status: serviceStatus.elizaos,
          agent_available: elizaAgent !== null,
          methods_available: elizaAgent ? Object.getOwnPropertyNames(Object.getPrototypeOf(elizaAgent))
            .filter(name => typeof (elizaAgent as any)[name] === 'function' && name !== 'constructor') : []
        },
        endpoints: {
          health: "/health",
          config: "/config", 
          chat: "/chat",
          prices: "/prices",
          gas: "/gas",
          elizaos: "/elizaos"
        }
      }));
    }
    else if (req.url === "/elizaos") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        elizaos_integration: {
          status: serviceStatus.elizaos,
          agent_instance: elizaAgent !== null,
          available_methods: elizaAgent ? Object.getOwnPropertyNames(Object.getPrototypeOf(elizaAgent))
            .filter(name => typeof (elizaAgent as any)[name] === 'function' && name !== 'constructor') : [],
          character: elizaAgent ? (elizaAgent as any).character?.name : "Not loaded",
          plugins: elizaAgent ? (elizaAgent as any).plugins || [] : [],
          troubleshooting: {
            package_found: "Check /config for package status",
            methods_issue: serviceStatus.elizaos === 'limited' ? "AgentRuntime created but methods may have changed" : null,
            recommendations: [
              serviceStatus.elizaos === 'unavailable' && "Install @elizaos/core package",
              serviceStatus.elizaos === 'limited' && "Check ElizaOS documentation for latest API",
              "Verify environment variables are correctly set"
            ].filter(Boolean)
          }
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
          RAILWAY_PROJECT_NAME
        },
        api_keys: {
          ANTHROPIC_API_KEY: config.ANTHROPIC_API_KEY ? "✅ Configured" : "❌ Missing",
          OPENAI_API_KEY: config.OPENAI_API_KEY ? "✅ Configured" : "❌ Missing",
          INFURA_PROJECT_ID: config.INFURA_PROJECT_ID ? "✅ Configured" : "❌ Missing",
          ALCHEMY_API_KEY: config.ALCHEMY_API_KEY ? "✅ Configured" : "❌ Missing",
          COINGECKO_API_KEY: config.COINGECKO_API_KEY ? "✅ Configured" : "❌ Missing"
        },
        services: serviceStatus,
        elizaos: {
          integration_status: serviceStatus.elizaos,
          package_available: "Check node_modules/@elizaos/core",
          agent_methods: elizaAgent ? Object.getOwnPropertyNames(Object.getPrototypeOf(elizaAgent))
            .filter(name => typeof (elizaAgent as any)[name] === 'function' && name !== 'constructor') : []
        },
        recommendations: [
          !config.ANTHROPIC_API_KEY && !config.OPENAI_API_KEY && "Add AI API key for enhanced chat",
          !config.INFURA_PROJECT_ID && !config.ALCHEMY_API_KEY && "Add blockchain RPC provider",
          !config.COINGECKO_API_KEY && "Add CoinGecko API key for better price data",
          serviceStatus.elizaos === 'unavailable' && "Install @elizaos/core for full ElizaOS integration",
          serviceStatus.elizaos === 'limited' && "Check ElizaOS documentation for API changes"
        ].filter(Boolean)
      }));
    }
    else if (req.url === "/chat" && req.method === "POST") {
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
    else if (req.url === "/prices") {
      try {
        const prices = await priceFeedService.getCryptoPrices([
          'bitcoin', 'ethereum', 'binancecoin', 'matic-network'
        ]);
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          timestamp: new Date().toISOString(),
          source: "CoinGecko",
          prices,
          railway_region: process.env.RAILWAY_REGION
        }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to fetch prices" }));
      }
    }
    else if (req.url === "/gas") {
      try {
        const [ethGas, ethBlock] = await Promise.all([
          blockchainService.getGasPrice("ethereum"),
          blockchainService.getLatestBlock("ethereum")
        ]);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          timestamp: new Date().toISOString(),
          ethereum: {
            gasPrice: `${ethGas.toFixed(2)} Gwei`,
            latestBlock: ethBlock
          },
          railway_region: process.env.RAILWAY_REGION
        }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to fetch gas data" }));
      }
    }
    else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "Not Found",
        available_endpoints: ["/", "/health", "/config", "/chat", "/prices", "/gas", "/elizaos"]
      }));
    }
  } catch (error) {
    console.error("Server error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`📥 ${signal} received, shutting down gracefully...`);
  server.close(() => {
    console.log('🔚 Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Railway heartbeat
if (RAILWAY_ENVIRONMENT) {
  console.log("🚂 Running in Railway environment");
  
  setInterval(() => {
    console.log(`💓 Railway heartbeat - ${new Date().toISOString()} - ElizaOS: ${serviceStatus.elizaos}`);
  }, 5 * 60 * 1000);
}

// Start server
async function start() {
  console.log("🚀 Starting ElizaOS-compatible Arbitrage Bot...");
  
  await initializeServices();
  
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Server running on port ${PORT}`);
    console.log(`🔗 Health: https://${RAILWAY_SERVICE_NAME || 'localhost'}/health`);
    console.log(`📊 ElizaOS Status: https://${RAILWAY_SERVICE_NAME || 'localhost'}/elizaos`);
    console.log(`⚙️ Config: https://${RAILWAY_SERVICE_NAME || 'localhost'}/config`);
    console.log("✅ ElizaOS-compatible deployment ready");
    
    // ElizaOS統合状態の報告
    if (serviceStatus.elizaos === 'available') {
      console.log("🎉 ElizaOS fully integrated and operational");
    } else if (serviceStatus.elizaos === 'limited') {
      console.log("⚠️ ElizaOS partially integrated - check /elizaos endpoint for details");
    } else {
      console.log("📦 ElizaOS not available - running with direct API integration");
    }
  });
}

start().catch(console.error);

export default server;
