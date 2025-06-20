const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
require('dotenv').config();

// Define the configuration object
const config = {};

// When running on AWS (like EC2 with an IAM role), the region and credentials
// are automatically provided by the environment. We only need to set them
// manually for local development.
if (process.env.NODE_ENV !== 'production') {
  // We are running locally, so use the .env file
  config.region = process.env.AWS_REGION;
  config.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
} else {
  // When in production on AWS, we must still specify the region.
  // The SDK will automatically handle credentials from the IAM Role.
  // Make sure to set AWS_REGION as an environment variable on your server.
  config.region = process.env.AWS_REGION;
}

// Check if the region is still missing
if (!config.region) {
  throw new Error("AWS Region is missing. Please set AWS_REGION in your environment variables.");
}

// Configure the AWS Client
const client = new DynamoDBClient(config);

const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

module.exports = { docClient, TABLE_NAME };
