import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { createServer } from "./devonthink.js";

// Minimal test to see if SSEServerTransport works at all
async function main() {
    const app = express();
    app.use(express.json());

    console.log("Starting minimal SSE test...");

    app.get("/test-sse", async (req, res) => {
        console.log("Creating SSE transport...");
        
        try {
            const transport = new SSEServerTransport("/test-message", res);
            console.log("Transport created successfully");
            
            const { server } = await createServer();
            console.log("Server created");
            
            await server.connect(transport);
            console.log("Server connected to transport");
            
        } catch (error) {
            console.error("Error in SSE setup:", error);
            res.status(500).send("Error: " + error);
        }
    });

    app.post("/test-message", async (req, res) => {
        console.log("Test message received:", req.body);
        res.json({ test: "response" });
    });

    app.listen(8430, () => {
        console.log("Test server running on port 8430");
        console.log("Try: curl http://localhost:8430/test-sse");
    });
}

main();