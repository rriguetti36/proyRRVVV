//configuraion SQL server
const { sql, poolPromise } = require('../config/db');
const bcrypt = require('bcryptjs');

class Autenticacion {
    static async login(usuario, password) {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('usuario', sql.VarChar, usuario)
            .query(`SELECT * FROM m_usuarios WHERE v_usuario = @usuario AND i_estado = 1`);

        const user = result.recordset[0];
        if (!user) return null;

        console.log("password", password);
        console.log("user.v_password", user.v_password);

        const validPass = await bcrypt.compare(password, user.v_password);
        if (!validPass) return null;

        return {
            id: user.id,
            usuario: user.v_usuario,
            nombres: user.v_nombres,
            rol: user.id_rol
        };
    }
}

module.exports = Autenticacion;