require('dotenv').config();

// This configuration now securely reads from your environment variables.
module.exports = {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
    bucketName: process.env.AWS_S3_BUCKET_NAME,
    region: process.env.AWS_REGION // S3 also needs the region
};
