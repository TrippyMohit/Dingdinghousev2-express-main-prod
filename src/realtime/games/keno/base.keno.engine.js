"use strict";
// import { IGame } from "../../../common/types/game.type";
// import { IPayout } from "../../../common/types/payout.type";
// import { GameEngine } from "../game.engine";
// import { KenoGameConfig } from "./base.keno.type";
// export class BaseKenoEngine extends GameEngine<KenoGameConfig> {
//     constructor(game: IGame & { payout: IPayout }) {
//         super(game);
//         console.log("Base Keno Engine Initialized");
//     }
//     protected validateConfig(): void {
//         console.log("Validating Keno game configuration.");
//     }
//     public async init(): Promise<void> {
//         console.log("Initializing Keno game engine.");
//     }
//     protected createConfig(payout: IPayout): KenoGameConfig {
//         console.log("Creating Keno game configuration with payout:", payout);
//         return {
//             gameId: payout.tag,
//             name: payout.name,
//             version: payout.version,
//             isActive: payout.isActive,
//             content:
//                 typeof payout.content === "string"
//                     ? JSON.parse(payout.content)
//                     : payout.content,
//             createdAt: payout.createdAt,
//             updatedAt: payout.updatedAt,
//         } as unknown as KenoGameConfig;
//     }
// }
// export default BaseKenoEngine;
