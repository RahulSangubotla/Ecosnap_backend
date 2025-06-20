const express = require('express');
const router = express.Router();
const orgController = require('../controllers/orgController');
const authMiddleware = require('../middleware/authMiddleware');

// To protect these routes, you would uncomment the line below
// router.use(authMiddleware);

// Route to create a new organization
router.post('/create', orgController.createOrganization);

// Route to get a list of all organizations
router.get('/', orgController.listOrganizations);

// Route for a user to sign up for an organization
router.post('/:orgId/signup', orgController.signupForOrganization);

// Route to increment the custom counter
router.post('/:orgId/increment', orgController.incrementCustomCounter);

//Route to get all organizations a user is part of
router.get('/user/:userId', orgController.getUserOrganizations);


module.exports = router;