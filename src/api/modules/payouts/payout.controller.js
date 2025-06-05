"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutController = void 0;
const http_errors_1 = __importDefault(require("http-errors"));
class PayoutController {
    constructor(payoutService) {
        this.payoutService = payoutService;
        this.createPayout = this.createPayout.bind(this);
        this.activatePayout = this.activatePayout.bind(this);
        this.getPayoutsByGame = this.getPayoutsByGame.bind(this);
        this.getActivePayout = this.getActivePayout.bind(this);
        this.updatePayout = this.updatePayout.bind(this);
        this.deletePayout = this.deletePayout.bind(this);
    }
    // Create a new payout
    async createPayout(req, res, next) {
        try {
            const { gameId, content, version } = req.body;
            const payout = await this.payoutService.createPayout(gameId, content, version);
            res.status(201).json(payout);
        }
        catch (error) {
            next(error);
        }
    }
    // Activate a payout
    async activatePayout(req, res, next) {
        try {
            const { payoutId } = req.params;
            const payout = await this.payoutService.activatePayout(payoutId);
            res.status(200).json(payout);
        }
        catch (error) {
            next(error);
        }
    }
    // Get all payouts for a game
    async getPayoutsByGame(req, res, next) {
        try {
            const { gameId } = req.params;
            const payouts = await this.payoutService.getPayoutByGame(gameId);
            res.status(200).json(payouts);
        }
        catch (error) {
            next(error);
        }
    }
    // Get the active payout for a game
    async getActivePayout(req, res, next) {
        try {
            const { gameId } = req.params;
            const payout = await this.payoutService.getActivePayout(gameId);
            if (!payout) {
                throw http_errors_1.default.NotFound("No active payout found for this game");
            }
            res.status(200).json(payout);
        }
        catch (error) {
            next(error);
        }
    }
    // Update a payout
    async updatePayout(req, res, next) {
        try {
            const { payoutId } = req.params;
            const { content } = req.body;
            const payout = await this.payoutService.updatePayout(payoutId, content);
            res.status(200).json(payout);
        }
        catch (error) {
            next(error);
        }
    }
    // Delete a payout
    async deletePayout(req, res, next) {
        try {
            const { payoutId } = req.params;
            await this.payoutService.deletePayout(payoutId);
            res.status(204).send();
        }
        catch (error) {
            next(error);
        }
    }
}
exports.PayoutController = PayoutController;
