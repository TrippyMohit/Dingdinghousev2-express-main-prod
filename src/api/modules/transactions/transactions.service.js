"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_errors_1 = __importDefault(require("http-errors"));
const transaction_schema_1 = __importDefault(require("../../../common/schemas/transaction.schema"));
const transaction_type_1 = require("../../../common/types/transaction.type");
const user_schema_1 = __importDefault(require("../../../common/schemas/user.schema"));
const user_type_1 = require("../../../common/types/user.type");
class TransactionService {
    async create(senderId, receiverId, type, amount, session) {
        if (amount <= 0) {
            throw (0, http_errors_1.default)(400, "Transaction amount must be positive");
        }
        if (senderId.equals(receiverId)) {
            throw (0, http_errors_1.default)(400, "Sender and receiver must be different");
        }
        // Validate sender and receiver
        const sender = await user_schema_1.default.findOne({ _id: senderId, status: { $ne: user_type_1.UserStatus.DELETED } }).session(session);
        const receiver = await user_schema_1.default.findOne({ _id: receiverId, status: { $ne: user_type_1.UserStatus.DELETED } }).session(session);
        if (!sender) {
            throw (0, http_errors_1.default)(404, "Sender not found");
        }
        if (!receiver) {
            throw (0, http_errors_1.default)(404, "Receiver not found");
        }
        // Check for sufficient balance in case of RECHARGE, unless sender is admin
        if (type === transaction_type_1.TransactionType.RECHARGE && sender.balance < amount) {
            throw (0, http_errors_1.default)(400, "Insufficient balance for recharge");
        }
        // Check for sufficient balance in case of REDEEM
        if (type === transaction_type_1.TransactionType.REDEEM && receiver.balance < amount) {
            throw (0, http_errors_1.default)(400, "Insufficient balance for redemption");
        }
        const transaction = new transaction_schema_1.default({
            sender: senderId,
            receiver: receiverId,
            type,
            amount
        });
        await transaction.save({ session });
        // Update sender and receiver balances based on transaction type
        if (type === transaction_type_1.TransactionType.RECHARGE) {
            sender.balance -= amount;
            receiver.balance += amount;
            sender.totalSpent += amount;
            receiver.totalReceived += amount;
        }
        else if (type === transaction_type_1.TransactionType.REDEEM) {
            sender.balance += amount;
            receiver.balance -= amount;
            sender.totalReceived += amount;
            receiver.totalSpent += amount;
        }
        // Save the updated user balances
        await sender.save({ session });
        await receiver.save({ session });
        return transaction;
    }
    // Get a transaction by ID
    async getById(transactionId) {
        const transaction = await transaction_schema_1.default.findById(transactionId)
            .populate({
            path: 'sender',
            select: 'name username balance role',
            match: { status: { $ne: user_type_1.UserStatus.DELETED } }
        })
            .populate({
            path: 'receiver',
            select: 'name username balance role',
            match: { status: { $ne: user_type_1.UserStatus.DELETED } }
        });
        if (transaction) {
            throw (0, http_errors_1.default)(404, "Transaction not found");
        }
        return transaction;
    }
    // Get all transactions for a specific user
    async getByUser(userId, filters = {}, options = {}) {
        const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
        const query = {
            $or: [{ sender: userId }, { receiver: userId }],
            ...filters
        };
        const [transactions, total] = await Promise.all([
            transaction_schema_1.default.find(query)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate({
                path: 'sender',
                select: 'name username balance role',
                match: { status: { $ne: user_type_1.UserStatus.DELETED } }
            })
                .populate({
                path: 'receiver',
                select: 'name username balance role',
                match: { status: { $ne: user_type_1.UserStatus.DELETED } }
            })
                .lean(),
            transaction_schema_1.default.countDocuments(query)
        ]);
        return {
            data: transactions,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }
    // Get all transactions performed by a user's users
    async getByUsers(users, startDate, endDate, options = {}) {
        const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
        const query = {
            $or: [
                { sender: { $in: users } },
                { receiver: { $in: users } }
            ],
            createdAt: { $gte: startDate, $lte: endDate }
        };
        const [transactions, total] = await Promise.all([
            transaction_schema_1.default.find(query)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate({
                path: 'sender',
                select: 'name username balance role',
                match: { status: { $ne: user_type_1.UserStatus.DELETED } }
            })
                .populate({
                path: 'receiver',
                select: 'name username balance role',
                match: { status: { $ne: user_type_1.UserStatus.DELETED } }
            })
                .lean(),
            transaction_schema_1.default.countDocuments(query)
        ]);
        return {
            data: transactions,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }
    // Get total received and spent amounts for a user within a date range
    async getTotalAmounts(userId, startDate, endDate) {
        const result = await transaction_schema_1.default.aggregate([
            {
                $match: {
                    $or: [
                        { sender: userId },
                        { receiver: userId }
                    ],
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalReceived: {
                        $sum: {
                            $cond: [{ $eq: ["$receiver", userId] }, "$amount", 0]
                        }
                    },
                    totalSpent: {
                        $sum: {
                            $cond: [{ $eq: ["$sender", userId] }, "$amount", 0]
                        }
                    }
                }
            }
        ]);
        return {
            totalReceived: result[0]?.totalReceived || 0,
            totalSpent: result[0]?.totalSpent || 0
        };
    }
    // Get all transactions
    async getAll(filters = {}, options = {}) {
        const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
        const [transactions, total] = await Promise.all([
            transaction_schema_1.default.find(filters)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate({
                path: 'sender',
                select: 'name',
            })
                .populate({
                path: 'receiver',
                select: 'name',
            })
                .lean(),
            transaction_schema_1.default.countDocuments(filters)
        ]);
        return {
            data: transactions,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }
    // Get all transactions for a user and their descendants using materialized path
    async getByUserAndDescendants(userId, filters = {}, options = {}) {
        const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
        const searchTerm = filters.search;
        delete filters.search;
        const user = await user_schema_1.default.findById(userId);
        if (!user) {
            throw (0, http_errors_1.default)(404, "User not found");
        }
        const descendants = await user.getDescendants();
        const userIds = [user._id, ...descendants.map(descendant => descendant._id)];
        let query = {
            $or: [{ sender: { $in: userIds } }, { receiver: { $in: userIds } }],
            ...filters
        };
        if (searchTerm) {
            // First, find users matching the search term
            const matchingUsers = await user_schema_1.default.find({
                $or: [
                    { name: new RegExp(searchTerm, "i") },
                    { username: new RegExp(searchTerm, "i") }
                ]
            }).select('_id');
            const userMatchIds = matchingUsers.map(user => user._id);
            // Update query to include user matches and other search criteria
            query = {
                $and: [
                    query,
                    {
                        $or: [
                            { type: new RegExp(searchTerm, "i") },
                            { amount: !isNaN(Number(searchTerm)) ? Number(searchTerm) : null },
                            { sender: { $in: userMatchIds } },
                            { receiver: { $in: userMatchIds } }
                        ].filter(condition => condition.amount !== null ||
                            Object.keys(condition).length > 0)
                    }
                ]
            };
        }
        const [transactions, total] = await Promise.all([
            transaction_schema_1.default.find(query)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate({
                path: 'sender',
                select: 'name username balance role',
                match: { status: { $ne: user_type_1.UserStatus.DELETED } }
            })
                .populate({
                path: 'receiver',
                select: 'name username balance role',
                match: { status: { $ne: user_type_1.UserStatus.DELETED } }
            })
                .lean(),
            transaction_schema_1.default.countDocuments(query)
        ]);
        return {
            data: transactions,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }
}
exports.default = TransactionService;
