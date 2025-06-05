"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const http_errors_1 = __importDefault(require("http-errors"));
const response_1 = require("../../../common/lib/response");
class TransactionController {
    constructor(transactionService) {
        this.transactionService = transactionService;
        this.getAllTransactions = this.getAllTransactions.bind(this);
        this.getTransactionById = this.getTransactionById.bind(this);
        this.getTransactionsByUser = this.getTransactionsByUser.bind(this);
        this.getTransactionsByUserAndDescendants = this.getTransactionsByUserAndDescendants.bind(this);
    }
    async getTransactionById(req, res, next) {
        try {
            const { transactionId } = req.params;
            const transaction = await this.transactionService.getById(new mongoose_1.default.Types.ObjectId(transactionId));
            res.status(200).json((0, response_1.successResponse)(transaction));
        }
        catch (error) {
            next(error);
        }
    }
    async getTransactionsByUser(req, res, next) {
        try {
            const { userId } = req.params;
            const { page = "1", limit = "10", ...filters } = req.query;
            const options = {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10)
            };
            const result = await this.transactionService.getByUser(new mongoose_1.default.Types.ObjectId(userId), filters, options);
            res.status(200).json((0, response_1.successResponse)(result.data, 'Transactions retrieved successfully', result.meta));
        }
        catch (error) {
            next(error);
        }
    }
    async getAllTransactions(req, res, next) {
        try {
            const { requestingUser } = req;
            if (!requestingUser) {
                throw http_errors_1.default.NotFound("User not found");
            }
            const { page = "1", limit = "10", from, to, type, amount, amountOp, // gt, lt, eq
            sortBy = "createdAt", sortOrder = "desc", search = "" } = req.query;
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
            // Add transaction type filter
            if (type) {
                queryFilters.type = type;
            }
            // Add amount filter
            if (amount) {
                const amountValue = parseFloat(amount);
                if (!isNaN(amountValue)) {
                    switch (amountOp) {
                        case "gt":
                            queryFilters.amount = { $gt: amountValue };
                            break;
                        case "lt":
                            queryFilters.amount = { $lt: amountValue };
                            break;
                        case "eq":
                            queryFilters.amount = amountValue;
                            break;
                    }
                }
            }
            const options = {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 }
            };
            const result = await this.transactionService.getByUserAndDescendants(requestingUser._id, queryFilters, options);
            res.status(200).json((0, response_1.successResponse)(result.data, 'Transactions retrieved successfully', result.meta));
        }
        catch (error) {
            next(error);
        }
    }
    async getTransactionsByUserAndDescendants(req, res, next) {
        try {
            const { userId } = req.params;
            const { page = "1", limit = "10", from, to, type, amount, amountOp, // gt, lt, eq
            sortBy = "createdAt", sortOrder = "desc", search = "" } = req.query;
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
            // Add transaction type filter
            if (type) {
                queryFilters.type = type;
            }
            // Add amount filter
            if (amount) {
                const amountValue = parseFloat(amount);
                if (!isNaN(amountValue)) {
                    switch (amountOp) {
                        case "gt":
                            queryFilters.amount = { $gt: amountValue };
                            break;
                        case "lt":
                            queryFilters.amount = { $lt: amountValue };
                            break;
                        case "eq":
                            queryFilters.amount = amountValue;
                            break;
                    }
                }
            }
            const options = {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 }
            };
            const result = await this.transactionService.getByUserAndDescendants(new mongoose_1.default.Types.ObjectId(userId), queryFilters, options);
            res.status(200).json((0, response_1.successResponse)(result.data, 'Transactions retrieved successfully', result.meta));
        }
        catch (error) {
            next(error);
        }
    }
}
exports.default = TransactionController;
