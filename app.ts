import express from 'express';
import { createServer } from 'http';
import connectDB from './src/common/config/db';
import { init } from './src/common/system/init';
import api from './src/api';
import { config } from './src/common/config/config';
import realtime from './src/realtime';
import RedisService from './src/common/config/redis';

async function bootstrap() {
    const app = express();
    const httpServer = createServer(app);

    try {
        // Connect to database
        await connectDB();

        // Initialize Redis 
        const redisService = RedisService.getInstance();
        await redisService.connect();
        console.log('Connected to Redis successfully');

        // Run system initialization
        await init();

        // Set up API routes
        api(app);

        // Set up Socket
        const io = realtime(httpServer, redisService);

        // Start server
        const PORT = config.port;
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`API available at http://localhost:${PORT}/api`);
            console.log(`WebSocket available at ws://localhost:${PORT}`);
        });


        // Graceful shutdown
        const shutdown = async () => {
            console.log('Shutting down gracefully...');
            io.close(); // Close Socket.IO first
            await redisService.disconnect();
            httpServer.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

bootstrap().catch(console.error);