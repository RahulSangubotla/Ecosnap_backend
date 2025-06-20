const { docClient, TABLE_NAME } = require('../config/dynamo-config');
const { TransactWriteCommand, QueryCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { getConversationId } = require('../utils/conversationUtils');
const { v4: uuidv4 } = require('uuid');

// Helper function to get user details from a userId
const getUserDetails = async (userId) => {
    const params = {
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: `METADATA#${userId}` }
    };
    try {
        const { Item } = await docClient.send(new GetCommand(params));
        return Item;
    } catch (error) {
        console.error(`Error fetching details for user ${userId}:`, error);
        return null;
    }
};

// Send a message to another user
exports.sendMessage = async (req, res) => {
    // Destructure new possible fields from the request body
    const { senderId, receiverId, content, contentType = 'text', imageUrl, description } = req.body;

    if (!receiverId) {
        return res.status(400).json({ message: 'Receiver ID is required.' });
    }

    const conversationId = getConversationId(senderId, receiverId);
    const timestamp = new Date().toISOString();
    const messageId = uuidv4();

    const messageItem = {
        PK: `CONVO#${conversationId}`,
        SK: `MSG#${timestamp}#${messageId}`,
        senderId,
        receiverId,
        contentType,
        createdAt: timestamp,
    };

    let lastMessageText = '';

    // Handle different message types
    if (contentType === 'image') {
        if (!imageUrl) {
            return res.status(400).json({ message: 'imageUrl is required for image messages.' });
        }
        messageItem.imageUrl = imageUrl;
        if (description) {
            messageItem.description = description;
        }
        // Set the text for the conversation preview
        lastMessageText = description ? `📷 ${description}` : '📷 Photo';
    } else { // 'text'
        if (!content) {
            return res.status(400).json({ message: 'Content is required for text messages.' });
        }
        messageItem.content = content;
        lastMessageText = content;
    }

    const transactionParams = {
        TransactItems: [
            { Put: { TableName: TABLE_NAME, Item: messageItem } },
            // Update the conversation metadata for both users with the new lastMessageText
            { Put: { TableName: TABLE_NAME, Item: { PK: `USER#${senderId}`, SK: `CONVO#${receiverId}`, lastMessage: lastMessageText, lastMessageTimestamp: timestamp, otherUserId: receiverId } } },
            { Put: { TableName: TABLE_NAME, Item: { PK: `USER#${receiverId}`, SK: `CONVO#${senderId}`, lastMessage: lastMessageText, lastMessageTimestamp: timestamp, otherUserId: senderId } } }
        ]
    };

    try {
        await docClient.send(new TransactWriteCommand(transactionParams));
        res.status(201).json(messageItem);
    } catch (error) {
        console.error("Send Message Error:", error);
        res.status(500).json({ message: 'Failed to send message.' });
    }
};

// Get the list of all conversations for the logged-in user
exports.getConversations = async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ message: 'User ID is required.' });
    }

    const params = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk_prefix)',
        ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':sk_prefix': 'CONVO#' },
        ScanIndexForward: false
    };

    try {
        const { Items } = await docClient.send(new QueryCommand(params));
        
        const enrichedConversations = await Promise.all(Items.map(async (convo) => {
            const userDetails = await getUserDetails(convo.otherUserId);
            return {
                ...convo,
                otherUsername: userDetails ? userDetails.username : 'Unknown User',
            };
        }));

        res.status(200).json(enrichedConversations);
    } catch (error) {
        console.error("Get Conversations Error:", error);
        res.status(500).json({ message: 'Failed to retrieve conversations.' });
    }
};

// Get all messages within a single conversation
exports.getMessages = async (req, res) => {
    const { userId, otherUserId } = req.body;
    if (!userId || !otherUserId) {
        return res.status(400).json({ message: 'Both userId and otherUserId are required.' });
    }

    const conversationId = getConversationId(userId, otherUserId);
    const params = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk_prefix)',
        ExpressionAttributeValues: {
            ':pk': `CONVO#${conversationId}`,
            ':sk_prefix': 'MSG#'
        },
        ScanIndexForward: true
    };

    try {
        const { Items } = await docClient.send(new QueryCommand(params));
        res.status(200).json(Items.reverse());
    } catch (error) {
        console.error("Get Messages Error:", error);
        res.status(500).json({ message: 'Failed to retrieve messages.' });
    }
};
