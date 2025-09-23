const db = require('../config/db');  // Configuración de la base de datos

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
