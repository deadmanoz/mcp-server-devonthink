import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";
import { createServer } from "./devonthink.js";

async function main() {
    const app = express();

    // Enable CORS for all origins (local network access)
    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Parse JSON bodies
    app.use(express.json());

    // Store active transports and servers by their session IDs
    const activeTransports = new Map<string, SSEServerTransport>();
    const activeServers = new Map<string, any>();

    // Health check endpoint
    app.get("/health", (req, res) => {
        res.json({ 
            status: "ok", 
            timestamp: new Date().toISOString(),
            activeConnections: activeTransports.size
        });
    });

    app.get("/sse", async (req, res) => {
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      console.log(`[${new Date().toISOString()}] SSE connection from ${clientIP}`);
      
      // Create transport FIRST to get session ID
      const transport = new SSEServerTransport("/message", res);
      
      // Create a dedicated server instance for this connection
      const { server: connectionServer, cleanup: connectionCleanup } = await createServer();
      
      // Connect the server to this transport
      await connectionServer.connect(transport);
      
      // Store transport by session ID (SDK provides a sessionId)
      const sessionId = transport.sessionId || `${clientIP}-${Date.now()}`;
      activeTransports.set(sessionId, transport);
      activeServers.set(sessionId, { server: connectionServer, cleanup: connectionCleanup });
      
      console.log(`[${new Date().toISOString()}] SSE connection established, sessionId: ${sessionId}`);

      // Handle connection close
      connectionServer.onclose = async () => {
        console.log(`[${new Date().toISOString()}] SSE connection closed, sessionId: ${sessionId}`);
        activeTransports.delete(sessionId);
        const serverInfo = activeServers.get(sessionId);
        if (serverInfo) {
          await serverInfo.cleanup();
          await serverInfo.server.close();
          activeServers.delete(sessionId);
        }
      };

      // Handle client disconnect
      req.on('close', () => {
        console.log(`[${new Date().toISOString()}] Client disconnected: ${sessionId}`);
        activeTransports.delete(sessionId);
        const serverInfo = activeServers.get(sessionId);
        if (serverInfo) {
          serverInfo.cleanup();
          serverInfo.server.close();
          activeServers.delete(sessionId);
        }
      });
    });

    // Message endpoint handler function
    const handleMessage = async (req: express.Request, res: express.Response): Promise<void> => {
      try {
        const sessionId = req.query.sessionId as string;

        if (!sessionId) {
          res.status(400).json({ 
            jsonrpc: "2.0",
            error: { code: -32000, message: "Missing sessionId parameter" },
            id: req.body?.id || null 
          });
          return;
        }

        // Find the transport for this session
        const transport = activeTransports.get(sessionId) || Array.from(activeTransports.values())[0];
        
        if (transport) {
          try {
            // CRITICAL: Pass req.body as third parameter to prevent "stream is not readable" error
            // Express.json() middleware consumes the request stream, so the SDK needs the parsed body
            await transport.handlePostMessage(req, res, req.body);
            return;
          } catch (error) {
            console.error(`[${new Date().toISOString()}] Error in handlePostMessage:`, error);
            res.status(500).json({ 
              jsonrpc: "2.0",
              error: { code: -32603, message: "Internal error" },
              id: req.body?.id || null 
            });
            return;
          }
        } else {
          res.status(400).json({ 
            jsonrpc: "2.0",
            error: { code: -32000, message: "No active SSE connection found for session" },
            id: req.body?.id || null 
          });
          return;
        }
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error handling message:`, error);
        res.status(500).json({ 
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal error" },
          id: req.body?.id || null 
        });
        return;
      }
    };

    app.post("/message", handleMessage);

    const PORT = parseInt(process.env.PORT || '8429', 10);
    const HOST = process.env.HOST || '0.0.0.0';
    
    app.listen(PORT, HOST, () => {
      console.log(`[${new Date().toISOString()}] DEVONthink MCP Server running on http://${HOST}:${PORT}`);
      console.log(`[${new Date().toISOString()}] Health check: http://${HOST}:${PORT}/health`);
      console.log(`[${new Date().toISOString()}] SSE endpoint: http://${HOST}:${PORT}/sse`);
    });
}

main();
