const { docClient, TABLE_NAME } = require('../config/dynamo-config');
const { TransactWriteCommand, UpdateCommand, QueryCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require('uuid');

// Create a new organization
exports.createOrganization = async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Organization name is required.' });
    }

    const orgId = uuidv4();
    const newOrg = {
        PK: `ORG#${orgId}`,
        SK: `METADATA#${orgId}`,
        orgId,
        name,
        totalSignups: 0,
        totalCustomCountSum: 0, 
        createdAt: new Date().toISOString(),
        GSI2PK: 'ORGANIZATIONS',
        GSI2SK: `METADATA#${name}`
    };

    const putParams = {
        TableName: TABLE_NAME,
        Item: newOrg
    };

    try {
        await docClient.send(new TransactWriteCommand({ TransactItems: [{ Put: putParams }] }));
        res.status(201).json({ message: 'Organization created successfully.', organization: newOrg });
    } catch (error) {
        console.error("Create Organization Error:", error);
        res.status(500).json({ message: 'Failed to create organization.' });
    }
};

// Sign up the logged-in user for an organization
exports.signupForOrganization = async (req, res) => {
    const { orgId } = req.params;
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required.' });
    }

    const transactionParams = {
        TransactItems: [
            {
                // Action 1: Create the user-to-organization link.
                Put: {
                    TableName: TABLE_NAME,
                    Item: {
                        PK: `USER#${userId}`,
                        SK: `ORG#${orgId}`,
                        orgId: orgId,
                        userId: userId,
                        joinedAt: new Date().toISOString(),
                        customCounter: 0 
                    },
                    // This condition prevents the operation if an item with the same
                    // Partition Key (PK) AND Sort Key (SK) already exists.
                    // This correctly prevents a user from joining the same org twice.
                    ConditionExpression: 'attribute_not_exists(SK)'
                }
            },
            {
                // Action 2: Atomically increment the total signups counter for the organization.
                Update: {
                    TableName: TABLE_NAME,
                    Key: {
                        PK: `ORG#${orgId}`,
                        SK: `METADATA#${orgId}`
                    },
                    UpdateExpression: 'ADD totalSignups :inc',
                    ExpressionAttributeValues: { ':inc': 1 }
                }
            }
        ]
    };

    try {
        await docClient.send(new TransactWriteCommand(transactionParams));
        res.status(200).json({ message: `Successfully signed up for organization ${orgId}.` });
    } catch (error) {
        if (error.name === 'TransactionCanceledException') {
            // This error is expected if the ConditionExpression fails (user already joined).
            return res.status(409).json({ message: 'User has already signed up for this organization.' });
        }
        console.error("Org Signup Error:", error);
        res.status(500).json({ message: 'Failed to sign up for organization.' });
    }
};

// Increment the custom counter for a user AND the aggregate counter for the organization
exports.incrementCustomCounter = async (req, res) => {
    const { orgId } = req.params;
    const { userId } = req.body; 

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required in the request body.' });
    }

    const transactionParams = {
        TransactItems: [
            {
                Update: {
                    TableName: TABLE_NAME,
                    Key: { PK: `USER#${userId}`, SK: `ORG#${orgId}` },
                    UpdateExpression: 'ADD customCounter :inc',
                    ExpressionAttributeValues: { ':inc': 1 },
                    ConditionExpression: 'attribute_exists(PK)'
                }
            },
            {
                Update: {
                    TableName: TABLE_NAME,
                    Key: { PK: `ORG#${orgId}`, SK: `METADATA#${orgId}` },
                    UpdateExpression: 'ADD totalCustomCountSum :inc',
                    ExpressionAttributeValues: { ':inc': 1 }
                }
            }
        ]
    };

    try {
        await docClient.send(new TransactWriteCommand(transactionParams));
        res.status(200).json({ 
            message: `Counter for user ${userId} and the organization's total were incremented successfully.`
        });
    } catch (error) {
        if (error.name === 'TransactionCanceledException') {
             return res.status(404).json({ message: 'Failed to increment. Ensure user is a member of the organization.' });
        }
        console.error("Increment Counter Error:", error);
        res.status(500).json({ message: 'Failed to increment counter.' });
    }
};

// Get a list of all organizations
exports.listOrganizations = async (req, res) => {
    const params = {
        TableName: TABLE_NAME,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :gsi2pk',
        ExpressionAttributeValues: { ':gsi2pk': 'ORGANIZATIONS' }
    };

    try {
        const { Items } = await docClient.send(new QueryCommand(params));
        res.status(200).json(Items);
    } catch (error) {
        console.error("List Organizations Error:", error);
        res.status(500).json({ message: 'Failed to retrieve organizations.' });
    }
};

// Get all organization IDs a specific user has joined
exports.getUserOrganizations = async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return res.status(400).json({ message: 'User ID is required.' });
    }

    const params = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk_prefix)',
        ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk_prefix': 'ORG#'
        },
        ProjectionExpression: 'orgId' 
    };

    try {
        const { Items } = await docClient.send(new QueryCommand(params));
        res.status(200).json(Items.map(item => item.orgId));
    } catch (error) {
        console.error("Get User Organizations Error:", error);
        res.status(500).json({ message: 'Failed to retrieve user organizations.' });
    }
};
