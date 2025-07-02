// ElizaOS Arbitrage Bot - Basic Version
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

console.log("🤖 ElizaOS Arbitrage Bot Starting...");
console.log("📊 Environment:", process.env.NODE_ENV || "development");
console.log("🔧 Daemon Mode:", process.env.DAEMON_PROCESS || "false");

// Basic HTTP server for health checks
import { createServer } from "http";

const port = parseInt(process.env.PORT || "3000", 10);

const server = createServer((req, res) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "healthy",
      service: "eliza-arbitrage-bot",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      uptime: process.uptime()
    }));
  } else if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      message: "ElizaOS Arbitrage Bot is running",
      endpoints: {
        health: "/health",
        status: "/"
      }
    }));
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Not Found",
      message: "Endpoint not available"
    }));
  }
});

server.listen(port, () => {
  console.log(`🌐 Server running on port ${port}`);
  console.log(`🔍 Health check: http://localhost:${port}/health`);
  console.log("✅ Basic setup completed successfully");
});

// Graceful shutdown handling
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

// Keep the process alive in daemon mode
if (process.env.DAEMON_PROCESS === "true") {
  console.log("🔄 Running in daemon mode - process will stay alive");
  
  // Heartbeat every 5 minutes
  setInterval(() => {
    console.log(`💓 Heartbeat - ${new Date().toISOString()}`);
  }, 5 * 60 * 1000);
}

export default server;
