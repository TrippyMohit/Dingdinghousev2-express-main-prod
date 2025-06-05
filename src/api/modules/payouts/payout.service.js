"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const http_errors_1 = __importDefault(require("http-errors"));
const payout_schema_1 = __importDefault(require("../../../common/schemas/payout.schema"));
const game_schema_1 = __importDefault(require("../../../common/schemas/game.schema"));
class PayoutService {
    async createPayout(gameId, payoutFile, session) {
        if (!payoutFile)
            return null;
        const latestVersion = await this.getLatestPayoutVersion(gameId, session);
        const nextVersion = latestVersion ? latestVersion + 1 : 1;
        // Deactivate all previous payouts for this gameId
        await payout_schema_1.default.updateMany({ gameId, isActive: true }, { $set: { isActive: false } }, { session }).exec();
        // Create new active payout
        const [payout] = await payout_schema_1.default.create([{
                gameId,
                version: nextVersion,
                isActive: true,
                name: payoutFile.filename,
                content: payoutFile.content
            }], { session });
        return payout._id;
    }
    async getLatestPayoutVersion(gameId, session) {
        const latestPayout = await payout_schema_1.default.findOne({ gameId })
            .sort({ version: -1 })
            .select("version")
            .session(session)
            .lean();
        return latestPayout ? latestPayout.version : 0;
    }
    async getPayoutByGame(gameId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(gameId)) {
            throw http_errors_1.default.BadRequest("Invalid game ID");
        }
        const payouts = await payout_schema_1.default.find({ gameId })
            .sort({ version: -1 })
            .lean()
            .exec();
        return payouts;
    }
    async activatePayout(payoutId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(payoutId)) {
            throw http_errors_1.default.BadRequest("Invalid payout ID");
        }
        const session = await mongoose_1.default.startSession();
        try {
            session.startTransaction();
            const payout = await payout_schema_1.default.findById(payoutId).session(session);
            if (!payout)
                throw http_errors_1.default.NotFound("Payout not found");
            // Deactivate all other payouts for the same game
            await payout_schema_1.default.updateMany({ gameId: payout.gameId, _id: { $ne: payout._id } }, { $set: { isActive: false } }, { session }).exec();
            // Activate this payout
            payout.isActive = true;
            await payout.save({ session });
            // Update the Game mode's payout refrence 
            await game_schema_1.default.updateOne({ _id: payout.gameId }, { $set: { payout: payout._id } }, { session }).exec();
            await session.commitTransaction();
            return payout;
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    async deletePayout(payoutId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(payoutId)) {
            throw http_errors_1.default.BadRequest("Invalid payout ID");
        }
        const payout = await payout_schema_1.default.findById(payoutId);
        if (!payout) {
            throw http_errors_1.default.NotFound("Payout not found");
        }
        if (payout.isActive) {
            const payoutCount = await payout_schema_1.default.countDocuments({ gameId: payout.gameId });
            if (payoutCount === 1) {
                throw http_errors_1.default.BadRequest("Cannot delete the only active payout for this game");
            }
        }
        await payout_schema_1.default.findByIdAndDelete(payoutId);
        if (payout.isActive) {
            const latestPayout = await payout_schema_1.default.findOne({ gameId: payout.gameId }).sort({ version: -1 });
            if (latestPayout) {
                await this.activatePayout(latestPayout._id.toString());
            }
        }
    }
    async getActivePayout(gameId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(gameId)) {
            throw http_errors_1.default.BadRequest("Invalid game ID");
        }
        const payout = await payout_schema_1.default.findOne({ gameId, isActive: true });
        return payout;
    }
    async updatePayout(payoutId, content) {
        if (!mongoose_1.default.Types.ObjectId.isValid(payoutId)) {
            throw http_errors_1.default.BadRequest("Invalid payout ID");
        }
        const payout = await payout_schema_1.default.findByIdAndUpdate(payoutId, { content }, { new: true, runValidators: true }).exec();
        if (!payout) {
            throw http_errors_1.default.NotFound("Payout not found");
        }
        return payout;
    }
}
exports.PayoutService = PayoutService;
