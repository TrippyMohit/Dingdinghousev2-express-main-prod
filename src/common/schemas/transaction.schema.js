"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const transaction_type_1 = require("../types/transaction.type");
const TransactionSchema = new mongoose_1.Schema({
    sender: {
        type: mongoose_1.Types.ObjectId,
        ref: "User",
        required: true
    },
    receiver: {
        type: mongoose_1.Types.ObjectId,
        ref: "User",
        required: true
    },
    type: {
        type: String,
        enum: Object.values(transaction_type_1.TransactionType),
        required: true
    },
    amount: { type: Number, required: true }
}, { timestamps: true });
const Transaction = (0, mongoose_1.model)("Transaction", TransactionSchema);
exports.default = Transaction;
