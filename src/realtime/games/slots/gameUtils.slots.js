"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shuffleArray = shuffleArray;
exports.generateRandomNumber = generateRandomNumber;
exports.generatelcgRandomNumbers = generatelcgRandomNumbers;
exports.cryptoRng = cryptoRng;
exports.generatetrueRandomNumber = generatetrueRandomNumber;
const crypto_1 = __importDefault(require("crypto"));
function shuffleArray(array) {
    // List of RNG functions
    const rngFunctions = [
        (max) => generateRandomNumber(Date.now(), max), // RNG1
        (max) => chaoticRandom(generateUniqueSeed()) * max, // RNG2
        (max) => generatelcgRandomNumbers(generateUniqueSeed(), max), // RNG3
        (max) => generatetrueRandomNumber(max) // RNG4
    ];
    for (let i = array.length - 1; i > 0; i--) {
        const rngIndex = Math.floor(Math.random() * rngFunctions.length);
        const rngFunction = rngFunctions[rngIndex];
        const j = Math.floor(rngFunction(i + 1));
        // Swap elements at index i and j
        [array[i], array[j]] = [array[j], array[i]];
    }
    // Return the shuffled array
    return array;
}
// RNG1
function newtonRng(seed, maxIterations = 10) {
    let x = seed;
    const constant = 71;
    const epsilon = 1e-10;
    for (let i = 0; i < maxIterations; i++) {
        let fx = Math.sin(x * x) - constant;
        let fpx = 2 * x * Math.cos(x);
        let nextX = x - fx / (fpx + epsilon);
        if (Math.abs(nextX - x) < epsilon) {
            break;
        }
        x = nextX + Math.random();
    }
    return Math.abs(x % 1);
}
function generateBetRng(seed, number, maxIterations = 20) {
    const randomValue = newtonRng(seed, maxIterations);
    return Math.floor(randomValue * number);
}
function generateRandomNumber(seed, number) {
    let randomNum = generateBetRng(seed, number);
    seed = (seed * Math.random() * Math.sin(seed) + Date.now()) % (1e10 * Math.random()) + Math.random();
    return randomNum;
}
// RNG2
function chaoticRandom(seed) {
    const noise = Math.sin(seed) * 10000;
    const randomValue = (Math.random() + noise) % 1;
    return Math.abs(randomValue);
}
// RNG3 - LCG
function lcg(seed) {
    const a = 1664525;
    const c = 1013904223;
    const m = Math.pow(2, 32);
    seed = (a * seed + c) % m;
    return seed / m;
}
function generatelcgRandomNumbers(seed, count) {
    seed = Math.abs(seed + Math.random() * 1000);
    const randomValue = lcg(seed >>> 0);
    const randomNumber = Math.round(randomValue * count);
    return randomNumber;
}
// RNG4 - CRYPTO-BASED RNG
function cryptoRng() {
    // Generate 4 random bytes (32 bits)
    const randomBytes = crypto_1.default.randomBytes(4);
    // Convert to a 32-bit unsigned integer (0 to 2^32-1)
    const randomValue = randomBytes.readUInt32BE(0);
    // Convert to a float between 0 (inclusive) and 1 (exclusive)
    return randomValue / 0x100000000;
}
function generatetrueRandomNumber(max) {
    const randomNumber = trueRandom(0, max);
    return randomNumber;
}
function trueRandom(min, max) {
    const randomBytes = crypto_1.default.randomBytes(4);
    const randomValue = randomBytes.readUInt32BE(0);
    return min + (randomValue % (max - min));
}
function generateUniqueSeed() {
    return Math.floor(Date.now() * Math.random() + performance.now());
}
