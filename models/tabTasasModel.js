//configuraion SQL server
const { sql, poolPromise } = require('../config/db');

class TasasInd {
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

  // Métodos específicos que llaman al genérico
  static async getTasaTasaIPC() {
    return this.getTabla("c_tablatasaipc");
  }

  static async getTasaMercado() {
    return this.getTabla("c_tablatasamercado");
  }

  static async getTasaVentaPromedio() {
    return this.getTabla("c_tablatasaventapromedio");
  }

  static async getTasaInversiones() {
    return this.getTabla("c_tablatasainversiones");
  }

  static async getTasaReInversiones() {
    return this.getTabla("c_tablatasaareinversiones");
  }

  static async getTasaCurvaCuponCero() {
    return this.getTabla("c_tablacurvacuponcero");
  }

  static async getParametros() {
    return this.getTabla("m_parametros_val");
  }

  static async getRegionCIC() {
    return this.getTabla("c_regioncic");
  }

  static async getTopesTasas() {
    return this.getTabla("c_tasastopecalc");
  }

  static async getMatrizConfig() {
    return this.getTabla("m_configuracionmatriz");
  }

  static async getGastosSepelio() {
    return this.getTabla("c_tablasasepelio");
  }

  static async getGastosAdm() {
    return this.getTabla("c_tablasagastos");
  }

  static async getRegiones() {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT id, v_nombre FROM c_region WHERE i_estado = 1');
    return result.recordset;
  }

  static async getProvincias(idRegion) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('idRegion', sql.Int, idRegion)
      .query('SELECT id, v_nombre FROM c_provincia WHERE idreg = @idRegion AND i_estado = 1');
    return result.recordset;
  }

  static async getDistritos(idProvincia) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('idProvincia', sql.Int, idProvincia)
      .query('SELECT id, v_nombre FROM c_distrito WHERE idpro = @idProvincia AND i_estado = 1');
    return result.recordset;
  }

  static async getDistritoInfo(idDistrito) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('idDistrito', sql.Int, idDistrito)
      .query(`
        SELECT d.id AS idDistrito, d.v_nombre AS distrito,
               p.id AS idProvincia, p.v_nombre AS provincia,
               r.id AS idRegion, r.v_nombre AS region
        FROM c_distrito d
        INNER JOIN c_provincia p ON d.idpro = p.id
        INNER JOIN c_region r ON p.idreg = r.id
        WHERE d.id = @idDistrito
      `);
    return result.recordset[0];
  }

  static async getMatrizConfig() {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query('SELECT * FROM m_configuracionmatriz');
      return result.recordset; // devuelve los registros como un array
    } catch (err) {
      console.error('Error en getMatrizConfig:', err);
      throw err;
    }
  }
}
module.exports = TasasInd;

//configuraion MYSQL
/* const db = require('../config/db');  // Configuración de la base de datos

class TasasInd {
  static async getTasaTasaIPC() {
    console.log("entra a consultar")
    const query = 'select * from c_tablatasaipc';
    try {
      const [results] = await db.query(query);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async getTasaMercado() {
    const query = 'select * from c_tablatasamercado';
    try {
      const [results] = await db.query(query);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async getTasaVentaPromedio() {
    const query = 'select * from c_tablatasaventapromedio';
    try {
      const [results] = await db.query(query);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async getTasaInversiones() {
    const query = 'select * from c_tablatasainversiones';
    try {
      const [results] = await db.query(query);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async getTasaReInversiones() {
    const query = 'select * from c_tablatasareinversiones';
    try {
      const [results] = await db.query(query);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async getTasaCurvaCuponCero() {
    const query = 'select * from c_tablacurvacuponcero';
    try {
      const [results] = await db.query(query);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async getParametros() {
    const query = 'select * from m_parametros_val';
    try {
      const [results] = await db.query(query);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async getRegionCIC() {
    const query = 'select * from c_regioncic';
    try {
      const [results] = await db.query(query);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async getTopesTasas() {
    const query = 'select * from c_tasastopecalc';
    try {
      const [results] = await db.query(query);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async getMatrisConfig() {
    const query = 'select * from m_configuracionmatriz';
    try {
      const [results] = await db.query(query);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async getGastosSepelio() {
    const query = 'select * from c_tablasasepelio';
    try {
      const [results] = await db.query(query);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async getGastosAdm() {
    const query = 'select * from c_tablasagastos';
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

module.exports = TasasInd;
 */