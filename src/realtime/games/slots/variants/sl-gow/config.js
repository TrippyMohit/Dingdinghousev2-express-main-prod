"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameDefinition = void 0;
// src/modules/games/god-of-wealth/config.ts
const zod_1 = require("zod");
const config_demo_1 = require("./config.demo");
const symbolSchema = zod_1.z.object({
    Name: zod_1.z.string(),
    Id: zod_1.z.number(),
    reelInstance: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
    useWildSub: zod_1.z.boolean(),
    multiplier: zod_1.z.array(zod_1.z.array(zod_1.z.number())).optional(),
    description: zod_1.z.string().optional(),
});
const gameDefinitionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    matrix: zod_1.z.object({ x: zod_1.z.number(), y: zod_1.z.number() }),
    bets: zod_1.z.array(zod_1.z.number()),
    paylines: zod_1.z.array(zod_1.z.array(zod_1.z.number())),
    featureAllMult: zod_1.z.array(zod_1.z.number()),
    freeSpinConfig: zod_1.z.object({
        goldColCountProb: zod_1.z.array(zod_1.z.number()),
        goldColProb: zod_1.z.array(zod_1.z.number()),
    }),
    Symbols: zod_1.z.array(symbolSchema),
});
// Validate the game definition
const parsedResult = gameDefinitionSchema.safeParse(JSON.parse(config_demo_1.staticData));
if (!parsedResult.success) {
    throw new Error(`Validation failed: ${parsedResult.error}`);
}
exports.gameDefinition = parsedResult.data;
