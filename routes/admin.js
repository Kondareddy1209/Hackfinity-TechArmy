const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Import the User model
const { requireAuth } = require('../middleware/authMiddleware'); // Assuming requireAuth is needed for admin routes
const admin = require('firebase-admin'); // Needed for server-side Firestore operations if you expand user management

// GET /admin/login - render the admin login page
router.get('/login', (req, res) => {
  res.render('admin_login', { error: null, message: null });
});

// GET /admin/users - render the manage users page for admin
// Apply requireAuth to protect this route
router.get('/users', requireAuth, async (req, res) => {
  try {
    const loggedInUser = res.locals.user; // Get the logged-in user from res.locals

    // Ensure only admins can access this page
    if (!loggedInUser || loggedInUser.role !== 'admin') {
      return res.status(403).render('403', { title: 'Access Denied', user: loggedInUser, message: 'You do not have permission to view this page.' });
    }

    const allUsers = await User.find({}); // Fetch all users from MongoDB
    res.render('admin_user', {
      user: loggedInUser, // Pass the logged-in admin user
      allUsers: allUsers, // Pass all users to the template
      error: null,
      message: null
    });
  } catch (error) {
    console.error('Error fetching users for admin_user page:', error);
    res.status(500).render('500', { title: 'Server Error', user: res.locals.user, error: 'Failed to load users.' });
  }
});

// POST /admin/users/update-role/:id - Handle updating user roles
router.post('/users/update-role/:id', requireAuth, async (req, res) => {
  try {
    const loggedInUser = res.locals.user;
    if (!loggedInUser || loggedInUser.role !== 'admin') {
      return res.status(403).send('Access Denied');
    }

    const userIdToUpdate = req.params.id;
    const { newRole } = req.body;

    // Prevent admin from changing their own role (optional, but good practice)
    if (loggedInUser._id.toString() === userIdToUpdate && newRole !== 'admin') {
      return res.redirect('/admin/users?error=' + encodeURIComponent('Cannot demote your own account.'));
    }

    const userToUpdate = await User.findById(userIdToUpdate);
    if (!userToUpdate) {
      return res.redirect('/admin/users?error=' + encodeURIComponent('User not found.'));
    }

    userToUpdate.role = newRole;
    await userToUpdate.save();

    res.redirect('/admin/users?message=' + encodeURIComponent('User role updated successfully!'));

  } catch (error) {
    console.error('Error updating user role:', error);
    res.redirect('/admin/users?error=' + encodeURIComponent('Failed to update user role.'));
  }
});

// POST /admin/users/delete/:id - Handle deleting a user
router.post('/users/delete/:id', requireAuth, async (req, res) => {
  try {
    const loggedInUser = res.locals.user;
    if (!loggedInUser || loggedInUser.role !== 'admin') {
      return res.status(403).send('Access Denied');
    }

    const userIdToDelete = req.params.id;

    // Prevent admin from deleting their own account
    if (loggedInUser._id.toString() === userIdToDelete) {
      return res.redirect('/admin/users?error=' + encodeURIComponent('Cannot delete your own account.'));
    }

    const result = await User.deleteOne({ _id: userIdToDelete });

    if (result.deletedCount === 0) {
      return res.redirect('/admin/users?error=' + encodeURIComponent('User not found or already deleted.'));
    }

    res.redirect('/admin/users?message=' + encodeURIComponent('User deleted successfully!'));

  } catch (error) {
    console.error('Error deleting user:', error);
    res.redirect('/admin/users?error=' + encodeURIComponent('Failed to delete user.'));
  }
});


module.exports = router;
