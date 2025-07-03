// ElizaOS Arbitrage Bot - Phase 2: Core Integration
import dotenv from "dotenv";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { join } from "path";

// Load environment variables
dotenv.config();

console.log("🤖 ElizaOS Arbitrage Bot Starting...");
console.log("📊 Environment:", process.env.NODE_ENV || "development");
console.log("🔧 Daemon Mode:", process.env.DAEMON_PROCESS || "false");

// Global variables for ElizaOS
let elizaAgent: any = null;
let isElizaAvailable = false;

// Initialize ElizaOS Core
async function initializeElizaOS() {
  try {
    console.log("🔄 Initializing ElizaOS Core...");
    
    // Dynamic import for ElizaOS Core
    const { AgentRuntime, Character, defaultCharacter } = await import("@elizaos/core");
    
    // Load character configuration
    let characterConfig: Character;
    try {
      const characterPath = join(process.cwd(), 'characters', 'arbitrage-trader.character.json');
      const characterData = await readFile(characterPath, 'utf-8');
      characterConfig = JSON.parse(characterData);
      console.log("✅ Character configuration loaded:", characterConfig.name);
    } catch (error) {
      console.log("⚠️ Using default character configuration");
      characterConfig = {
        ...defaultCharacter,
        name: "ArbitrageTrader",
        bio: ["AI-powered arbitrage trading assistant"],
      };
    }

    // Initialize Agent Runtime
    elizaAgent = new AgentRuntime({
      character: characterConfig,
      // Add minimal configuration for now
    });

    isElizaAvailable = true;
    console.log("✅ ElizaOS Core initialized successfully");
    console.log("🎯 Agent:", characterConfig.name);
    
    return true;
  } catch (error) {
    console.log("⚠️ ElizaOS Core initialization failed, running in basic mode");
    console.log("Error details:", error.message);
    isElizaAvailable = false;
    return false;
  }
}

// Chat handler
async function handleChat(message: string, userId: string = "user") {
  if (!isElizaAvailable || !elizaAgent) {
    return {
      response: "AI機能は現在利用できません。基本モードで動作中です。",
      error: "ElizaOS not available"
    };
  }

  try {
    // Simple response for now (will be enhanced)
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
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
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
        chat: isElizaAvailable,
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

          const chatResponse = await handleChat(message, userId);
          
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
      status: isElizaAvailable ? "online" : "offline",
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
      ]
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
async function start() {
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
