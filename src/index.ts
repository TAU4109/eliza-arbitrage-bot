// ElizaOS Arbitrage Bot - Phase 2: Core Integration (修正版)
import dotenv from "dotenv";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { join } from "path";

// Load environment variables
dotenv.config();

console.log("🤖 ElizaOS Arbitrage Bot Starting...");
console.log("📊 Environment:", process.env.NODE_ENV || "development");
console.log("🔧 Daemon Mode:", process.env.DAEMON_PROCESS || "false");

// 型定義
interface Character {
  name: string;
  bio: string[];
  [key: string]: any;
}

interface AgentRuntime {
  processMessage(params: any): Promise<any>;
}

interface ChatResponse {
  response: string;
  timestamp?: string;
  agent?: string;
  error?: string;
}

// Global variables for ElizaOS
let elizaAgent: AgentRuntime | null = null;
let isElizaAvailable = false;

// デフォルトキャラクター設定
const defaultCharacter: Character = {
  name: "ArbitrageTrader",
  bio: ["AI-powered arbitrage trading assistant"],
  description: "DeFi arbitrage trading specialist",
  personality: "analytical, helpful, risk-aware",
  knowledge: ["DeFi", "arbitrage", "trading", "blockchain"],
  capabilities: [
    "market analysis",
    "arbitrage strategy explanation", 
    "risk management advice",
    "DeFi knowledge sharing"
  ]
};

// Initialize ElizaOS Core
async function initializeElizaOS(): Promise<boolean> {
  try {
    console.log("🔄 Initializing ElizaOS Core...");
    
    // まずパッケージが存在するかチェック
    try {
      const fs = await import("fs");
      const path = await import("path");
      const packagePath = path.join(process.cwd(), 'node_modules', '@elizaos', 'core');
      
      if (!fs.existsSync(packagePath)) {
        console.log("📦 @elizaos/core package not found in node_modules");
        throw new Error("Package not installed");
      }
      
      console.log("📦 @elizaos/core package found in node_modules");
    } catch (fsError) {
      console.log("⚠️ Cannot check package existence:", fsError);
    }

    // ElizaOSの動的インポートを試行
    let elizaModule: any;
    try {
      // まず基本パッケージを試行
      elizaModule = await import("@elizaos/core");
      console.log("✅ Successfully imported @elizaos/core");
    } catch (importError) {
      console.log("⚠️ @elizaos/core import failed:", importError);
      console.log("🔄 Trying alternative import methods...");
      
      // 代替方法: require を使用
      try {
        elizaModule = require("@elizaos/core");
        console.log("✅ Successfully required @elizaos/core");
      } catch (requireError) {
        console.log("⚠️ require @elizaos/core also failed:", requireError);
        throw new Error("ElizaOS core module not found. Please ensure @elizaos/core is properly installed.");
      }
    }

    // 利用可能なエクスポートを確認
    console.log("📦 Available exports:", Object.keys(elizaModule));
    
    const { AgentRuntime } = elizaModule;
    
    if (!AgentRuntime) {
      console.log("⚠️ AgentRuntime not found, available exports:", Object.keys(elizaModule));
      throw new Error("AgentRuntime not found in ElizaOS module");
    }

    // Load character configuration
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

    // Initialize Agent Runtime
    elizaAgent = new AgentRuntime({
      character: characterConfig,
      // 基本設定を追加
      databaseAdapter: null, // 必要に応じて設定
      token: process.env.ELIZA_TOKEN || "default-token",
    });

    isElizaAvailable = true;
    console.log("✅ ElizaOS Core initialized successfully");
    console.log("🎯 Agent:", characterConfig.name);
    
    return true;
  } catch (error) {
    console.log("⚠️ ElizaOS Core initialization failed, running in basic mode");
    console.log("Error details:", error instanceof Error ? error.message : String(error));
    console.log("📋 To install ElizaOS, run: npm install @elizaos/core");
    isElizaAvailable = false;
    return false;
  }
}

// Chat handler
async function handleChat(message: string, userId: string = "user"): Promise<ChatResponse> {
  if (!isElizaAvailable || !elizaAgent) {
    return {
      response: "AI機能は現在利用できません。基本モードで動作中です。",
      error: "ElizaOS not available"
    };
  }

  try {
    // メッセージ処理
    const response = await elizaAgent.processMessage({
      content: { text: message },
      userId: userId,
      roomId: "web-chat"
    });

    return {
      response: response?.content?.text || "申し訳ありませんが、応答を生成できませんでした。",
      timestamp: new Date().toISOString(),
      agent: "ArbitrageTrader"
    };
  } catch (error) {
    console.error("Chat processing error:", error);
    return {
      response: "処理中にエラーが発生しました。",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
  }
}

// Basic fallback chat handler (ElizaOS利用不可時)
function handleBasicChat(message: string): ChatResponse {
  const lowerMessage = message.toLowerCase();
  
  // より詳細な応答パターン
  const responses: { [key: string]: string } = {
    "こんにちは": "こんにちは！アービトラージトレーダーです。DeFiや仮想通貨取引についてお手伝いします。",
    "hello": "Hello! I'm ArbitrageTrader, here to help with DeFi and crypto trading questions.",
    "アービトラージ": `アービトラージとは、異なる取引所や市場間の価格差を利用して利益を得る取引戦略です。

主な特徴：
• 価格差を利用したリスクの少ない取引
• 迅速な執行が重要
• ガス代や手数料を考慮する必要あり

DeFiでは、異なるDEX間での価格差やレンディングプロトコル間の金利差を利用します。`,
    
    "arbitrage": `Arbitrage is a trading strategy that profits from price differences between different exchanges or markets.

Key features:
• Low-risk trading utilizing price differences
• Requires quick execution
• Must consider gas fees and transaction costs

In DeFi, we can utilize price differences between DEXs or interest rate differences between lending protocols.`,

    "リスク": `アービトラージの主なリスクには以下があります：

1. **ガス代リスク**: Ethereumネットワークの混雑時に高額なガス代
2. **スリッページ**: 大きな取引での価格滑り
3. **流動性リスク**: 取引相手が見つからない
4. **スマートコントラクトリスク**: コードの脆弱性
5. **MEV（最大抽出価値）**: ボットによる先回り取引
6. **一時的損失**: AMM提供時の価格変動リスク

リスク管理が成功の鍵となります。`,

    "ガス代": `ガス代を節約する方法：

1. **ガス価格モニタリング**: ETH Gas Stationなどでガス価格をチェック
2. **最適なタイミング**: ネットワークが空いている時間帯を狙う
3. **レイヤー2使用**: Arbitrum、Optimism、Polygonなどを活用
4. **バッチ取引**: 複数の取引をまとめて実行
5. **ガス制限設定**: 適切なガス制限を設定して無駄を削減

DeFiアービトラージでは、ガス代が利益を上回らないよう注意が必要です。`,

    "defi": `DeFiアービトラージの主要な戦略：

1. **DEX間アービトラージ**: Uniswap、SushiSwap、1inch間の価格差
2. **レンディング**: Compound、Aave、MakerDAO間の金利差
3. **フラッシュローン**: 資金なしで大きなアービトラージ実行
4. **イールドファーミング**: 高利回りプール間の移動
5. **ステーブルコインアービトラージ**: USDC、USDT、DAI間の価格差

各戦略には異なるリスクプロファイルがあります。`,

    "strategy": `Recommended arbitrage strategies:

1. **Cross-DEX Arbitrage**: Price differences between Uniswap, SushiSwap, 1inch
2. **Lending Arbitrage**: Interest rate differences between Compound, Aave, MakerDAO  
3. **Flash Loans**: Execute large arbitrage without capital
4. **Yield Farming**: Moving between high-yield pools
5. **Stablecoin Arbitrage**: Price differences between USDC, USDT, DAI

Each strategy has different risk profiles and capital requirements.`,

    "取引所": `主要な取引所とDEX：

**中央集権取引所(CEX):**
• Binance, Coinbase, Kraken
• 高い流動性、低い手数料
• KYC必須、カウンターパーティリスク

**分散型取引所(DEX):**
• Uniswap, SushiSwap, PancakeSwap
• 非許可型、MEV機会豊富
• ガス代、スリッページに注意

アービトラージでは両方を活用することが多いです。`,

    "始め方": `アービトラージを始める手順：

1. **学習フェーズ**:
   • DeFiの基本概念を理解
   • 各プロトコルの仕組みを学習
   • リスクを十分に理解

2. **準備フェーズ**:
   • ウォレット設定（MetaMask等）
   • 複数の取引所アカウント作成
   • 少額から開始

3. **実践フェーズ**:
   • 価格監視ツールの導入
   • 小さなアービトラージから開始
   • 経験を積みながら規模拡大

初期は勉強代と考えて少額で始めることをお勧めします。`
  };

  // メッセージに含まれるキーワードで応答を決定
  for (const [keyword, response] of Object.entries(responses)) {
    if (lowerMessage.includes(keyword)) {
      return {
        response,
        timestamp: new Date().toISOString(),
        agent: "ArbitrageTrader (Basic Mode)"
      };
    }
  }

  // デフォルト応答
  const defaultResponse = `申し訳ございませんが、「${message}」について詳しい情報を提供できません。

以下のトピックについてお答えできます：
• アービトラージの基本
• DeFi取引戦略  
• リスク管理
• ガス代節約
• 取引所の選び方
• 始め方

より詳細な回答には ElizaOS の統合が必要です。`;

  return {
    response: defaultResponse,
    timestamp: new Date().toISOString(),
    agent: "ArbitrageTrader (Basic Mode)"
  };
}

// HTTP Server with Enhanced API
const port = parseInt(process.env.PORT || "3000", 10);

const server = createServer(async (req, res) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Route handling
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "healthy",
      service: "eliza-arbitrage-bot",
      version: "1.1.0",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      uptime: process.uptime(),
      elizaos: isElizaAvailable ? "available" : "unavailable",
      features: {
        chat: true, // 基本チャットは常に利用可能
        advanced_chat: isElizaAvailable,
        arbitrage: false, // Phase 3
        monitoring: true
      }
    }));
  } 
  else if (req.url === "/" || req.url === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      message: "ElizaOS Arbitrage Bot is running",
      version: "1.1.0",
      status: "active",
      elizaos: isElizaAvailable ? "integrated" : "basic-mode",
      endpoints: {
        health: "/health",
        status: "/",
        chat: "/chat",
        agent: "/agent"
      }
    }));
  }
  else if (req.url === "/chat" && req.method === "POST") {
    try {
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

          // ElizaOSが利用可能な場合は高度なチャット、そうでなければ基本チャット
          const chatResponse = isElizaAvailable 
            ? await handleChat(message, userId)
            : handleBasicChat(message);
          
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(chatResponse));
        } catch (parseError) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }
  else if (req.url === "/agent") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      agent: "ArbitrageTrader",
      status: isElizaAvailable ? "online" : "basic-mode",
      capabilities: [
        "市場分析相談",
        "アービトラージ戦略説明",
        "DeFi知識共有",
        "リスク管理アドバイス"
      ],
      example_queries: [
        "現在の市場状況を教えて",
        "アービトラージについて説明して",
        "ガス代を節約する方法は？",
        "おすすめの取引戦略は？"
      ],
      note: isElizaAvailable ? "Full AI capabilities available" : "Running in basic mode - limited responses"
    }));
  }
  else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Not Found",
      message: "Endpoint not available",
      available_endpoints: ["/", "/health", "/chat", "/agent"]
    }));
  }
});

// Application startup
async function start(): Promise<void> {
  console.log("🚀 Starting ElizaOS Arbitrage Bot...");
  
  // Initialize ElizaOS Core
  await initializeElizaOS();
  
  // Start HTTP server
  server.listen(port, () => {
    console.log(`🌐 Server running on port ${port}`);
    console.log(`🔍 Health check: http://localhost:${port}/health`);
    console.log(`💬 Chat API: http://localhost:${port}/chat`);
    console.log(`🤖 Agent info: http://localhost:${port}/agent`);
    console.log("✅ Phase 2 setup completed successfully");
    
    if (!isElizaAvailable) {
      console.log("⚠️ Running in basic mode - some features may be limited");
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📥 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('🔚 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📥 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('🔚 Server closed');
    process.exit(0);
  });
});

// Keep alive in daemon mode
if (process.env.DAEMON_PROCESS === "true") {
  console.log("🔄 Running in daemon mode - process will stay alive");
  
  // Heartbeat every 5 minutes
  setInterval(() => {
    console.log(`💓 Heartbeat - ${new Date().toISOString()} - ElizaOS: ${isElizaAvailable ? 'Online' : 'Offline'}`);
  }, 5 * 60 * 1000);
}

// Start the application
start().catch(console.error);

export default server;
