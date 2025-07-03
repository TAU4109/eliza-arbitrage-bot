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
    
    // ElizaOSの動的インポートを試行
    let elizaModule: any;
    try {
      elizaModule = await import("@elizaos/core");
    } catch (importError) {
      console.log("⚠️ @elizaos/core import failed, trying alternative paths...");
      
      // 代替パスを試行
      try {
        elizaModule = await import("@elizaos/core/dist");
      } catch (altError) {
        throw new Error("ElizaOS core module not found");
      }
    }

    // 利用可能なエクスポートを確認
    console.log("📦 Available exports:", Object.keys(elizaModule));
    
    const { AgentRuntime } = elizaModule;
    
    if (!AgentRuntime) {
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
  const responses = {
    "こんにちは": "こんにちは！アービトラージトレーダーです。",
    "アービトラージとは": "アービトラージとは、異なる市場間の価格差を利用して利益を得る取引戦略です。",
    "リスクは": "主なリスクには、ガス代、スリッページ、流動性リスク、スマートコントラクトリスクがあります。",
    "default": "申し訳ございませんが、現在基本モードで動作中です。より詳細な回答には ElizaOS の統合が必要です。"
  };

  const lowerMessage = message.toLowerCase();
  let response = responses.default;

  for (const [key, value] of Object.entries(responses)) {
    if (key !== "default" && lowerMessage.includes(key)) {
      response = value;
      break;
    }
  }

  return {
    response,
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
