"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const payout_controller_1 = require("./payout.controller");
const payout_service_1 = require("./payout.service");
const payoutRouter = express_1.default.Router();
const payoutController = new payout_controller_1.PayoutController(new payout_service_1.PayoutService());
payoutRouter.post("/", payoutController.createPayout);
payoutRouter.patch("/:payoutId/activate", payoutController.activatePayout);
payoutRouter.get("/game/:gameId", payoutController.getPayoutsByGame);
payoutRouter.get("/game/:gameId/active", payoutController.getActivePayout);
payoutRouter.patch("/:payoutId", payoutController.updatePayout);
payoutRouter.delete("/:payoutId", payoutController.deletePayout);
exports.default = payoutRouter;
