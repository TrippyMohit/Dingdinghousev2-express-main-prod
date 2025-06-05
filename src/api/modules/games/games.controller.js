"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameController = void 0;
const http_errors_1 = __importDefault(require("http-errors"));
const mongoose_1 = __importDefault(require("mongoose"));
const response_1 = require("../../../common/lib/response");
const game_type_1 = require("../../../common/types/game.type");
class GameController {
    constructor(gameService) {
        this.gameService = gameService;
        this.createGame = this.createGame.bind(this);
        this.getGames = this.getGames.bind(this);
        this.updateGame = this.updateGame.bind(this);
        this.deleteGame = this.deleteGame.bind(this);
        this.getGamePayouts = this.getGamePayouts.bind(this);
        this.activateGamePayout = this.activateGamePayout.bind(this);
        this.deleteGamePayout = this.deleteGamePayout.bind(this);
        this.getGame = this.getGame.bind(this);
        this.reorderGames = this.reorderGames.bind(this);
        this.uploadGames = this.uploadGames.bind(this);
        this.downloadGames = this.downloadGames.bind(this);
        this.playGame = this.playGame.bind(this);
    }
    async playGame(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                return next((0, http_errors_1.default)(401, 'Invalid token format. Expected: Bearer <token>'));
            }
            const platformToken = authHeader.split(' ')[1];
            if (!platformToken) {
                return next((0, http_errors_1.default)(401, 'Authentication token not found'));
            }
            const { slug } = req.params;
            if (!slug) {
                return next((0, http_errors_1.default)(400, 'Game slug is required'));
            }
            const token = await this.gameService.playGame(platformToken, slug);
            return res.status(201).json((0, response_1.successResponse)({ token }, 'Game token created sucessfully'));
        }
        catch (error) {
            next(error);
        }
    }
    async createGame(req, res, next) {
        try {
            // 1. Validate request body
            const { name, description, url, type, category, status, tag, slug, order } = req.body;
            if (!name || !url || !type || !category || !tag || !slug || !order === undefined) {
                throw http_errors_1.default.BadRequest('Missing required fields');
            }
            if (status && !Object.values(game_type_1.GameStatus).includes(status)) {
                throw http_errors_1.default.BadRequest('Invalid status value');
            }
            // 2. Validate files
            if (!req.files || !req.files['thumbnail']?.[0]) {
                throw http_errors_1.default.BadRequest('Thumbnail is required');
            }
            const thumbnailBuffer = req.files['thumbnail'][0].buffer;
            // 3. Parse payout if exists
            let payoutContent;
            let payoutFilename;
            if (req.files && req.files['payout']?.[0]) {
                const payoutFile = req.files['payout'][0];
                payoutContent = JSON.parse(payoutFile.buffer.toString());
                payoutFilename = payoutFile.originalname;
            }
            // 4. Create game with service
            const game = await this.gameService.createGame({
                name,
                description,
                url,
                type,
                category,
                status: status || game_type_1.GameStatus.ACTIVE,
                tag,
                slug,
                order
            }, thumbnailBuffer, {
                content: payoutContent,
                filename: payoutFilename || ''
            });
            return res.status(201).json((0, response_1.successResponse)(game, 'Game created successfully'));
        }
        catch (error) {
            next(error);
        }
    }
    async getGames(req, res, next) {
        try {
            const { page = "1", limit = "10", from, to, sortBy = "order", sortOrder = "desc", search = "", status, type, category, tag, download = "false" } = req.query;
            if (status && !Object.values(game_type_1.GameStatus).includes(status)) {
                throw http_errors_1.default.BadRequest("Invalid status value");
            }
            // Build filters object
            const queryFilters = {};
            // Add search filter
            if (search) {
                queryFilters.search = search;
            }
            // Add date range filter
            if (from || to) {
                queryFilters.createdAt = {};
                if (from)
                    queryFilters.createdAt.$gte = new Date(from);
                if (to)
                    queryFilters.createdAt.$lte = new Date(to);
            }
            // Add other filters
            if (status)
                queryFilters.status = status;
            if (type)
                queryFilters.type = type;
            if (category)
                queryFilters.category = category;
            if (tag)
                queryFilters.tag = tag;
            const options = {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 }
            };
            const result = await this.gameService.getGames(queryFilters, options);
            if (download === "true") {
                const filename = `games_export_${new Date().toISOString()}.json`;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
                console.log("FILNAME", filename);
                return res.json({
                    success: true,
                    data: result.data.map(game => ({
                        name: game.name,
                        description: game.description,
                        url: game.url,
                        type: game.type,
                        category: game.category,
                        status: game.status,
                        tag: game.tag,
                        slug: game.slug,
                        thumbnail: game.thumbnail,
                        order: game.order,
                        payout: game.payout,
                        createdAt: game.createdAt,
                        updatedAt: game.updatedAt
                    })),
                    meta: {
                        total: result.meta.total,
                        exportedAt: new Date().toISOString(),
                        filters: result.meta.filters
                    }
                });
            }
            return res.status(200).json((0, response_1.successResponse)(result.data, 'Games fetched successfully', result.meta));
        }
        catch (error) {
            next(error);
        }
    }
    async getGame(req, res, next) {
        try {
            const { id, tag, slug, name } = req.params;
            const game = await this.gameService.getGame({ id, tag, slug, name });
            res.json({
                success: true,
                data: game
            });
        }
        catch (error) {
            next(error);
        }
    }
    async updateGame(req, res, next) {
        try {
            if (!req.params.id) {
                throw http_errors_1.default.BadRequest('Game ID is required');
            }
            if (!mongoose_1.default.Types.ObjectId.isValid(req.params.id)) {
                throw http_errors_1.default.BadRequest('Invalid game ID');
            }
            const hasBodyUpdates = Object.keys(req.body).length > 0;
            const files = req.files;
            const hasFileUpdates = files && (files['thumbnail']?.[0] ||
                files['payout']?.[0]);
            if (!hasBodyUpdates && !hasFileUpdates) {
                throw http_errors_1.default.BadRequest('No updates provided - please provide either field updates or files to update');
            }
            // Build update object with only provided fields
            const updateData = {};
            const allowedFields = ['name', 'description', 'url', 'type', 'category', 'status', 'tag', 'slug', 'order'];
            allowedFields.forEach((field) => {
                const value = req.body[field];
                if (value !== undefined && value !== '') {
                    updateData[field] = value;
                }
            });
            // Validate status if provided
            if (updateData.status && !Object.values(game_type_1.GameStatus).includes(updateData.status)) {
                throw http_errors_1.default.BadRequest('Invalid status value');
            }
            let thumbnailBuffer;
            if (files?.thumbnail?.[0]) {
                thumbnailBuffer = files.thumbnail[0].buffer;
            }
            let payoutContent;
            let payoutFilename = '';
            if (files?.payout?.[0]) {
                try {
                    payoutFilename = files.payout[0].originalname;
                    payoutContent = JSON.parse(files.payout[0].buffer.toString());
                }
                catch (error) {
                    throw http_errors_1.default.BadRequest('Invalid payout JSON format');
                }
            }
            const game = await this.gameService.updateGame(req.params.id, Object.keys(updateData).length > 0 ? updateData : {}, thumbnailBuffer, {
                content: payoutContent,
                filename: payoutFilename || ''
            });
            return res.status(200).json((0, response_1.successResponse)(game, 'Game updated successfully'));
        }
        catch (error) {
            next(error);
        }
    }
    async deleteGame(req, res, next) {
        try {
            if (!req.params.id) {
                throw http_errors_1.default.BadRequest('Game ID is required');
            }
            await this.gameService.deleteGame(req.params.id);
            res.status(200).json((0, response_1.successResponse)(null, 'Game deleted successfully'));
        }
        catch (error) {
            next(error);
        }
    }
    async getGamePayouts(req, res, next) {
        try {
            const { id } = req.params;
            const payouts = await this.gameService.getGamePayouts(id);
            res.status(200).json((0, response_1.successResponse)(payouts, 'Payouts fetched successfully'));
        }
        catch (error) {
            next(error);
        }
    }
    async activateGamePayout(req, res, next) {
        try {
            const { id, payoutId } = req.params;
            if (!id || !payoutId) {
                throw http_errors_1.default.BadRequest('Game ID and Payout ID are required');
            }
            const payout = await this.gameService.activateGamePayout(id, payoutId);
            res.status(200).json((0, response_1.successResponse)(payout, 'Payout activated successfully'));
        }
        catch (error) {
            next(error);
        }
    }
    async deleteGamePayout(req, res, next) {
        try {
            const { id, payoutId } = req.params;
            if (!id || !payoutId) {
                throw http_errors_1.default.BadRequest('Game ID and Payout ID are required');
            }
        }
        catch (error) {
            next(error);
        }
    }
    async reorderGames(req, res, next) {
        try {
            const reorderData = req.body;
            if (!Array.isArray(reorderData)) {
                throw http_errors_1.default.BadRequest('Request body must be an array');
            }
            if (!reorderData.every(item => item.gameId && typeof item.order === 'number')) {
                throw http_errors_1.default.BadRequest('Each item must have gameId and order');
            }
            await this.gameService.reorderGames(reorderData);
            return res.status(200).json((0, response_1.successResponse)(null, 'Games reordered successfully'));
        }
        catch (error) {
            next(error);
        }
    }
    async uploadGames(req, res, next) {
        try {
            if (!req.files || !req.files['games']?.[0]) {
                throw http_errors_1.default.BadRequest('Games JSON file is required');
            }
            const gamesFile = req.files['games'][0];
            let gamesData;
            try {
                const parsedData = JSON.parse(gamesFile.buffer.toString());
                if (!parsedData || typeof parsedData !== 'object' || !Array.isArray(parsedData.data)) {
                    throw new Error('Invalid format');
                }
                gamesData = parsedData.data;
            }
            catch (error) {
                throw http_errors_1.default.BadRequest('Invalid JSON format');
            }
            const result = await this.gameService.uploadGames(gamesData);
            return res.status(201).json({
                success: true,
                data: {
                    total: result.total,
                    created: result.created,
                    skipped: result.skipped,
                    errors: result.errors
                },
                message: 'Games imported successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    async downloadGames(req, res, next) {
        try {
            const games = await this.gameService.downloadGames();
            if (!games || games.length === 0) {
                throw http_errors_1.default.NotFound("No games found to download");
            }
            const formattedGames = games.map(game => ({
                name: game.name,
                description: game.description,
                url: game.url,
                type: game.type,
                category: game.category,
                status: game.status,
                tag: game.tag,
                slug: game.slug,
                thumbnail: game.thumbnail,
                order: game.order,
                payout: game.payout,
                createdAt: game.createdAt,
                updatedAt: game.updatedAt
            }));
            const filename = `games_export_${new Date().toISOString()}.json`;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
            return res.json({
                success: true,
                data: formattedGames,
                meta: {
                    total: formattedGames.length,
                    exportedAt: new Date().toISOString()
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.GameController = GameController;
