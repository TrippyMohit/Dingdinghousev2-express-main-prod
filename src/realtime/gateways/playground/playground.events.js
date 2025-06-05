"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Events = void 0;
exports.Events = {
    CLIENT: {
        SPIN_REQUEST: {
            name: "spin:request",
            payload: {},
        },
        GAMBLE_REQUEST: {
            name: "gamble:request",
            payload: {}
        },
        CONFIG_UPDATE: {
            name: "game:config:update",
            payload: {},
        },
        // Add other client events
    },
    SERVER: {
        SPIN_RESULT: {
            name: "spin:result",
            payload: {},
        },
        GAMBLE_RESULT: {
            name: "gamble:result",
            payload: {}
        },
        INIT_DATA: {
            name: "game:init",
            payload: {},
        },
        ERROR: {
            name: "error",
            payload: {},
        },
        CONFIG: {
            name: "game:config",
            payload: {},
        },
    },
};
