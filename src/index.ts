// src/index.ts - 最小限バージョン
import dotenv from "dotenv";
dotenv.config();

console.log("ElizaOS Arbitrage Bot Starting...");
console.log("Environment:", process.env.NODE_ENV);

// Health check endpoint
import { createServer } from "http";

const port = process.env.PORT || 3000;

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ 
      status: "healthy", 
      timestamp: new Date().toISOString() 
    }));
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
