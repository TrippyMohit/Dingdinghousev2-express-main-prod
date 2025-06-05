"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sse_events_1 = require("../../../common/lib/sse.events");
class SSEController {
    constructor() {
        this.sseHanler = async (req, res, next) => {
            try {
                const authReq = req;
                const userId = authReq.requestingUser._id.toString();
                // Set headers to prevent connection timeout and properly enable SSE
                res.writeHead(200, {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache, no-transform",
                    Connection: "keep-alive",
                    "X-Accel-Buffering": "no", // For Nginx proxy buffering
                    "Access-Control-Allow-Origin": req.headers.origin || "*", // Important for CORS
                    "Access-Control-Allow-Credentials": "true", // Important for credentials
                });
                // Set headers to prevent connection timeout
                req.socket.setTimeout(0);
                req.socket.setNoDelay(true);
                req.socket.setKeepAlive(true);
                // Add client to SSE manager
                const sseManager = sse_events_1.SSEClientManager.getInstance();
                await sseManager.addClient(userId, res);
                // Handle client disconnection
                req.on("close", () => {
                    sseManager.removeClient(userId);
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.sseStatsHandler = (req, res) => {
            const sseManager = sse_events_1.SSEClientManager.getInstance();
            res.json({
                connectedClients: sseManager.getClientCount(),
                serverTime: new Date().toISOString(),
            });
        };
    }
}
exports.default = SSEController;
