"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameService = void 0;
const http_errors_1 = __importDefault(require("http-errors"));
const mongoose_1 = __importDefault(require("mongoose"));
const uuid_1 = require("uuid");
const cloudinary_1 = require("../../../common/config/cloudinary");
const payout_service_1 = require("../payouts/payout.service");
const game_schema_1 = __importDefault(require("../../../common/schemas/game.schema"));
const game_type_1 = require("../../../common/types/game.type");
const config_1 = require("../../../common/config/config");
const redis_1 = __importDefault(require("../../../common/config/redis"));
const crypto_1 = require("crypto");
class GameService {
    constructor() {
        this.cloudinaryService = new cloudinary_1.CloudinaryService();
        this.payoutService = new payout_service_1.PayoutService();
        this.redisService = redis_1.default.getInstance();
    }
    async getNextGameOrder() {
        const lastGame = await game_schema_1.default.findOne()
            .sort({ order: -1 })
            .select("order")
            .lean()
            .exec();
        return lastGame ? lastGame.order + 1 : 1;
    }
    async createGame(gameData, thumbnailBuffer, payout) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            // 1. Check existing game
            const existingGame = await game_schema_1.default.findOne({
                $or: [{ name: gameData.name }, { tag: gameData.tag }],
                status: { $ne: game_type_1.GameStatus.DELETED },
            })
                .select("_id")
                .lean()
                .session(session);
            if (existingGame) {
                throw http_errors_1.default.Conflict("Game name or tag already exists");
            }
            // 2. Create initial game without thumbnail
            const game = await game_schema_1.default.create([
                {
                    ...gameData,
                },
            ], { session });
            // 3. Create payout if provided
            const payoutId = payout
                ? await this.payoutService.createPayout(game[0]._id, payout, session)
                : null;
            // 4. Upload thumbnail
            const thumbnailUploadResult = await this.cloudinaryService.uploadImage(thumbnailBuffer);
            // 5. Update game with thumbnail and payout
            const updatedGame = await game_schema_1.default.findByIdAndUpdate(game[0]._id, {
                thumbnail: thumbnailUploadResult.secure_url,
                ...(payoutId && { payout: payoutId }),
            }, { session, returnDocument: "after" });
            if (!updatedGame) {
                throw http_errors_1.default.NotFound("Game not found");
            }
            await session.commitTransaction();
            return updatedGame;
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    async getGames(filters, options) {
        const { search, from, to, status, type, category, tag, ...otherFilters } = filters;
        const query = {
            status: { $ne: game_type_1.GameStatus.DELETED },
            ...otherFilters,
        };
        // Add date range filtering
        if (from || to) {
            query.createdAt = {};
            if (from)
                query.createdAt.$gte = new Date(from);
            if (to)
                query.createdAt.$lte = new Date(to);
        }
        // Add status filter
        if (status) {
            query.status = status;
        }
        // Add search functionality
        if (search) {
            const searchRegex = new RegExp(search, "i");
            query.$or = [
                { name: searchRegex },
                { description: searchRegex },
                { type: searchRegex },
                { category: searchRegex },
                { tag: searchRegex },
            ];
        }
        // Add specific filters
        if (type)
            query.type = type;
        if (category)
            query.category = category;
        if (tag)
            query.tag = tag;
        const [games, total, distinctValues] = await Promise.all([
            game_schema_1.default.find(query)
                .sort(options.sort)
                .skip((options.page - 1) * options.limit)
                .limit(options.limit)
                .lean(),
            game_schema_1.default.countDocuments(query),
            Promise.all([
                game_schema_1.default.distinct("category", { status: { $ne: game_type_1.GameStatus.DELETED } }),
                game_schema_1.default.distinct("type", { status: { $ne: game_type_1.GameStatus.DELETED } }),
            ]),
        ]);
        const [categories, types] = distinctValues;
        return {
            data: games,
            meta: {
                total,
                page: options.page,
                limit: options.limit,
                pages: Math.ceil(total / options.limit),
                filters: {
                    categories,
                    types,
                },
            },
        };
    }
    async getGame({ id, tag, slug, name, }) {
        const filter = { status: { $ne: game_type_1.GameStatus.DELETED } };
        if (id) {
            if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
                throw http_errors_1.default.BadRequest("Invalid game ID format");
            }
            filter._id = id;
        }
        else if (tag) {
            filter.tag = tag;
        }
        else if (slug) {
            filter.slug = slug;
        }
        else if (name) {
            filter.name = { $regex: new RegExp(`^${name}$`, "i") }; // Case-insensitive exact match
        }
        else {
            throw http_errors_1.default.BadRequest("At least one identifier (id, tag, slug, name) is required");
        }
        const game = await game_schema_1.default.findOne(filter)
            .populate("payout")
            .lean()
            .exec();
        if (!game)
            throw http_errors_1.default.NotFound("Game not found");
        return game;
    }
    async updateGame(id, updateData, thumbnailBuffer, payout) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            // 1. First check if game exists
            const existingGame = await game_schema_1.default.findById(id)
                .populate("payout")
                .session(session);
            if (!existingGame) {
                throw http_errors_1.default.NotFound("Game not found");
            }
            // 2. Check for duplicates if name or tag is being updated
            if (updateData.name || updateData.tag) {
                const duplicate = await game_schema_1.default.findOne({
                    _id: { $ne: id },
                    $or: [
                        ...(updateData.name ? [{ name: updateData.name }] : []),
                        ...(updateData.tag ? [{ tag: updateData.tag }] : []),
                    ],
                }).session(session);
                if (duplicate) {
                    throw http_errors_1.default.Conflict("Game name or tag already exists");
                }
            }
            // 3. Handle payout update if provided
            if (payout && payout.content && payout.filename) {
                const newPayoutId = await this.payoutService.createPayout(existingGame._id, payout, session);
                if (newPayoutId) {
                    updateData.payout = newPayoutId;
                }
            }
            // 4. Handle thumbnail if provided
            if (thumbnailBuffer) {
                const uploadResult = await this.cloudinaryService.uploadImage(thumbnailBuffer);
                updateData.thumbnail = uploadResult.secure_url;
            }
            // 5. Update game with all changes
            const updatedGame = await game_schema_1.default.findByIdAndUpdate(id, { $set: updateData }, {
                new: true,
                runValidators: true,
                session,
            });
            if (!updatedGame) {
                throw http_errors_1.default.NotFound("Game not found");
            }
            await session.commitTransaction();
            return updatedGame;
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    async deleteGame(id) {
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            throw http_errors_1.default.BadRequest("Invalid game ID format");
        }
        const game = await game_schema_1.default.findById(id).select("status name tag").exec();
        if (!game)
            throw http_errors_1.default.NotFound("Game not found");
        if (game.status === game_type_1.GameStatus.DELETED) {
            throw http_errors_1.default.Conflict("Game already deleted");
        }
        // Update with deletion details
        const result = await game_schema_1.default.updateOne({ _id: id }, {
            $set: {
                status: game_type_1.GameStatus.DELETED,
                deletedAt: new Date(),
                name: `${game.name}_deleted_${Date.now()}`,
                tag: `${game.tag}_deleted_${Date.now()}`,
            },
        }).exec();
        if (result.matchedCount === 0) {
            throw http_errors_1.default.NotFound("Game not found");
        }
    }
    async getGamePayouts(gameId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(gameId)) {
            throw http_errors_1.default.BadRequest("Invalid game ID format");
        }
        const game = await game_schema_1.default.findById(gameId).lean();
        if (!game)
            throw http_errors_1.default.NotFound("Game not found");
        return await this.payoutService.getPayoutByGame(gameId);
    }
    async activateGamePayout(gameId, payoutId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(gameId) ||
            !mongoose_1.default.Types.ObjectId.isValid(payoutId)) {
            throw http_errors_1.default.BadRequest("Invalid game or payout ID format");
        }
        const game = await game_schema_1.default.findById(gameId).lean();
        if (!game)
            throw http_errors_1.default.NotFound("Game not found");
        return await this.payoutService.activatePayout(payoutId);
    }
    async deleteGamePayout(gameId, payoutId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(gameId) ||
            !mongoose_1.default.Types.ObjectId.isValid(payoutId)) {
            throw http_errors_1.default.BadRequest("Invalid game or payout ID format");
        }
        const game = await game_schema_1.default.findById(gameId).lean();
        if (!game)
            throw http_errors_1.default.NotFound("Game not found");
        return await this.payoutService.deletePayout(payoutId);
    }
    async reorderGames(reorderData) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            // Validate all IDs first
            const invalidIds = reorderData.filter(({ gameId }) => !mongoose_1.default.Types.ObjectId.isValid(gameId));
            if (invalidIds.length > 0) {
                throw http_errors_1.default.BadRequest(`Invalid game IDs: ${invalidIds.map((i) => i.gameId).join(", ")}`);
            }
            // Verify all games exist
            const gameIds = reorderData.map((item) => item.gameId);
            const existingGames = await game_schema_1.default.find({ _id: { $in: gameIds } })
                .select("_id")
                .session(session);
            if (existingGames.length !== gameIds.length) {
                const missingIds = gameIds.filter((id) => !existingGames.find((game) => game._id.toString() === id));
                throw http_errors_1.default.NotFound(`Games not found: ${missingIds.join(", ")}`);
            }
            // Perform bulk update
            const bulkOps = reorderData.map(({ gameId, order }) => ({
                updateOne: {
                    filter: { _id: gameId },
                    update: { $set: { order } },
                },
            }));
            await game_schema_1.default.bulkWrite(bulkOps, { session });
            await session.commitTransaction();
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    async uploadGames(games) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        const result = {
            total: games.length,
            created: 0,
            skipped: 0,
            errors: [],
        };
        try {
            for (const game of games) {
                try {
                    const existingGame = await game_schema_1.default.findOne({
                        $or: [{ name: game.name }, { tag: game.tag }],
                    }).session(session);
                    if (existingGame) {
                        result.skipped++;
                        result.errors.push(`Game ${game.name} already exists`);
                        continue;
                    }
                    const order = await this.getNextGameOrder();
                    // Create game without payout first
                    const createdGame = await game_schema_1.default.create([
                        {
                            name: game.name,
                            description: game.description,
                            url: game.url,
                            type: game.type,
                            category: game.category,
                            status: game.status || game_type_1.GameStatus.ACTIVE,
                            tag: game.tag,
                            slug: game.slug,
                            thumbnail: game.thumbnail,
                            order,
                        },
                    ], { session });
                    // Handle payout if exists
                    if (game.payout) {
                        const payoutId = await this.payoutService.createPayout(createdGame[0]._id, {
                            content: game.payout.content,
                            filename: game.payout.name,
                        }, session);
                        // Update game with payout reference
                        await game_schema_1.default.findByIdAndUpdate(createdGame[0]._id, { payout: payoutId }, { session });
                    }
                    result.created++;
                }
                catch (error) {
                    if (error instanceof Error) {
                        result.errors.push(`Failed to import ${game.name}: ${error.message}`);
                    }
                    else {
                        result.errors.push(`Failed to import ${game.name}: Unknown error`);
                    }
                    result.skipped++;
                }
            }
            await session.commitTransaction();
            return result;
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    async downloadGames() {
        const games = await game_schema_1.default.find({ status: { $ne: game_type_1.GameStatus.DELETED } })
            .populate("payout")
            .sort({ order: 1, createdAt: -1 })
            .lean()
            .exec();
        return games;
    }
    async playGame(platformToken, slug) {
        try {
            const filter = {
                slug: slug,
                status: { $ne: game_type_1.GameStatus.DELETED },
            };
            const game = await game_schema_1.default.findOne(filter)
                .select("url")
                .lean()
                .exec();
            if (!game) {
                throw new Error("Game not found");
            }
            // Generate a short token identifier
            const shortToken = await this.generateShortToken(game._id, platformToken);
            // Create a signed URL by appending the token
            const signedUrl = `${game.url}?url=${config_1.config.serverUrl}&token=${shortToken}`;
            return signedUrl;
        }
        catch (error) {
            throw error;
        }
    }
    async generateShortToken(gameId, platformToken) {
        try {
            // Use full UUID without hyphens for maximum uniqueness
            let token = (0, uuid_1.v4)().replace(/-/g, "");
            const data = {
                gameId: gameId.toString(),
                platform: platformToken,
                createdAt: new Date().toISOString(),
                nonce: (0, crypto_1.randomBytes)(4).toString("hex"),
            };
            const tokenKey = `game:token:${token}`;
            const expiresIn = config_1.config.redis.ttl;
            // Use Redis SETNX to ensure the key doesn't already exist
            const success = await this.redisService
                .getClient()
                .setNX(tokenKey, JSON.stringify(data));
            if (success) {
                // Set the expiration time separately if the key was set
                await this.redisService.getClient().expire(tokenKey, expiresIn);
                return token;
            }
            // If the key already exists, try again with a new token
            return this.generateShortToken(gameId, platformToken);
        }
        catch (error) {
            console.error("Token generation error:", error);
            throw error;
        }
    }
}
exports.GameService = GameService;
