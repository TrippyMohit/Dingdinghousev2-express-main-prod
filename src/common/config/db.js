"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("./config");
const connectDB = async () => {
    try {
        mongoose_1.default.connection.on("connected", () => {
            console.log("Connected to database successfully");
        });
        mongoose_1.default.connection.on("error", (err) => {
            console.log("Error in connecting to database.", err);
        });
        await mongoose_1.default.connect(config_1.config.db);
    }
    catch (err) {
        console.error("Failed to connect to database.", err);
        process.exit(1);
    }
};
exports.default = connectDB;
