const express = require('express');
const { validateSession } = require('./middleware');
const { notifyAdmins } = require('./notificator');

const router = express.Router();

router.post(`${process.env.BASE_PATH}/logout`, validateSession, (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ status: "error", message: "Error logging out" });
        notifyAdmins(`User logged out: ${req.session.username}, IP: ${req.ip}`);
        res.json({ status: "success", message: "Logout successful" });
    });
});

module.exports = router;