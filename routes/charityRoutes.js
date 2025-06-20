const express = require('express');
const router = express.Router();
const charityController = require('../controllers/charityController');

// Route to create a new charity
router.post('/create', charityController.createCharity);

// Route to get a list of all charities
router.get('/', charityController.listCharities);

// Route for a user to sign up for a charity
router.post('/:charityId/signup', charityController.signupForCharity);

// Route to get all charities a specific user has joined
router.get('/user/:userId', charityController.getUserCharities);

module.exports = router;
