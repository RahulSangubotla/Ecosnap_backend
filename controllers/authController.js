const { docClient, TABLE_NAME } = require('../config/dynamo-config');
const { QueryCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

exports.signup = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    // GSI1 is used to enforce username uniqueness and for lookups
    const GSI1PK = `USERNAME#${username}`;
    const GSI1SK = `USERNAME#${username}`;

    // Check if username already exists using the GSI
    const queryParams = {
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk AND GSI1SK = :gsi1sk',
        ExpressionAttributeValues: { ':gsi1pk': GSI1PK, ':gsi1sk': GSI1SK }
    };

    try {
        const { Items } = await docClient.send(new QueryCommand(queryParams));
        if (Items.length > 0) {
            return res.status(409).json({ message: 'Username already exists.' });
        }

        const newUser = {
            PK: `USER#${userId}`,
            SK: `METADATA#${userId}`,
            userId,
            username,
            password: hashedPassword,
            createdAt: new Date().toISOString(),
            GSI1PK, // Add GSI keys to the item
            GSI1SK
        };

        const putParams = { TableName: TABLE_NAME, Item: newUser };
        await docClient.send(new PutCommand(putParams));

        res.status(201).json({ message: 'User created successfully.', userId });
    } catch (error) {
        console.error("Signup Error:", error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.login = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    const GSI1PK = `USERNAME#${username}`;
    const GSI1SK = `USERNAME#${username}`;

    const queryParams = {
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk AND GSI1SK = :gsi1sk',
        ExpressionAttributeValues: { ':gsi1pk': GSI1PK, ':gsi1sk': GSI1SK }
    };

    try {
        const { Items } = await docClient.send(new QueryCommand(queryParams));
        if (Items.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const user = Items[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        
        // Generate JWT
        const token = jwt.sign(
            { userId: user.userId, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({ token, userId: user.userId, username: user.username });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};