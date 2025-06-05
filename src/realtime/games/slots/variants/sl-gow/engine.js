"use strict";
// src/modules/games/god-of-wealth/engine.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.spin = spin;
const paylines_LTRTL_1 = require("../../common/paylines.LTRTL");
const weightedPick_1 = require("../../common/weightedPick");
/**
 * Performs one spin:
 * - Generates a full result matrix [rows][cols]
 * - Evaluates paylines
 * - Calculates payout
 * - Determines free-spin awards, goldWild columns, featureAll triggers
 * - Returns both the SpinResult and a delta to apply to PlayerGameState
 */
function spin(def, ctx, state) {
    const { matrix, Symbols, paylines, featureAllMult, freeSpinConfig } = def;
    const { x: cols, y: rows } = matrix;
    // 1. Build the result matrix (rows × cols)
    const result = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (let col = 0; col < cols; col++) {
        // Build a weighted pool for this reel (column)
        const pool = [];
        Symbols.forEach((sym) => {
            const weight = sym.reelInstance[String(col)] ?? 0;
            for (let i = 0; i < weight; i++)
                pool.push(sym.Id);
        });
        // Pick one symbol from the pool
        const pickedId = (0, weightedPick_1.getRandomFromProbability)(pool, ctx.rng);
        // **Simple stub**: fill the entire column with the same symbol
        for (let row = 0; row < rows; row++) {
            result[row][col] = pickedId;
        }
    }
    /*
     *
    protected getRandomMatrix(): string[][] {
      const matrix: string[][] = [];
      const resultMatrix: string[][] = [];
  
      // First create and shuffle the full reels
      for (let i = 0; i < this.config.content.matrix.x; i++) {
        const row: string[] = [];
  
        // Fill row with symbols based on reelsInstance
        this.config.content.symbols.forEach((symbol) => {
          for (let j = 0; j < symbol.reelsInstance[i]; j++) {
            row.push(symbol.id.toString());
          }
        });
  
        // Shuffle the row before adding to matrix
        const shuffledRow = this.shuffleArray([...row]);
        matrix.push(shuffledRow);
      }
  
      // Now get random visible segments from each reel
      for (let i = 0; i < matrix.length; i++) {
        const reel = matrix[i];
        const visibleSymbols: string[] = [];
  
        // Get random starting index
        const startIdx = Math.floor(
          Math.random() * (reel.length - this.config.content.matrix.y)
        );
  
        // Get Y consecutive symbols from the random starting point
        for (let j = 0; j < this.config.content.matrix.y; j++) {
          visibleSymbols.push(reel[(startIdx + j) % reel.length]);
        }
  
        resultMatrix.push(visibleSymbols);
      }
  
      return resultMatrix[0].map((_, colIndex) =>
        matrix.map((row) => row[colIndex])
      );
    }
     * */
    // 2. Evaluate which paylines hit
    const paylinesHit = (0, paylines_LTRTL_1.evaluatePaylines)(result, paylines);
    console.log("paylinehit", paylinesHit);
    // 3. Calculate raw payout
    let payout = 0;
    for (const line of paylinesHit) {
        // TODO: lookup symbol multipliers from `def.Symbols` & `featureAllMult`
        // e.g. const symId = result[line[0]][0]; const symDef = def.Symbols.find(s=>s.Id===symId)!
        // payout += symDef.multiplier[lineLength-1] * ctx.bet;
    }
    // 4. Handle free spins / featureAll / goldWild logic
    let awardedFreeSpins = 0;
    let newIsFreeSpin = state.isFreeSpin;
    let newIsTriggered = state.isTriggered;
    let newFreeSpinCount = state.freeSpinCount;
    let newFeatureAll = state.featureAll;
    let newGoldWildCols = state.goldWildCols || [];
    // TODO: use `freeSpinConfig.goldColCountProb` & `freeSpinConfig.goldColProb`
    // TODO: detect Scatter hits → increment free spins
    // TODO: detect Feature All trigger → set `newFeatureAll = true`
    // TODO: detect GoldWild unfold → update `newGoldWildCols`
    // 5. Build deltaState
    const deltaState = {
        totalBet: (state.totalBet || 0) + ctx.bet,
        // totalPayout: (state.ha || 0) + payout,
        currentWining: payout,
        haveWon: state.haveWon || 0,
        isFreeSpin: newIsFreeSpin,
        isTriggered: newIsTriggered,
        freeSpinCount: newFreeSpinCount,
        featureAll: newFeatureAll,
        goldWildCols: newGoldWildCols,
    };
    return {
        symbolMatrix: result,
        paylinesHit,
        payout,
        awardedFreeSpins,
        deltaState,
    };
}
