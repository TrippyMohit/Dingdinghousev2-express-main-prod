"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_errors_1 = __importDefault(require("http-errors"));
const mongoose_1 = __importDefault(require("mongoose"));
const transactions_service_1 = __importDefault(require("../transactions/transactions.service"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const user_type_1 = require("../../../common/types/user.type");
const user_schema_1 = __importDefault(require("../../../common/schemas/user.schema"));
const role_schema_1 = __importDefault(require("../../../common/schemas/role.schema"));
const transaction_type_1 = require("../../../common/types/transaction.type");
const transaction_schema_1 = __importDefault(require("../../../common/schemas/transaction.schema"));
const game_schema_1 = __importDefault(require("../../../common/schemas/game.schema"));
class UserService {
    constructor() {
        this.transactionService = new transactions_service_1.default();
    }
    async getUserById(requestingUserId, userId) {
        const user = await user_schema_1.default.findById(userId)
            .select('-permissions -token -password')
            .populate('role', 'name')
            .populate('createdBy', 'name')
            .exec();
        if (!user) {
            throw (0, http_errors_1.default)(404, 'User not found');
        }
        if (!this.isAncestor(requestingUserId.toString(), user)) {
            throw (0, http_errors_1.default)(403, 'You are not authorized to perform this action');
        }
        return user;
    }
    isAncestor(requestingUserId, targetUser) {
        return targetUser.path.includes(requestingUserId);
    }
    // Get all descendants of a user with pagination and filtering
    async getDescendants(userId, filters, options) {
        const user = await user_schema_1.default.findById(userId);
        if (!user) {
            throw (0, http_errors_1.default)(404, 'User not found');
        }
        const { search, view, role: roleName, from, to, status, username, ...otherFilters } = filters;
        // Get all role descendants that user has access to
        const role = await role_schema_1.default.findById(user.role);
        if (!role) {
            throw (0, http_errors_1.default)(404, 'Role not found');
        }
        const query = {
            path: { $regex: `^${user.path}` },
            _id: { $ne: userId },
            status: { $ne: user_type_1.UserStatus.DELETED },
            role: { $in: [...role.descendants, user.role] }, // Only get users with roles user has access to
            ...otherFilters
        };
        if (username) {
            const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.username = { $regex: new RegExp(escapedUsername, 'i') };
        }
        if (status) {
            query.status = status;
        }
        // Add date range filtering
        if (from || to) {
            query.createdAt = {};
            if (from) {
                query.createdAt.$gte = new Date(from);
            }
            if (to) {
                query.createdAt.$lte = new Date(to);
            }
        }
        if (roleName) {
            const escapedRoleName = roleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const targetRole = await role_schema_1.default.findOne({
                name: { $regex: new RegExp(escapedRoleName, 'i') }
            });
            if (targetRole) {
                query.role = targetRole._id;
            }
            else {
                throw (0, http_errors_1.default)(404, `Role with name ${roleName} not found`);
            }
        }
        if (view === 'created') {
            query.createdBy = user._id;
        }
        else if (view === 'others') {
            query.createdBy = { $ne: user._id };
        }
        if (search) {
            try {
                // Escape special regex characters
                const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const searchRegex = new RegExp(escapedSearch, 'i');
                // Find roles matching search
                const matchingRoles = await role_schema_1.default.find({
                    name: { $regex: searchRegex }
                }).select('_id');
                const roleIds = matchingRoles.map(r => r._id);
                // Find users by createdBy matching search
                const matchingCreators = await user_schema_1.default.find({
                    name: { $regex: searchRegex }
                }).select('_id');
                const creatorIds = matchingCreators.map(c => c._id);
                query.$or = [
                    { name: { $regex: searchRegex } },
                    { username: { $regex: searchRegex } },
                    { role: { $in: roleIds } },
                    { createdBy: { $in: creatorIds } }
                ];
            }
            catch (error) {
                throw (0, http_errors_1.default)(400, 'Invalid search pattern');
            }
        }
        const total = await user_schema_1.default.countDocuments(query);
        const users = await user_schema_1.default.find(query)
            .select('name username balance role status createdBy totalSpent totalReceived permissions lastLogin createdAt')
            .populate('role', 'name')
            .populate('createdBy', 'name')
            .sort(options.sort)
            .skip((options.page - 1) * options.limit)
            .limit(options.limit);
        // console.log("query : ", query);
        console.log(users.length);
        return {
            data: users,
            meta: {
                total,
                page: options.page,
                limit: options.limit,
                pages: Math.ceil(total / options.limit)
            }
        };
    }
    // Update a specific user
    async updateUser(requestingUserId, userId, updateData, transactionType) {
        const allowedUpdates = ['name', 'username', 'password', 'balance', 'role', 'status', 'createdBy'];
        const updates = Object.keys(updateData);
        const disallowedUpdates = updates.filter(key => !allowedUpdates.includes(key));
        if (disallowedUpdates.length > 0) {
            throw (0, http_errors_1.default)(400, `Disallowed fields: ${disallowedUpdates.join(', ')}`);
        }
        const updateObject = {};
        updates.forEach(key => {
            if (key !== 'balance') {
                updateObject[key] = updateData[key];
            }
        });
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const user = await user_schema_1.default.findById(userId).session(session);
            if (!user) {
                throw (0, http_errors_1.default)(404, 'User not found');
            }
            if (!this.isAncestor(requestingUserId, user)) {
                throw (0, http_errors_1.default)(403, 'You are not authorized to perform this action');
            }
            if (updateObject.password) {
                updateObject.password = await bcrypt_1.default.hash(updateObject.password, 10);
            }
            Object.assign(user, updateObject);
            await user.save({ session });
            if (updateData.balance) {
                if (!transactionType) {
                    throw (0, http_errors_1.default)(400, 'Transaction type is required when updating balance');
                }
                if (!Object.values(transaction_type_1.TransactionType).includes(transactionType)) {
                    throw (0, http_errors_1.default)(400, 'Invalid transaction type');
                }
                await this.transactionService.create(user.createdBy, user._id, transactionType, updateData.balance, session);
            }
            await session.commitTransaction();
            session.endSession();
            // Fetch the updated user data to include the updated balance
            const updatedUser = await user_schema_1.default.findById(userId);
            // Construct the updated fields object to return
            const updatedFields = {};
            updates.forEach(key => {
                updatedFields[key] = updatedUser[key];
            });
            // Include balance in the updated fields if it was updated
            if (updateData.balance) {
                updatedFields.balance = updatedUser.balance;
            }
            return updatedFields;
        }
        catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }
    async deleteUser(targetUserId) {
        const session = await mongoose_1.default.startSession();
        try {
            return await session.withTransaction(async () => {
                // First get the current user to access their username
                const currentUser = await user_schema_1.default.findOne({
                    _id: targetUserId,
                    status: { $ne: user_type_1.UserStatus.DELETED }
                }).session(session);
                if (!currentUser) {
                    throw (0, http_errors_1.default)(404, 'User not found or already deleted');
                }
                // Generate random hash for deleted user's password
                const deletedPassword = await bcrypt_1.default.hash(`DELETED_${Date.now()}`, 10);
                // Then update with the known username
                const user = await user_schema_1.default.findOneAndUpdate({ _id: targetUserId }, {
                    $set: {
                        username: `${currentUser.username}_DELETED_${Date.now()}`,
                        status: user_type_1.UserStatus.DELETED,
                        token: undefined,
                        permissions: [],
                        password: deletedPassword
                    }
                }, {
                    session,
                    new: true,
                    runValidators: true
                });
                if (!user) {
                    throw (0, http_errors_1.default)(404, 'User not found');
                }
                const descendants = await user_schema_1.default.countDocuments({
                    path: { $regex: `^${user.path}/` },
                    status: { $ne: user_type_1.UserStatus.DELETED }
                });
                if (descendants > 0) {
                    throw (0, http_errors_1.default)(400, 'Cannot delete user with descendants');
                }
                return user;
            });
        }
        finally {
            await session.endSession();
        }
    }
    async generateDescendantsReport(userId, from, to) {
        // Default the date range to the last 7 days if not provided
        const currentDate = new Date();
        const defaultFrom = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        const defaultTo = currentDate;
        const startDate = from || defaultFrom;
        const endDate = to || defaultTo;
        const requestingUser = await user_schema_1.default.findById(userId);
        if (!requestingUser) {
            throw (0, http_errors_1.default)(404, 'User not found');
        }
        // Get descendant user IDs
        const descendants = await user_schema_1.default.find({
            path: { $regex: `^${requestingUser.path}/` },
            status: { $ne: user_type_1.UserStatus.DELETED },
        }).select('_id');
        const descendantIds = descendants.map(user => user._id);
        // Determine aggregation interval
        const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        const groupFormat = totalDays <= 1
            ? { format: "%Y-%m-%dT%H:00:00Z", label: "hour" } // Hourly
            : totalDays <= 7
                ? { format: "%Y-%m-%d", label: "day" } // Daily
                : { format: "%Y-%U", label: "week" }; // Weekly
        // Aggregate user creations
        const userCreationSummary = await user_schema_1.default.aggregate([
            {
                $match: {
                    createdBy: { $in: descendantIds },
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: groupFormat.format, date: "$createdAt" } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        // Aggregate transactions
        const transactionSummary = await transaction_schema_1.default.aggregate([
            {
                $match: {
                    $or: [
                        { sender: { $in: descendantIds } },
                        { receiver: { $in: descendantIds } },
                    ],
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: {
                        period: { $dateToString: { format: groupFormat.format, date: "$createdAt" } },
                        type: "$type",
                        target: {
                            $cond: [{ $in: ["$sender", descendantIds] }, "sent", "received"],
                        },
                    },
                    totalAmount: { $sum: "$amount" },
                    count: { $sum: 1 },
                },
            },
            { $sort: { "_id.period": 1 } },
        ]);
        // Restructure transaction data for the frontend
        const transactionData = {};
        transactionSummary.forEach(item => {
            const period = item._id.period;
            const key = `${item._id.type}_${item._id.target}`;
            if (!transactionData[period]) {
                transactionData[period] = { period };
            }
            transactionData[period][key] = {
                count: item.count,
                totalAmount: item.totalAmount,
            };
        });
        return {
            timeRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString(),
                duration: `${Math.round(totalDays)} days`,
            },
            userCreationSummary, // Aggregated user creation
            transactionSummary: Object.values(transactionData), // Aggregated transactions
            metrics: {
                totalCreatedUsers: userCreationSummary.reduce((sum, uc) => sum + uc.count, 0),
                totalRechargeReceived: transactionSummary
                    .filter(t => t._id.type === transaction_type_1.TransactionType.RECHARGE && t._id.target === "received")
                    .reduce((sum, t) => sum + t.totalAmount, 0),
                totalRechargeSent: transactionSummary
                    .filter(t => t._id.type === transaction_type_1.TransactionType.RECHARGE && t._id.target === "sent")
                    .reduce((sum, t) => sum + t.totalAmount, 0),
                totalRedeemDeducted: transactionSummary
                    .filter(t => t._id.type === transaction_type_1.TransactionType.REDEEM && t._id.target === "sent")
                    .reduce((sum, t) => sum + t.totalAmount, 0),
                totalRedeemReceived: transactionSummary
                    .filter(t => t._id.type === transaction_type_1.TransactionType.REDEEM && t._id.target === "received")
                    .reduce((sum, t) => sum + t.totalAmount, 0),
            },
        };
    }
    // Generate report for a specific user
    async generateUserReport(userId, from, to) {
        const currentDate = new Date();
        const defaultFrom = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        const defaultTo = currentDate;
        const startDate = from || defaultFrom;
        const endDate = to || defaultTo;
        const user = await user_schema_1.default.findById(userId)
            .populate('createdBy', 'username')
            .populate('role', 'name');
        if (!user) {
            throw (0, http_errors_1.default)(404, 'User not found');
        }
        // Fetch users created by this user
        const createdUsers = await user_schema_1.default.aggregate([
            {
                $match: {
                    createdBy: userId,
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $project: {
                    _id: 1,
                    name: "$name",
                    username: "$username",
                    role: "$role",
                    timestamp: "$createdAt",
                },
            },
        ]);
        // Fetch transactions (recharge/redeem)
        const transactions = await transaction_schema_1.default.aggregate([
            {
                $match: {
                    $or: [{ sender: userId }, { receiver: userId }],
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $project: {
                    _id: 1,
                    type: "$type",
                    timestamp: "$createdAt",
                    amount: "$amount",
                    target: {
                        $cond: [
                            { $eq: ["$sender", userId] },
                            "sent",
                            "received",
                        ],
                    },
                },
            },
        ]);
        // Group transactions by type
        const groupedTransactions = {
            recharge: transactions.filter((t) => t.type === transaction_type_1.TransactionType.RECHARGE),
            redeem: transactions.filter((t) => t.type === transaction_type_1.TransactionType.REDEEM),
        };
        // Calculate metrics
        const rechargeMetrics = {
            received: groupedTransactions.recharge
                .filter((t) => t.target === "received")
                .reduce((sum, t) => sum + t.amount, 0),
            sent: groupedTransactions.recharge
                .filter((t) => t.target === "sent")
                .reduce((sum, t) => sum + t.amount, 0),
        };
        const redeemMetrics = {
            deducted: groupedTransactions.redeem
                .filter((t) => t.target === "sent")
                .reduce((sum, t) => sum + t.amount, 0),
            received: groupedTransactions.redeem
                .filter((t) => t.target === "received")
                .reduce((sum, t) => sum + t.amount, 0),
        };
        const createdUsersCount = createdUsers.length;
        const userDetails = {
            _id: user._id,
            name: user.name,
            username: user.username,
            balance: user.balance,
            role: user.role,
            status: user.status,
            createdBy: user.createdBy && typeof user.createdBy !== 'string' ? user.createdBy.username : null,
            lastLogin: user.lastLogin,
        };
        // Calculate duration
        const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const timeRange = {
            from: startDate.toISOString(),
            to: endDate.toISOString(),
            duration: duration > 1 ? `${duration} days` : `${duration * 24} hours`,
        };
        return {
            timeRange,
            userDetails,
            createdUsers,
            transactions: groupedTransactions,
            metrics: {
                createdUsersCount,
                rechargeMetrics,
                redeemMetrics,
            },
        };
    }
    async updateUserPermissions(userId, permissions, operation) {
        const user = await user_schema_1.default.findById(userId);
        if (!user) {
            throw (0, http_errors_1.default)(404, 'User not found');
        }
        permissions.forEach(newPermission => {
            const existingPermissionIndex = user.permissions.findIndex(p => p.resource === newPermission.resource);
            if (existingPermissionIndex !== -1) {
                // Update the existing permission
                const existingPermission = user.permissions[existingPermissionIndex].permission;
                let updatedPermission = '';
                for (let i = 0; i < 3; i++) {
                    const newChar = newPermission.permission[i];
                    const existingChar = existingPermission[i];
                    if (operation === user_type_1.PermissionOperation.ADD) {
                        // Add the new permission if it's not already present
                        updatedPermission += (newChar !== '-' && newChar !== existingChar) ? newChar : existingChar;
                    }
                    else if (operation === user_type_1.PermissionOperation.REMOVE) {
                        // Remove the permission if it's present
                        updatedPermission += (newChar === existingChar) ? '-' : existingChar;
                    }
                }
                user.permissions[existingPermissionIndex].permission = updatedPermission;
            }
            else {
                // Add the new permission
                user.permissions.push(newPermission);
            }
        });
        await user.save();
        return user;
    }
    async getUserFavouriteGames(userId) {
        const user = await user_schema_1.default
            .findById(userId)
            .select('favouriteGames')
            .populate({
            path: 'favouriteGames',
            select: '-payout', // Exclude payout
        })
            .lean();
        return user?.favouriteGames || [];
    }
    async updateFavouriteGames(userId, gameId, action) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const user = await user_schema_1.default.findById(userId).session(session);
            if (!user) {
                throw (0, http_errors_1.default)(404, 'User not found');
            }
            const game = await game_schema_1.default.findById(gameId).session(session);
            if (!game) {
                throw (0, http_errors_1.default)(404, 'Game not found');
            }
            let updateQuery;
            if (action === 'add') {
                // Use $addToSet to add the game ID if it doesn't already exist
                updateQuery = { $addToSet: { favouriteGames: gameId } };
            }
            else if (action === 'remove') {
                // Use $pull to remove the game ID if it exists
                updateQuery = { $pull: { favouriteGames: gameId } };
            }
            else {
                throw (0, http_errors_1.default)(400, 'Invalid action');
            }
            // Perform the update operation
            const updatedUser = await user_schema_1.default.findByIdAndUpdate(userId, updateQuery, { new: true, session } // Return the updated document
            );
            if (!updatedUser) {
                throw (0, http_errors_1.default)(404, 'User not found after update');
            }
            await session.commitTransaction();
            session.endSession();
            return { favouriteGames: updatedUser.favouriteGames };
        }
        catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }
}
exports.default = UserService;
