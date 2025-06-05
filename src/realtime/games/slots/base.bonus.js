"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkSpinBonus = checkSpinBonus;
exports.calculateSpinBonus = calculateSpinBonus;
const weightedPick_1 = require("./common/weightedPick");
const gameUtils_slots_1 = require("./gameUtils.slots");
/**
 * Checks if the number of bonus symbols in the matrix meets or exceeds the minimum required count.
 * @param count - The minimum number of bonus symbols required.
 * @param matrix - The slot matrix to check, represented as a 2D array of strings.
 * @param bonusSymbol - The symbol representing the bonus.
 * @returns True if the count of bonus symbols is greater than or equal to the required count, otherwise false.
 */
function checkSpinBonus(count, matrix, bonusSymbol) {
    if (count === undefined || count === null || count < 0) {
        console.error("Bonus feature minSymbolCount is invalid in spin bonus check");
        return false;
    }
    let found = 0;
    matrix.forEach((row) => {
        row.forEach((symbol) => {
            if (symbol === bonusSymbol) {
                found++;
            }
        });
    });
    return found >= count;
}
/**
 * Calculates the bonus stop index based on the payout probabilities.
 * @param payout - An array of payout objects, each containing a probability.
 * @returns An object containing the randomly selected bonus stop index.
 */
function calculateSpinBonus(payout) {
    let pool = [];
    payout.forEach((item) => {
        pool.push(item.probability);
    });
    return {
        BonusStopIndex: (0, weightedPick_1.getRandomFromProbability)(pool, gameUtils_slots_1.cryptoRng) - 1
    };
}
