const multer = require("multer");
const multerS3 = require("multer-s3-transform");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const config = require("../config/s3.config");

const s3 = new AWS.S3({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region
});

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: config.bucketName,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: function (req, file, cb) {
            // Generate a unique filename using UUID
            const uniqueSuffix = `${uuidv4()}${path.extname(file.originalname)}`;
            cb(null, `snaps/${uniqueSuffix}`); // Store in a 'snaps' folder
        }
    })
});

// The middleware will look for a single file in the request with the field name 'snapImage'
module.exports = upload.single('snapImage');
