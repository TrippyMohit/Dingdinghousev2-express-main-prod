"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupControl = setupControl;
function setupControl(namespace) {
    namespace.on('connection', (socket) => {
        console.log(`Connected to control : ${socket.id}`);
        // Register event listeners
    });
}
