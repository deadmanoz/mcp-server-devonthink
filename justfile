# DEVONthink MCP Server - Just Commands

# Default recipe to show available commands
default:
    @just --list

# Build the project
build:
    npm run build

# Start local stdio MCP server (for local Claude Code)
dev:
    npm run start

# Start network SSE server (for remote Claude Code access)
network:
    npm run build && node dist/sse.js

# Start network server with custom port
network-port PORT:
    npm run build && PORT={{PORT}} node dist/sse.js

# Start network server with custom host and port
network-custom HOST PORT:
    npm run build && HOST={{HOST}} PORT={{PORT}} node dist/sse.js

# Test network connectivity
test-network:
    curl -s http://localhost:8429/health | jq .

# Format code with Biome
format:
    npm run format

# Type check
type-check:
    npm run type-check