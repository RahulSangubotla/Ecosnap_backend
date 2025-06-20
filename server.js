const express = require('express');
const cors = require('cors');
require('dotenv').config();

// --- 1. Import all your existing route handlers ---
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const orgRoutes = require('./routes/orgRoutes');
const charityRoutes = require('./routes/charityRoutes');

// --- 2. Import the new controller for handling uploads ---
const uploadController = require('./controllers/upload.controller.js'); 

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// --- 3. Define all your API routes ---
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/charities', charityRoutes);

// --- 4. Add the new route for file uploads ---
// This creates the endpoint at POST /api/upload/image
// that your Flutter app is trying to call.
app.post('/api/upload/image', uploadController.uploadImage);


app.get('/', (req, res) => {
    res.send('Ecosnap Backend is running!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
