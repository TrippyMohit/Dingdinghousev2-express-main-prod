"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const game_engine_1 = require("../game.engine");
const base_bonus_1 = require("./base.bonus");
const base_slots_type_1 = require("./base.slots.type");
class BaseSlotsEngine extends game_engine_1.GameEngine {
    validateConfig() {
        const { matrix, lines, symbols } = this.config.content;
    }
    async handleAction(action) {
        switch (action.type) {
            case "spin":
                return this.handleSpin(action);
            default:
                throw new Error(`Unknown action: ${action.type}`);
        }
    }
    async getInitData(userId) {
        const balance = await this.state.getBalance(userId, this.config.gameId);
        return {
            id: "initData",
            gameData: {
                lines: this.config.content.lines,
                bets: this.config.content.bets,
                spinBonus: this.config.content.features.bonus.payout.map((item) => item.amount)
            },
            uiData: {
                paylines: {
                    symbols: this.config.content.symbols.map((symbol) => ({
                        id: symbol.id,
                        name: symbol.name,
                        multiplier: symbol.multiplier,
                        description: symbol.description,
                    })),
                },
            },
            player: {
                balance,
            },
        };
    }
    async handleSpin(action) {
        try {
            const { userId, payload } = action;
            this.validateSpinPayload(payload);
            //NOTE: freespin checking from state
            let freeSpinCount = await this.state.
                getGameSpecificState(userId, this.config.gameId, "freeSpins") || 0;
            // console.log(`freespin count from state`, freeSpinCount);
            let isFreeSpin = false;
            const totalBetAmount = this.calculateTotalBet(payload.betAmount);
            if (!freeSpinCount || freeSpinCount <= 0) {
                await this.validateAndDeductBalance(userId, totalBetAmount);
            }
            else {
                this.state.setGameSpecificState(userId, this.config.gameId, "freeSpins", freeSpinCount - 1);
            }
            const reels = this.getRandomMatrix();
            const lineWins = this.checkLines(reels);
            const specialFeatures = this.processSpecialFeatures(reels);
            //NOTE: set freespincount
            if (specialFeatures.freeSpinCount && specialFeatures.freeSpinCount > 0) {
                isFreeSpin = true;
                this.state.setGameSpecificState(userId, this.config.gameId, "freeSpins", freeSpinCount + specialFeatures.freeSpinCount);
            }
            specialFeatures.freeSpinCount = freeSpinCount + specialFeatures.freeSpinCount;
            // console.log("final freespin ", specialFeatures.freeSpinCount);
            const totalWinAmount = this.calculateTotalWinAmount(lineWins, specialFeatures, payload.betAmount);
            if (totalWinAmount > 0) {
                await this.creditWinnings(userId, totalWinAmount * this.config.content.bets[payload.betAmount]);
            }
            const newBalance = await this.state.getBalance(userId, this.config.gameId);
            return this.buildSpinResponse(reels, lineWins, specialFeatures, totalWinAmount, newBalance, payload.betAmount, isFreeSpin);
        }
        catch (error) {
            console.error(`Error processing spin for user`, error);
            throw error;
        }
    }
    validateSpinPayload(payload) {
        if (payload.betAmount > this.config.content.bets.length - 1) {
            throw new Error("Invalid bet amount");
        }
        if (this.config.content.bets[payload.betAmount] <= 0) {
            throw new Error("Something went wrong");
        }
    }
    calculateTotalBet(betAmountIndex) {
        return this.config.content.bets[betAmountIndex] * this.config.content.lines.length;
    }
    async validateAndDeductBalance(userId, totalBetAmount) {
        const balance = await this.state.getBalance(userId, this.config.gameId);
        if (balance < totalBetAmount) {
            throw new Error("Balance is low");
        }
        await this.state.deductBalanceWithDbSync(userId, this.config.gameId, totalBetAmount);
    }
    processSpecialFeatures(reels) {
        const specialSymbols = this.checkForSpecialSymbols(reels);
        const features = {
            isJackpot: false,
            bonusResult: -1,
            freeSpinCount: 0,
            scatter: 0,
            specialSymbols
        };
        specialSymbols.forEach(symbol => {
            const symbolConfig = this.getSymbolConfig(symbol.symbol);
            const minCount = symbolConfig?.minSymbolCount || 0;
            if (symbol.symbolName === base_slots_type_1.specialIcons.bonus && symbol.count >= minCount) {
                const { BonusStopIndex } = (0, base_bonus_1.calculateSpinBonus)(this.config.content.features.bonus.payout);
                features.bonusResult = BonusStopIndex;
            }
            if (symbol.symbolName === base_slots_type_1.specialIcons.jackpot && symbol.count >= minCount) {
                features.isJackpot = true;
            }
            if (symbol.symbolName === base_slots_type_1.specialIcons.FreeSpin && symbol.count >= minCount) {
                if (symbol.count > 5) {
                    features.freeSpinCount = symbolConfig?.multiplier[0] ?? 0;
                }
                else {
                    features.freeSpinCount = symbolConfig?.multiplier[5 - symbol.count] ?? 0;
                }
            }
            if (symbol.symbolName === base_slots_type_1.specialIcons.scatter && symbol.count >= minCount) {
                if (symbol.count > 5) {
                    features.scatter = symbolConfig?.multiplier[0] ?? 0;
                }
                else {
                    features.scatter = symbolConfig?.multiplier[5 - symbol.count] ?? 0;
                }
            }
        });
        return features;
    }
    calculateTotalWinAmount(lineWins, specialFeatures, betAmountIndex) {
        const lineWinAmount = this.accumulateWins(lineWins);
        const bonusAmount = specialFeatures.bonusResult >= 0
            ? this.config.content.features.bonus.payout[specialFeatures.bonusResult]?.amount || 0
            : 0;
        const jackpotAmount = specialFeatures.isJackpot
            ? this.config.content.features.jackpot.defaultAmount
            : 0;
        const scatterAmount = specialFeatures.scatter > 0
            ? specialFeatures.scatter
            : 0;
        return lineWinAmount + bonusAmount + jackpotAmount + scatterAmount;
    }
    async creditWinnings(userId, totalWinAmount) {
        await this.state.creditBalanceWithDbSync(userId, this.config.gameId, totalWinAmount);
    }
    buildSpinResponse(reels, lineWins, specialFeatures, totalWinAmount, newBalance, betAmountIndex, isFreeSpin) {
        const betMultiplier = this.config.content.bets[betAmountIndex];
        const features = this.buildFeatureResponse(specialFeatures, betMultiplier, isFreeSpin);
        const spinResult = {
            id: "ResultData",
            payload: {
                winAmount: totalWinAmount * betMultiplier,
                wins: lineWins.map((win) => {
                    const lineIndex = win.line[0] - 1;
                    const winningSymbolsInfo = this.getWinningSymbolsInfo(win.symbols, lineIndex);
                    return {
                        line: lineIndex,
                        positions: winningSymbolsInfo.positions,
                        amount: win.amount * betMultiplier,
                    };
                }),
            },
            ...(features || {}),
        };
        return {
            success: true,
            matrix: reels,
            ...spinResult,
            player: {
                balance: newBalance,
            },
        };
    }
    buildFeatureResponse(specialFeatures, betMultiplier, isFreeSpin) {
        return {
            bonus: {
                BonusSpinStopIndex: specialFeatures.bonusResult,
                amount: specialFeatures.bonusResult >= 0
                    ? (this.config.content.features.bonus.payout[specialFeatures.bonusResult]?.amount || 0) * betMultiplier
                    : 0
            },
            jackpot: {
                isTriggered: specialFeatures.isJackpot,
                amount: specialFeatures.isJackpot
                    ? this.config.content.features.jackpot.defaultAmount * betMultiplier
                    : 0
            },
            freeSpin: {
                count: specialFeatures.freeSpinCount,
                isFreeSpin: isFreeSpin,
            },
            scatter: {
                amount: specialFeatures.scatter * betMultiplier,
            }
        };
    }
    getWinningSymbolsInfo(symbols, lineIndex) {
        const wildSymbol = this.getWildSymbolId();
        const paySymbol = symbols.find((s) => s !== wildSymbol) || symbols[0];
        const winningSymbols = [];
        const winningPositions = [];
        for (let i = 0; i < symbols.length; i++) {
            if (symbols[i] === paySymbol || symbols[i] === wildSymbol) {
                winningSymbols.push(symbols[i]);
                winningPositions.push(i);
            }
            else {
                break;
            }
        }
        return {
            symbols: winningSymbols,
            positions: winningPositions,
        };
    }
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    getRandomMatrix() {
        const matrix = this.generateFullReels();
        const resultMatrix = this.extractVisibleSegments(matrix);
        return this.transposeMatrix(resultMatrix);
    }
    generateFullReels() {
        const matrix = [];
        for (let i = 0; i < this.config.content.matrix.x; i++) {
            const row = [];
            this.config.content.symbols.forEach((symbol) => {
                for (let j = 0; j < symbol.reelsInstance[i]; j++) {
                    row.push(symbol.id.toString());
                }
            });
            matrix.push(this.shuffleArray([...row]));
        }
        return matrix;
    }
    extractVisibleSegments(matrix) {
        const resultMatrix = [];
        for (let i = 0; i < matrix.length; i++) {
            const reel = matrix[i];
            const visibleSymbols = [];
            const startIdx = Math.floor(Math.random() * (reel.length - this.config.content.matrix.y));
            for (let j = 0; j < this.config.content.matrix.y; j++) {
                visibleSymbols.push(reel[(startIdx + j) % reel.length]);
            }
            resultMatrix.push(visibleSymbols);
        }
        return resultMatrix;
    }
    transposeMatrix(matrix) {
        return matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));
    }
    checkLines(matrix) {
        const results = [];
        this.config.content.lines.forEach((line, lineIndex) => {
            const values = line.map((rowIndex, colIndex) => matrix[rowIndex][colIndex]);
            const lineResult = this.checkLineSymbols(values, line);
            if (lineResult.count >= 3) {
                results.push({
                    line: [lineIndex + 1],
                    symbols: values,
                    amount: lineResult.win,
                });
            }
        });
        return results;
    }
    checkLineSymbols(values, line) {
        const wildSymbol = this.getWildSymbolId();
        let paySymbol = null;
        let count = 1;
        if (values[0] === wildSymbol) {
            paySymbol = this.findPayingSymbolAfterWild(values, wildSymbol);
            if (!paySymbol) {
                return { count: 0, win: 0 };
            }
            count = this.getWildSequenceCount(values, paySymbol, wildSymbol);
        }
        else {
            const firstSymbol = this.getSymbolConfig(values[0]);
            if (!firstSymbol?.useWildSub) {
                return { count: 0, win: 0 };
            }
            paySymbol = values[0];
        }
        count = this.countMatchingSymbols(values, paySymbol, wildSymbol, count);
        const winAmount = this.calculateLineWin(paySymbol, count);
        return { count, win: winAmount };
    }
    getWildSymbolId() {
        return this.config.content.symbols
            .find((s) => s.name === "Wild")
            ?.id.toString() ?? "";
    }
    getSymbolConfig(symbolId) {
        return this.config.content.symbols.find((s) => s.id.toString() === symbolId);
    }
    findPayingSymbolAfterWild(values, wildSymbol) {
        for (let i = 1; i < values.length; i++) {
            if (values[i] !== wildSymbol) {
                const symbol = this.getSymbolConfig(values[i]);
                if (symbol?.useWildSub) {
                    return values[i];
                }
                break;
            }
        }
        return null;
    }
    getWildSequenceCount(values, paySymbol, wildSymbol) {
        let count = 0;
        for (let i = 0; i < values.length; i++) {
            if (values[i] === wildSymbol || values[i] === paySymbol) {
                count++;
            }
            else {
                break;
            }
        }
        return count;
    }
    countMatchingSymbols(values, paySymbol, wildSymbol, startCount) {
        let count = startCount;
        for (let i = startCount; i < values.length; i++) {
            if (values[i] === paySymbol || values[i] === wildSymbol) {
                count++;
            }
            else {
                break;
            }
        }
        return count;
    }
    calculateLineWin(paySymbol, count) {
        if (count < 3)
            return 0;
        const symbol = this.getSymbolConfig(paySymbol);
        if (!symbol)
            return 0;
        const multiplierIndex = this.config.content.matrix.x - count;
        return symbol.multiplier[multiplierIndex] || 0;
    }
    checkForSpecialSymbols(matrix) {
        const symbolCounts = this.countAllSymbols(matrix);
        const specialSymbols = [];
        for (const [symbolId, count] of symbolCounts) {
            const symbolConfig = this.getSymbolConfig(symbolId);
            if (!symbolConfig || symbolConfig.useWildSub || !symbolConfig.enabled)
                continue;
            const minCount = symbolConfig.minSymbolCount || 0;
            if (count < minCount)
                continue;
            const result = {
                symbol: symbolId,
                symbolName: symbolConfig.name,
                count,
            };
            const wins = this.calculateSpecialWins(symbolConfig, count);
            Object.assign(result, wins);
            specialSymbols.push(result);
        }
        return specialSymbols;
    }
    countAllSymbols(matrix) {
        const counts = new Map();
        matrix.flat().forEach(symbolId => {
            counts.set(symbolId, (counts.get(symbolId) || 0) + 1);
        });
        return counts;
    }
    calculateSpecialWins(symbolConfig, count) {
        const minCount = symbolConfig.minSymbolCount || 0;
        const multiplierIndex = count - minCount;
        switch (symbolConfig.name) {
            case base_slots_type_1.specialIcons.scatter:
                return {
                    specialWin: symbolConfig.multiplier?.[multiplierIndex] || 0,
                    freeSpinCount: 0
                };
            case base_slots_type_1.specialIcons.jackpot:
                return {
                    specialWin: symbolConfig.defaultAmount || 0,
                    freeSpinCount: 0
                };
            case base_slots_type_1.specialIcons.scatter:
                return {
                    specialWin: symbolConfig.multiplier?.[multiplierIndex] || 0,
                };
            case base_slots_type_1.specialIcons.FreeSpin:
                const freeSpins = symbolConfig.multiplier?.[multiplierIndex] || 0;
                return {
                    specialWin: freeSpins,
                    freeSpinCount: freeSpins
                };
            default:
                return {};
        }
    }
    accumulateWins(wins) {
        return wins.reduce((acc, win) => acc + win.amount, 0);
    }
}
exports.default = BaseSlotsEngine;
