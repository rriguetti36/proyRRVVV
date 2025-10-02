//configuraion SQL server
const { sql, poolPromise } = require('../config/db');

class Mortalidad {
  // Método genérico reutilizable
  static async getTabla(nombreTabla) {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query(`SELECT * FROM ${nombreTabla}`);
      return result.recordset;
    } catch (err) {
      console.error(`❌ Error consultando la tabla ${nombreTabla}:`, err);
      throw err;
    }
  }

  static async getAllMortalCab() {
    return this.getTabla("c_tablamortal_dim_c");
  }

  static async getAllMortalDet() {
    return this.getTabla("c_tablamortal_dim_d");
  }

  static async getAllMortalProc() {
    return this.getTabla("c_tablamortal_dim_p");
  }
}

module.exports = Mortalidad;

/* const db = require('../config/db');  // Configuración de la base de datos

class Mortalidad {
  static async getAllMortalCab() {
    console.log("entra a consultar")
    const query = 'select * from c_tablamortal_dim_c';
    try {
      const [results] = await db.query(query);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async getAllMortalDet() {
    const query = 'select * from c_tablamortal_dim_d';
    try {
      const [results] = await db.query(query);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async getAllMortalProc() {
    //const query = 'select edad, n_val_' + sex + '_' + inv +' from c_tablamortal_dim_d';
    const query = 'select * from c_tablamortal_dim_p';
    try {
      const [results] = await db.query(query);
      return results;
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Mortalidad; */
