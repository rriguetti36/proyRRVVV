const db = require('../config/db');  // Configuración de la base de datos

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

//   static async getById(id) {
//     try {
//       const [results] = await db.query("SELECT * FROM productos WHERE id = ?", [id]);
//       return results[0];
//     } catch (err) {
//       throw err;
//     }
//   }

//   static async create(producto) {
//     try {
//       const [results] = await db.query("INSERT INTO productos SET ?", producto);
//       return results;
//     } catch (err) {
//       throw err;
//     }
//   }

//   static async update(id, producto) {
//     try {
//       const [results] = await db.query("UPDATE productos SET ? WHERE id = ?", [producto, id]);
//       return results;
//     } catch (err) {
//       throw err;
//     }
//   }

//   static async delete(id) {
//     try {
//       const [results] = await db.query("DELETE FROM productos WHERE id = ?", [id]);
//       return results;
//     } catch (err) {
//       throw err;
//     }
//   }
}

module.exports = Mortalidad;
