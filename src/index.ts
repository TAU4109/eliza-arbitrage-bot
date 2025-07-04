// ElizaOS Arbitrage Bot - Debug Fixed Version
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

console.log("🚀 ElizaOS Arbitrage Bot Starting (Debug Fixed)...");
console.log("🌍 Environment:", process.env.NODE_ENV || "development");
console.log("🚂 Railway Environment:", RAILWAY_ENVIRONMENT || "local");
console.log("📦 Service:", RAILWAY_SERVICE_NAME || "local");
console.log("🔌 Port:", PORT);

// エラーハンドリングの強化
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// 型定義
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
};

// サービス状態管理
interface ServiceStatus {
  elizaos: 'available' | 'limited' | 'unavailable';
  ai: boolean;
  blockchain: boolean;
  priceFeeds: boolean;
  deployment: 'railway' | 'local';
}

let serviceStatus: ServiceStatus = {
  elizaos: 'unavailable',
  ai: false,
  blockchain: false,
  priceFeeds: false,
  deployment: RAILWAY_ENVIRONMENT ? 'railway' : 'local',
};

// ElizaOS エージェント
let elizaAgent: any = null;
let elizaAvailableMethods: string[] = [];

// デフォルトキャラクター
const defaultCharacter: Character = {
  name: "ArbitrageTrader",
  bio: [
    "AI-powered DeFi arbitrage specialist",
    "Expert in blockchain analysis and risk management"
  ],
  description: "DeFi arbitrage trading specialist",
  personality: "analytical, helpful, risk-aware",
  knowledge: [
    "DeFi protocols",
    "Arbitrage strategies", 
    "Risk management",
    "Blockchain technology"
  ],
  modelProvider: "anthropic"
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

    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

// ElizaOS 初期化（簡略化＋エラーハンドリング強化）
async function initializeElizaOS(): Promise<boolean> {
  try {
    console.log("🔄 Starting ElizaOS initialization...");
    
    // 動的インポート
    let elizaModule: any;
    try {
      elizaModule = await import("@elizaos/core");
      console.log("✅ ElizaOS module imported successfully");
      
      // 利用可能なエクスポートをログ出力
      const exports = Object.keys(elizaModule);
      console.log(`📦 ElizaOS exports (${exports.length}):`, exports.slice(0, 10), exports.length > 10 ? '...' : '');
      
    } catch (importError) {
      console.log("⚠️ ElizaOS import failed:", importError);
      throw importError;
    }

    // AgentRuntimeの取得
    const AgentRuntime = elizaModule.AgentRuntime || elizaModule.default?.AgentRuntime;
    
    if (!AgentRuntime) {
      console.log("⚠️ AgentRuntime not found in exports");
      throw new Error("AgentRuntime not available");
    }

    console.log("✅ AgentRuntime class found");

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

    // AgentRuntime インスタンス作成（最小限の設定）
    try {
      console.log("🔧 Creating AgentRuntime instance...");
      
      elizaAgent = new AgentRuntime({
        character: characterConfig,
        databaseAdapter: null,
        token: config.ANTHROPIC_API_KEY || config.OPENAI_API_KEY || "test-token",
        modelProvider: "anthropic"
      });

      console.log("✅ AgentRuntime instance created successfully");
      
      // 利用可能なメソッドを取得（安全に）
      try {
        elizaAvailableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(elizaAgent))
          .filter(name => typeof elizaAgent[name] === 'function' && name !== 'constructor');
        
        console.log(`📋 Available methods (${elizaAvailableMethods.length}):`, elizaAvailableMethods.slice(0, 10));
        
        // 特に興味のあるメソッドをチェック
        const importantMethods = ['processMessage', 'handleMessage', 'composeState', 'processAction', 'evaluate'];
        const foundMethods = importantMethods.filter(method => elizaAvailableMethods.includes(method));
        console.log("🎯 Important methods found:", foundMethods);
        
      } catch (methodError) {
        console.log("⚠️ Could not analyze methods:", methodError);
      }

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
    // ElizaOSエージェントを試行
    if (serviceStatus.elizaos === 'available' && elizaAgent) {
      try {
        return await this.useElizaAgent(message, context);
      } catch (error) {
        console.log("⚠️ ElizaOS agent error, falling back:", error);
      }
    }

    // フォールバック: 直接API
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

  private async useElizaAgent(message: string, context?: string): Promise<string> {
    const memory: Memory = {
      userId: "web-user",
      roomId: "web-chat",
      content: {
        text: message,
        context: context || ""
      },
      timestamp: new Date().toISOString()
    };

    // 利用可能なメソッドを順次試行
    const methodsToTry = [
      'processMessage',
      'handleMessage', 
      'composeState',
      'processAction',
      'evaluate'
    ];

    for (const methodName of methodsToTry) {
      if (elizaAvailableMethods.includes(methodName)) {
        try {
          console.log(`🔄 Trying ElizaOS method: ${methodName}`);
          
          let result;
          if (methodName === 'processAction') {
            result = await elizaAgent[methodName]('chat', memory);
          } else if (methodName === 'composeState') {
            result = await elizaAgent[methodName](memory);
          } else {
            result = await elizaAgent[methodName](memory);
          }
          
          console.log(`✅ ElizaOS ${methodName} succeeded`);
          
          // 結果から文字列を抽出
          if (typeof result === 'string') {
            return result;
          } else if (result?.content?.text) {
            return result.content.text;
          } else if (result?.text) {
            return result.text;
          } else if (result && typeof result === 'object') {
            return JSON.stringify(result);
          }
          
        } catch (methodError) {
          console.log(`⚠️ ElizaOS ${methodName} failed:`, methodError);
          continue;
        }
      }
    }

    throw new Error("No suitable ElizaOS method succeeded");
  }

  private async callAnthropic(message: string, context?: string): Promise<string> {
    const systemPrompt = `あなたは経験豊富なDeFiアービトラージトレーダーです。
実用的で分かりやすいアドバイスを日本語で提供してください。
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
      "こんにちは": "こんにちは！DeFiアービトラージについてお手伝いします。何かご質問はありますか？"
    };

    for (const [keyword, response] of Object.entries(responses)) {
      if (lowerMessage.includes(keyword)) {
        return response;
      }
    }

    return `「${message}」についてお答えします。

利用可能なトピック:
• 価格情報 (/prices)
• ガス代情報 (/gas) 
• アービトラージ戦略
• DeFi基礎知識
• リスク管理

より詳細な情報が必要でしたら、具体的な質問をお聞かせください。`;
  }
}

// 簡略化されたサービス
const aiService = new AIChatService();

// サービス初期化
async function initializeServices() {
  console.log("🔄 Initializing services...");

  try {
    // ElizaOS 初期化
    await initializeElizaOS();

    // AI Service Test
    await aiService.generateResponse("テスト");
    serviceStatus.ai = true;
    console.log("✅ AI service ready");

    console.log("📊 Services initialized:", serviceStatus);
  } catch (error) {
    console.error("⚠️ Service initialization error:", error);
  }
}

// Chat Handler
async function handleChat(message: string, userId: string = "user") {
  try {
    const response = await aiService.generateResponse(message);

    return {
      response,
      timestamp: new Date().toISOString(),
      agent: "ArbitrageTrader",
      mode: serviceStatus.elizaos === 'available' ? "ElizaOS Enhanced" : 
            serviceStatus.ai ? "AI Enhanced" : "Rule Based",
      elizaos_status: serviceStatus.elizaos,
      elizaos_methods: elizaAvailableMethods.length
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

// HTTP Server（簡略化）
const server = createServer(async (req, res) => {
  // CORS headers
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
        version: "1.6.0-debug-fixed",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: {
          railway: RAILWAY_ENVIRONMENT || "local",
          service: RAILWAY_SERVICE_NAME,
          region: process.env.RAILWAY_REGION
        },
        services: serviceStatus,
        elizaos: {
          status: serviceStatus.elizaos,
          agent_available: elizaAgent !== null,
          methods_count: elizaAvailableMethods.length,
          key_methods: elizaAvailableMethods.filter(m => 
            ['processMessage', 'handleMessage', 'composeState', 'processAction'].includes(m)
          )
        }
      }));
    }
    else if (req.url === "/elizaos") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        elizaos_integration: {
          status: serviceStatus.elizaos,
          agent_instance: elizaAgent !== null,
          available_methods_count: elizaAvailableMethods.length,
          available_methods: elizaAvailableMethods,
          message_processing_methods: elizaAvailableMethods.filter(m => 
            m.toLowerCase().includes('message') || 
            m.toLowerCase().includes('process') ||
            m.toLowerCase().includes('handle') ||
            m.toLowerCase().includes('compose')
          )
        }
      }));
    }
    else if (req.url === "/agent") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        agent: "ArbitrageTrader",
        character: elizaAgent ? {
          name: elizaAgent.character?.name || "ArbitrageTrader",
          bio: elizaAgent.character?.bio || defaultCharacter.bio,
          personality: elizaAgent.character?.personality || defaultCharacter.personality,
          knowledge: elizaAgent.character?.knowledge || defaultCharacter.knowledge
        } : defaultCharacter,
        status: serviceStatus.elizaos === 'available' ? "online" : "limited",
        capabilities: [
          "市場分析相談",
          "アービトラージ戦略説明", 
          "DeFi知識共有",
          "リスク管理アドバイス",
          "ガス最適化のコツ",
          "取引戦略の提案"
        ],
        example_queries: [
          "現在の市場状況を教えて",
          "アービトラージについて説明して",
          "ガス代を節約する方法は？",
          "おすすめの取引戦略は？",
          "DeFiのリスクについて教えて",
          "Uniswap vs SushiSwap の違いは？"
        ],
        features: {
          elizaos_integration: serviceStatus.elizaos === 'available',
          ai_enhanced: serviceStatus.ai,
          blockchain_data: serviceStatus.blockchain,
          price_feeds: serviceStatus.priceFeeds,
          real_time_response: true,
          context_awareness: serviceStatus.elizaos === 'available'
        },
        api_endpoints: {
          chat: "/chat",
          health: "/health", 
          elizaos_status: "/elizaos",
          prices: "/prices",
          gas_info: "/gas"
        },
        note: serviceStatus.elizaos === 'available' 
          ? "ElizaOS fully integrated - AI capabilities available" 
          : "Running in limited mode - basic responses only"
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
    else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "Not Found",
        available_endpoints: ["/", "/health", "/chat", "/elizaos", "/agent"]
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
    console.log("🚀 Starting Enhanced Arbitrage Bot...");
    
    // サービス初期化
    await initializeServices();
    
    // サーバー開始
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`🔗 Health: http://localhost:${PORT}/health`);
      console.log(`📊 ElizaOS: http://localhost:${PORT}/elizaos`);
      console.log(`💬 Chat: http://localhost:${PORT}/chat`);
      console.log("✅ Server startup completed successfully");
      
      // ElizaOS状態レポート
      if (serviceStatus.elizaos === 'available') {
        console.log(`🎉 ElizaOS fully integrated with ${elizaAvailableMethods.length} methods`);
      } else {
        console.log("📦 ElizaOS integration limited or unavailable");
      }
    });
    
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
}

// アプリケーション開始
start();
