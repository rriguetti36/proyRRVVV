// middleware/auditUser.js
const { poolPromise } = require('../config/db');

module.exports = async (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/auth/login');
    }

    try {
        const pool = await poolPromise;

        await pool.request()
            .input('userId', req.session.user.id) // el ID del usuario logueado
            .query("EXEC sp_set_audit_user_id @userId;");

    } catch (error) {
        console.error("Error al registrar usuario en contexto:", error);
    }

    next();
};
