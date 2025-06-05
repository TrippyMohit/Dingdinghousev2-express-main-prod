"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameManager = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const base_slots_engine_1 = __importDefault(require("./slots/base.slots.engine"));
const game_type_1 = require("./game.type");
const sl_lol_slots_engine_1 = __importDefault(require("./slots/variants/SL-LOL/sl-lol.slots.engine"));
class GameManager {
    constructor() {
        this.gameEngines = new Map();
        this.gameEngineInstances = new Map();
        this.initializeGameEngines();
    }
    initializeGameEngines() {
        this.gameEngines.set(game_type_1.GamesTypes.SLOTS, base_slots_engine_1.default);
        this.gameEngines.set("SL-LOL", sl_lol_slots_engine_1.default);
        ;
        // this.gameEngines.set(GamesTypes.KENO, BaseKenoEngine);
    }
    static getInstance() {
        if (!GameManager.instance) {
            GameManager.instance = new GameManager();
        }
        return GameManager.instance;
    }
    async getGameEngine(game) {
        const gameId = game.payout.gameId.toString();
        if (this.gameEngineInstances.has(gameId)) {
            const existingEngine = this.gameEngineInstances.get(gameId);
            if (existingEngine) {
                return existingEngine;
            }
        }
        const sanitizedGameId = this.sanitizeGameId(game.tag);
        const gameType = GameManager.resolveGameType(sanitizedGameId);
        if (!gameType) {
            throw new Error("Game type could not be resolved.");
        }
        const specialGamesDir = GameManager.getSpecialGamesDir(gameType);
        const filePath = GameManager.findGameFile(specialGamesDir, sanitizedGameId, gameType);
        if (!filePath) {
            console.warn(`Game file not found for ID "${game.tag}"  . Using default.`);
            return this.getDefaultGameEngine(game, gameType);
        }
        const GameClass = GameManager.loadGameClass(filePath, sanitizedGameId);
        if (!GameClass) {
            throw new Error(`Game class for ID "${game.tag}" could not be loaded.`);
        }
        const gameEngine = new GameClass(game);
        this.gameEngineInstances.set(gameId, gameEngine);
        return gameEngine;
    }
    static resolveGameType(gameId) {
        const prefix = gameId.split("-")[0].toUpperCase();
        const gameTypeMapping = {
            SL: game_type_1.GamesTypes.SLOTS,
            KN: game_type_1.GamesTypes.KENO,
        };
        return gameTypeMapping[prefix];
    }
    static getSpecialGamesDir(gameType) {
        return path_1.default.join(__dirname, `../../../src/realtime/games/${gameType}/variants`);
    }
    static findGameFile(baseDir, gameId, gameType) {
        const sanitizedGameId = gameId.replace(/[^a-zA-Z0-9-_]/g, "");
        const possibleFileNames = [
            `${sanitizedGameId.toLowerCase()}.${gameType}.engine.js`,
            `${sanitizedGameId.toLowerCase()}.${gameType}.engine.ts`,
            `engine.ts`
        ];
        if (!fs_1.default.existsSync(baseDir)) {
            console.warn(`Directory does not exist: ${baseDir}`);
            return null;
        }
        for (const fileName of possibleFileNames) {
            const directories = fs_1.default.readdirSync(baseDir, { withFileTypes: true });
            for (const dir of directories) {
                if (dir.isDirectory()) {
                    const filePath = path_1.default.join(baseDir, dir.name, fileName);
                    if (fs_1.default.existsSync(filePath)) {
                        return filePath;
                    }
                }
            }
        }
        console.warn("gone in dir name");
        return null;
    }
    static loadGameClass(filePath, gameId) {
        const sanitizedGameId = gameId.replace(/-/g, "");
        const module = require(filePath);
        return module.default || module[sanitizedGameId];
    }
    getDefaultGameEngine(game, gameType) {
        const defaultGames = {
            [game_type_1.GamesTypes.SLOTS]: () => new base_slots_engine_1.default(game),
            [game_type_1.GamesTypes.KENO]: () => new base_slots_engine_1.default(game),
        };
        const createEngine = defaultGames[gameType];
        if (!createEngine) {
            throw new Error(`No default game engine available for game type: ${gameType}`);
        }
        const engine = createEngine();
        this.gameEngineInstances.set(game.payout.gameId.toString(), engine);
        return engine;
    }
    sanitizeGameId(gameId) {
        return gameId.replace(/[^a-zA-Z0-9-_]/g, "");
    }
    updateGameConfig(game) {
        const gameId = game.payout.gameId.toString();
        const existingEngine = this.gameEngineInstances.get(gameId);
        if (existingEngine) {
            existingEngine.updateConfig(game);
            return existingEngine;
        }
        return null;
    }
}
exports.GameManager = GameManager;
