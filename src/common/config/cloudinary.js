"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudinaryService = void 0;
const cloudinary_1 = require("cloudinary");
const config_1 = require("./config");
const http_errors_1 = __importDefault(require("http-errors"));
class CloudinaryService {
    constructor() {
        cloudinary_1.v2.config({
            cloud_name: config_1.config.cloudinary.cloud_name,
            api_key: config_1.config.cloudinary.api_key,
            api_secret: config_1.config.cloudinary.api_secret
        });
    }
    async uploadImage(buffer, folder = 'games') {
        try {
            return await new Promise((resolve, reject) => {
                cloudinary_1.v2.uploader.upload_stream({ resource_type: 'image', folder }, (error, result) => {
                    if (error)
                        return reject(error);
                    resolve(result);
                }).end(buffer);
            });
        }
        catch (error) {
            console.error('Error uploading to Cloudinary:', error);
            throw http_errors_1.default.InternalServerError('Error uploading image');
        }
    }
}
exports.CloudinaryService = CloudinaryService;
