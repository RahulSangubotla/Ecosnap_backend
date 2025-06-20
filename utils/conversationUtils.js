function getConversationId(userId1, userId2) {
    // Sort the user IDs lexicographically to ensure consistency
    const users = [userId1, userId2].sort();
    return users.join('#');
}

module.exports = { getConversationId };