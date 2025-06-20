const { docClient, TABLE_NAME } = require('../config/dynamo-config');
const { TransactWriteCommand, UpdateCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require('uuid');

// Create a new charity
exports.createCharity = async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Charity name is required.' });
    }

    const charityId = uuidv4();
    const newCharity = {
        PK: `CHARITY#${charityId}`,
        SK: `METADATA#${charityId}`,
        charityId,
        name,
        totalSignups: 0,
        createdAt: new Date().toISOString(),
        // Use a different GSI PK to separate charities from organizations
        GSI2PK: 'CHARITIES',
        GSI2SK: `METADATA#${name}`
    };

    try {
        await docClient.send(new TransactWriteCommand({ TransactItems: [{ Put: { TableName: TABLE_NAME, Item: newCharity } }] }));
        res.status(201).json({ message: 'Charity created successfully.', charity: newCharity });
    } catch (error) {
        console.error("Create Charity Error:", error);
        res.status(500).json({ message: 'Failed to create charity.' });
    }
};

// Sign up a user for a charity
exports.signupForCharity = async (req, res) => {
    const { charityId } = req.params;
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required.' });
    }

    const transactionParams = {
        TransactItems: [
            {
                Put: {
                    TableName: TABLE_NAME,
                    Item: {
                        PK: `USER#${userId}`,
                        SK: `CHARITY#${charityId}`, // Use CHARITY# prefix for the link
                        charityId: charityId,
                        userId: userId,
                        joinedAt: new Date().toISOString(),
                    },
                    ConditionExpression: 'attribute_not_exists(SK)'
                }
            },
            {
                Update: {
                    TableName: TABLE_NAME,
                    Key: { PK: `CHARITY#${charityId}`, SK: `METADATA#${charityId}` },
                    UpdateExpression: 'ADD totalSignups :inc',
                    ExpressionAttributeValues: { ':inc': 1 }
                }
            }
        ]
    };

    try {
        await docClient.send(new TransactWriteCommand(transactionParams));
        res.status(200).json({ message: `Successfully signed up for charity ${charityId}.` });
    } catch (error) {
        if (error.name === 'TransactionCanceledException') {
            return res.status(409).json({ message: 'User has already signed up for this charity.' });
        }
        console.error("Charity Signup Error:", error);
        res.status(500).json({ message: 'Failed to sign up for charity.' });
    }
};

// List all charities
exports.listCharities = async (req, res) => {
    const params = {
        TableName: TABLE_NAME,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :gsi2pk',
        ExpressionAttributeValues: { ':gsi2pk': 'CHARITIES' }
    };

    try {
        const { Items } = await docClient.send(new QueryCommand(params));
        res.status(200).json(Items);
    } catch (error) {
        console.error("List Charities Error:", error);
        res.status(500).json({ message: 'Failed to retrieve charities.' });
    }
};

// Get all charity IDs a user has joined
exports.getUserCharities = async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return res.status(400).json({ message: 'User ID is required.' });
    }

    const params = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk_prefix)',
        ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk_prefix': 'CHARITY#' // Use CHARITY# prefix
        },
        ProjectionExpression: 'charityId' 
    };

    try {
        const { Items } = await docClient.send(new QueryCommand(params));
        res.status(200).json(Items.map(item => item.charityId));
    } catch (error) {
        console.error("Get User Charities Error:", error);
        res.status(500).json({ message: 'Failed to retrieve user charities.' });
    }
};
