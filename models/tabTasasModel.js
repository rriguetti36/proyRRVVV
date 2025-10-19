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

  //tasas 

  static async getMtasas() {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query("SELECT id, v_nombre, script_path FROM m_tasas where i_estado=1 ORDER BY id");
      return result.recordset;
    } catch (err) {
      console.error("Error en TasasModel.getAll:", err);
      throw err;
    }
  }

  static async listarFechas(tabla) {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT DISTINCT convert(date,CONVERT(varchar(10), f_creacion, 23)) f_creacion
        FROM ` + tabla +
      ` ORDER BY convert(date,CONVERT(varchar(10), f_creacion, 23)) DESC
    `);
    return result.recordset;
  }

  static async listarTasas(f_creacion = null) {
    const pool = await poolPromise;
    let query = `
      SELECT 
        a.id,
        d.v_nombre AS region,
        b.v_nombre AS moneda,
        c.v_nombre AS prestacion,
        a.n_valtasini,
        a.n_valtirini,
        a.n_valperini,
        a.n_valtasest,
        a.n_valtirest,
        a.n_valperest,
        a.n_valtasmej,
        a.n_valtirmej,
        a.n_valpermej
      FROM c_tasastopecalc a
      LEFT JOIN m_parametros_val b ON a.idmoneda = CONVERT(INT, b.v_cod) AND b.idpar = 10
      LEFT JOIN m_parametros_val c ON a.idprestacion = c.v_cod AND c.idpar = 33
      LEFT JOIN c_region d ON a.idmrg = d.id
      WHERE a.i_estado = 1
    `;
    if (f_creacion) {
      query += ` AND CONVERT(varchar(10), a.f_creacion, 23) = '${f_creacion}'`;
    }
    query += ` ORDER BY 1, 2, 3`;

    const result = await pool.request().query(query);
    return result.recordset;
  }

  static async listarFiltros() {
    const pool = await poolPromise;
    const regiones = (await pool.request().query(`SELECT id, v_nombre FROM c_region ORDER BY v_nombre`)).recordset;
    const monedas = (await pool.request().query(`SELECT v_cod, v_nombre FROM m_parametros_val WHERE idpar = 10 ORDER BY v_nombre`)).recordset;
    const prestaciones = (await pool.request().query(`SELECT v_cod, v_nombre FROM m_parametros_val WHERE idpar = 33 ORDER BY v_nombre`)).recordset;
    return { regiones, monedas, prestaciones };
  }

  static async obtenerIdParametro(v_nombre, idpar) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('v_nombre', sql.VarChar, v_nombre)
      .input('idpar', sql.Int, idpar)
      .query(`SELECT v_cod FROM m_parametros_val WHERE v_nombre = @v_nombre AND idpar = @idpar`);
    return result.recordset.length ? result.recordset[0].v_cod : null;
  }

  static async obtenerIdRegion(v_nombre) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('v_nombre', sql.VarChar, v_nombre)
      .query(`SELECT id FROM c_region WHERE v_nombre=@v_nombre`);
    return result.recordset.length ? result.recordset[0].id : null;
  }

  static async insertarDesdeExcel(registros) {
    const pool = await poolPromise;

    await pool.request()
      .query(`
          UPDATE c_tasastopecalc SET i_estado=0
        `);

    for (const r of registros) {
      await pool.request()
        .input('idmrg', sql.Int, r.idmrg)
        .input('idmoneda', sql.Int, r.idmoneda)
        .input('idprestacion', sql.NVarChar, r.idprestacion)
        .input('n_valtasini', sql.Decimal(18, 3), r.n_valtasini)
        .input('n_valtirini', sql.Decimal(18, 3), r.n_valtirini)
        .input('n_valperini', sql.Decimal(18, 3), r.n_valperini)
        .query(`
          INSERT INTO c_tasastopecalc (
            idmrg, idmoneda, idprestacion,
            n_valtasini, n_valtasmej, n_valtasest,
            n_valtirini, n_valtirmej, n_valtirest,
            n_valperini, n_valpermej, n_valperest,
            i_estado, f_creacion
          )
          VALUES (
            @idmrg, @idmoneda, @idprestacion,
            @n_valtasini, 0, 0,
            @n_valtirini, 0, 0,
            @n_valperini, 0, 0,
            1, GETDATE()
          )
        `);
      //return { success: true };
    }
  }

  static async actualizarValores({ id, n_valtasini, n_valtirini, n_valperini, tipo }) {
    try {
      const pool = await poolPromise;

      // 🔹 Mapear campos según el tipo de pestaña
      let campos = {};
      switch (tipo) {
        case 'estudio':
          campos = {
            n_valtasest: n_valtasini,
            n_valtirest: n_valtirini,
            n_valpeest: n_valperini
          };
          break;
        case 'mejoras':
          campos = {
            n_valtasmej: n_valtasini,
            n_valtirmej: n_valtirini,
            n_valpemej: n_valperini
          };
          break;
        default:
          // valores por defecto si es 'tope'
          campos = {
            n_valtasini: n_valtasini,
            n_valtirini: n_valtirini,
            n_valperini: n_valperini
          };
      }

      // 🔹 Construir query dinámica
      const query = `
      UPDATE c_tasastopecalc
      SET 
        ${Object.keys(campos).map(k => `${k} = @${k}`).join(', ')}
      WHERE id = @id
    `;

      const request = pool.request().input('id', sql.Int, id);

      // 🔹 Agregar inputs dinámicos
      for (const [key, value] of Object.entries(campos)) {
        request.input(key, sql.Decimal(18, 3), value);
      }

      await request.query(query);

      return { success: true };
    } catch (error) {
      console.error('Error al actualizar tasas:', error);
      throw error;
    }
  }

  static async obtenerTasas({ region, moneda, prestacion, fecha }) {
    try {
      const pool = await poolPromise;

      const result = await pool.request()
        .input('region', sql.VarChar, region || null)
        .input('moneda', sql.VarChar, moneda || null)
        .input('prestacion', sql.VarChar, prestacion || null)
        .input('fecha', sql.Date, fecha || null)
        .query(`SELECT a.id,
          d.v_nombre AS region,
          b.v_nombre AS moneda,
          c.v_nombre AS prestacion,
          a.n_valtasini,
          a.n_valtirini,
          a.n_valperini,
          a.n_valtasest,
          a.n_valtirest,
          a.n_valperest,
          a.n_valtasmej,
          a.n_valtirmej,
          a.n_valpermej
          FROM c_tasastopecalc a
          LEFT JOIN m_parametros_val b ON a.idmoneda = CONVERT(INT, b.v_cod) AND b.idpar = 10
          LEFT JOIN m_parametros_val c ON a.idprestacion = c.v_cod AND c.idpar = 33
          LEFT JOIN c_region d ON a.idmrg = d.id
          WHERE (@region IS NULL OR a.idmrg = @region)
            AND (@moneda IS NULL OR a.idmoneda = @moneda)
            AND (@prestacion IS NULL OR a.idprestacion = @prestacion)
            AND (@fecha IS NULL OR CAST(a.f_creacion AS date) >= @fecha)
          ORDER BY 1, 2, 3
      `);

      return result.recordset;

    } catch (error) {
      console.error('Error en obtenerTasas:', error);
      throw error;
    }
  }

  static async ultimafecha() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT MAX(f_creacion) AS ultimaFecha FROM c_tasastopecalc
    `);
    return result.recordset;
  }

  static async obtenerPorFechaYMoneda(fecha, idmoneda) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('fecha', sql.Date, fecha)
        .input('idmoneda', sql.Int, idmoneda)
        .query(`
          SELECT annio, n_valor
          FROM c_tablatasainversiones
          WHERE CONVERT(date, f_creacion) = @fecha
          AND idmoneda = @idmoneda
          AND activo = 1
          ORDER BY annio
        `);

      return result.recordset;
    } catch (error) {
      console.error('Error al obtener tasas de inversión:', error);
      throw error;
    }
  }

  static async guardarRegistros(registros) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      for (const reg of registros) {
        const { annio, idmoneda, n_valor, activo, f_creacion } = reg;

        // Verificar si ya existe el registro (para hacer update o insert)
        const existe = await new sql.Request(transaction)
          .input('annio', sql.Int, annio)
          .input('idmoneda', sql.Int, idmoneda)
          .input('f_creacion', sql.Date, f_creacion)
          .query(`
            SELECT COUNT(*) AS existe
            FROM c_tablatasainversiones
            WHERE annio = @annio AND idmoneda = @idmoneda AND CONVERT(date, f_creacion) = @f_creacion
          `);

        if (existe.recordset[0].existe > 0) {
          // 🔸 Actualiza si ya existe
          await new sql.Request(transaction)
            .input('annio', sql.Int, annio)
            .input('idmoneda', sql.Int, idmoneda)
            .input('f_creacion', sql.Date, f_creacion)
            .input('n_valor', sql.Decimal(18, 3), n_valor)
            .query(`
              UPDATE c_tablatasainversiones
              SET n_valor = @n_valor
              WHERE annio = @annio AND idmoneda = @idmoneda AND CONVERT(date, f_creacion) = @f_creacion
            `);
        } else {
          // 🔹 Inserta si no existe
          await new sql.Request(transaction)
            .input('annio', sql.Int, annio)
            .input('idmoneda', sql.Int, idmoneda)
            .input('n_valor', sql.Decimal(18, 3), n_valor)
            .input('activo', sql.Bit, activo)
            .input('f_creacion', sql.Date, f_creacion)
            .query(`
              INSERT INTO c_tablatasainversiones (annio, idmoneda, n_valor, activo, f_creacion)
              VALUES (@annio, @idmoneda, @n_valor, @activo, @f_creacion)
            `);
        }
      }

      await transaction.commit();
      return { success: true };

    } catch (error) {
      console.error('Error al guardar tasas de inversión:', error);
      await transaction.rollback();
      throw error;
    }
  }

  static async listaPeriodosVtaProm() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT DISTINCT v_periodo FROM c_tablatasaventapromedio ORDER BY v_periodo DESC
    `);
    return result.recordset;
  }

  static async obtenerValorVtaProm({ v_periodo, id_moneda, id_prestacion }) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('vperiodo', sql.Date, v_periodo)
      .input('idmoneda', sql.Int, id_moneda)
      .input('idprestacion', sql.NVarChar, id_prestacion)
      .query(`
        SELECT n_valor 
        FROM c_tablatasaventapromedio
        WHERE v_periodo = @vperiodo 
          AND idmoneda = @idmoneda 
          AND idprestacion = @idprestacion
      `);
    return result.recordset[0];
  }

  static async guardarRegistrosVtaProm(reg) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();
      console.log(reg)

      const { v_periodo, id_moneda, id_prestacion, n_valor } = reg;

      // Verificar si ya existe el registro (para hacer update o insert)
      const existe = await new sql.Request(transaction)
        .input('vperiodo', sql.Date, v_periodo)
        .input('idmoneda', sql.Int, id_moneda)
        .input('idprestacion', sql.NVarChar, id_prestacion)
        .query(`
                  SELECT COUNT(*) AS existe
                  FROM c_tablatasaventapromedio
                  WHERE v_periodo = @vperiodo 
                  AND idmoneda = @idmoneda 
                  AND idprestacion = @idprestacion
                `);

      if (existe.recordset[0].existe > 0) {
        // 🔸 Actualiza si ya existe
        await new sql.Request(transaction)
          .input('vperiodo', sql.Date, v_periodo)
          .input('idmoneda', sql.Int, id_moneda)
          .input('idprestacion', sql.NVarChar, id_prestacion)
          .input('nvalor', sql.Decimal(18, 3), n_valor)
          .query(`
                    UPDATE c_tablatasaventapromedio
                    SET n_valor = @nvalor
                    WHERE v_periodo = @vperiodo 
                    AND idmoneda = @idmoneda 
                    AND idprestacion = @idprestacion
                  `);
      } else {
        // 🔹 Inserta si no existe
        await new sql.Request(transaction)
          .input('vperiodo', sql.Date, v_periodo)
          .input('idmoneda', sql.Int, id_moneda)
          .input('idprestacion', sql.NVarChar, id_prestacion)
          .input('nvalor', sql.Decimal(18, 3), n_valor)
          .query(`
                    INSERT INTO c_tablatasaventapromedio (v_periodo, idmoneda, idprestacion, n_valor)
                    VALUES (@vperiodo, @idmoneda, @idprestacion, @nvalor)
                  `);
      }


      await transaction.commit();
      return { success: true };

    } catch (error) {
      console.error('Error al guardar tasas de inversión:', error);
      await transaction.rollback();
      throw error;
    }
  }

  static async getListaPeriodoCurva() {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`SELECT DISTINCT CONVERT(date, f_creacion) AS periodo FROM c_tablacurvacuponcero ORDER BY 1 DESC`);
    return result.recordset;
  }

  static async getPivotByFechaCurva(fecha) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('fecha', sql.Date, fecha)
      .query(`
        SELECT 
          mes,
          MAX(CASE WHEN idmoneda=1 THEN n_valor ELSE 0 END) AS Solesi,
          MAX(CASE WHEN idmoneda=2 THEN n_valor ELSE 0 END) AS Solesa,
          MAX(CASE WHEN idmoneda=3 THEN n_valor ELSE 0 END) AS Dolaresi,
          MAX(CASE WHEN idmoneda=4 THEN n_valor ELSE 0 END) AS Dolaresa
        FROM c_tablacurvacuponcero
        WHERE CONVERT(date, f_creacion) = @fecha
        GROUP BY mes
        ORDER BY mes
      `);
    return result.recordset;
  }

  static async insertRegistrosCurva(registros, options = {}) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    try {
      await transaction.begin();

      //Deshabilita las fechas anteriores
      await transaction.request()
        .query(`UPDATE c_tablacurvacuponcero SET activo=0`);

      //Elimina si la fecha registada es la misma
      const fecha = options.fecha;
      if (options.reemplazar) {
        await transaction.request()
          .input('fecha', sql.Date, fecha)
          .query(`DELETE FROM c_tablacurvacuponcero WHERE CONVERT(date, f_creacion) = @fecha`);
      }

      // Insert bulk: mejor usar TVP o múltiples inserts; aquí iteramos con request por simplicidad
      for (const r of registros) {
        await transaction.request()
          .input('mes', sql.Int, r.mes)
          .input('idmoneda', sql.Int, r.idmoneda)
          .input('n_valor', sql.Decimal(18, 6), r.n_valor)
          .input('activo', sql.Bit, r.activo)
          .input('fecha', sql.Date, r.f_creacion)
          .query(`
            INSERT INTO c_tablacurvacuponcero (mes, idmoneda, n_valor, activo, f_creacion)
            VALUES (@mes, @idmoneda, @n_valor, @activo, @fecha)
          `);
      }

      await transaction.commit();
      return { ok: true };
    } catch (error) {
      console.error('Error al guardar tasas de inversión:', error);
      await transaction.rollback();
      throw error;
    }
  }

  //Valores
  static async getMValores() {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query("SELECT id, v_nombre, script_path FROM m_valores where i_estado=1 ORDER BY id");
      return result.recordset;
    } catch (err) {
      console.error("Error en TasasModel.getAll:", err);
      throw err;
    }
  }

  static async listarPorPeriodoYMoneda(f_creacion, id_moneda) {
    const pool = await poolPromise;
    const res = await pool.request()
      .input('fecha', sql.Date, f_creacion)
      .input('idmoneda', sql.Int, id_moneda)
      .query(`
        SELECT * FROM m_tablagasto
        WHERE CONVERT(date, f_creacion) = @fecha AND id_moneda = @idmoneda
      `);
    return res.recordset[0];
  }

  static async guardarRegistroG(data) {
    const pool = await poolPromise;
    const { id_moneda, f_creacion, n_gastoadm, n_gastoemi, n_gastoctrsup, n_endeudamiento, n_imprenta } = data;

    // Verificar si ya existe un registro
    const check = await pool.request()
      .input('fecha', sql.Date, f_creacion)
      .input('idmoneda', sql.Int, id_moneda)
      .query(`SELECT id FROM m_tablagasto WHERE CONVERT(date, f_creacion) = @fecha AND id_moneda = @idmoneda`);

    if (check.recordset.length) {
      // Actualiza
      const id = check.recordset[0].id;
      await pool.request()
        .input('id', sql.Int, id)
        .input('n_gastoadm', sql.Decimal(18, 2), n_gastoadm)
        .input('n_gastoemi', sql.Decimal(18, 2), n_gastoemi)
        .input('n_gastoctrsup', sql.Decimal(5, 2), n_gastoctrsup)
        .input('n_endeudamiento', sql.Decimal(5, 2), n_endeudamiento)
        .input('n_imprenta', sql.Decimal(5, 2), n_imprenta)
        .query(`
          UPDATE m_tablagasto SET
          n_gastoadm=@n_gastoadm,
          n_gastoemi=@n_gastoemi,
          n_gastoctrsup=@n_gastoctrsup,
          n_endeudamiento=@n_endeudamiento,
          n_imprenta=@n_imprenta
          WHERE id=@id
        `);
      return { ok: true, message: 'Registro actualizado correctamente' };
    } else {
      // Inserta nuevo
      await pool.request()
        .input('id_moneda', sql.Int, id_moneda)
        .input('f_creacion', sql.Date, f_creacion)
        .input('n_gastoadm', sql.Decimal(18, 2), n_gastoadm)
        .input('n_gastoemi', sql.Decimal(18, 2), n_gastoemi)
        .input('n_gastoctrsup', sql.Decimal(5, 2), n_gastoctrsup)
        .input('n_endeudamiento', sql.Decimal(5, 2), n_endeudamiento)
        .input('n_imprenta', sql.Decimal(5, 2), n_imprenta)
        .input('i_activo', sql.Int, 1)
        .query(`
          INSERT INTO m_tablagasto (id_moneda, f_creacion, n_gastoadm, n_gastoemi, n_gastoctrsup, n_endeudamiento, n_imprenta, i_activo)
          VALUES (@id_moneda, @f_creacion, @n_gastoadm, @n_gastoemi, @n_gastoctrsup, @n_endeudamiento, @n_imprenta, @i_activo)
        `);
      return { ok: true, message: 'Registro guardado correctamente' };
    }
  }

  static async getMValoresOtros() {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query("SELECT id_tipren, n_prccomsup, n_prcfaclab FROM m_tablagasto_b");
      return result.recordset;
    } catch (err) {
      console.error("Error en TasasModel.getAll:", err);
      throw err;
    }
  }

  static async guardarRegistroGb(data) {
    const pool = await poolPromise;
    const { n_comsupi, n_comsupd, n_faclabi, n_faclabd } = data;
    
    // Actualizar Inmediatas (id_tipren = 1)
    await pool.request().query`
      UPDATE m_tablagasto_b
      SET n_prccomsup = ${n_comsupi}, n_prcfaclab = ${n_faclabi}
      WHERE id_tipren = 1
    `;

    // Actualizar Diferidas (id_tipren = 2)
    await pool.request().query`
      UPDATE m_tablagasto_b
      SET n_prccomsup = ${n_comsupd}, n_prcfaclab = ${n_faclabd}
      WHERE id_tipren = 2
    `;

    return { ok: true, message: 'Registro guardado correctamente' };
  }
}

module.exports = TasasInd;

