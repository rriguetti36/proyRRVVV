//configuraion SQL server
const { sql, poolPromise } = require('../config/db');

class cotizacion {

  static async creacotizacion(data) {
    try {
      const {
        numoperacion,
        fechacarga,
        fechaenvio,
        fechacierre,
        fechacal,
        estado,
        idcia
      } = data;

      // Normalizamos fechas: si vienen vacías o en blanco, las mandamos como null
      const fechaCargaDB = fechacarga?.trim() ? fechacarga : null;
      const fechaEnvioDB = fechaenvio?.trim() ? fechaenvio : null;
      const fechaCierreDB = fechacierre?.trim() ? fechacierre : null;
      const fechaCalDB = fechacal?.trim() ? fechacal : null;

      const [result] = await db.execute(
        `INSERT INTO c_cotizaciones (
        numoperacion,
        fechacarga,
        fechaenvio,
        fechacierre,
        fechacal,
        estado,
        idcia
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          numoperacion,
          fechaCargaDB,
          fechaEnvioDB,
          fechaCierreDB,
          fechaCalDB,
          estado,
          idcia
        ]
      );

      return {
        id: result.insertId, // ID autogenerado
        ...data              // devolvemos los mismos datos enviados
      };
    } catch (err) {
      console.error("❌ Error en creacotizacion:", err);
      throw err;
    }
  }

  static async getTablaCotizacion(estado) {
    try {
      const pool = await poolPromise;  // obtenemos el pool de conexiones
      const result = await pool.request()
        .input('estado', sql.Int, estado) // definimos parámetro @estado
        .query('SELECT * FROM c_cotizaciones WHERE estado = @estado');

      return result.recordset; // en SQL Server los resultados están en recordset
    } catch (err) {
      throw err;
    }
  }

  static async getTablaSolicitudesMELER() {
    try {
      const pool = await poolPromise; // abre conexión al pool
      const result = await pool.request().query(`
      SELECT 
        a.id_estado, 
        a.id, 
        a.v_descripcion, 
        b.fec_envio, 
        b.fec_cierre, 
        MIN(b.num_operacion) AS inisol, 
        MAX(b.num_operacion) AS finsol
      FROM c_solicitudes_meler a 
      JOIN c_solicitudes_meler_det b ON a.id = b.id_archivo 
      WHERE a.id_estado >= 1
      GROUP BY 
        a.id_estado, 
        a.id, 
        a.v_descripcion, 
        b.fec_envio, 
        b.fec_cierre
      ORDER BY a.id DESC
    `);

      return result.recordset; // en mssql los resultados están en recordset
    } catch (err) {
      console.error("Error en getTablaSolicitudesMELER:", err);
      throw err;
    }
  }

  static async validaExisteOperacion(numeroOp) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input("numeroOp", sql.Int, numeroOp)
        .query("SELECT COUNT(*) AS valor FROM c_solicitudes_meler_det WHERE num_operacion = @numeroOp");

      return Number(result.recordset[0].valor);
    } catch (err) {
      throw err;
    }
  }

  static async getCotizacionind(id) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input("id", sql.Int, id)
        .query(`
        SELECT id_tipren, id_moneda, num_mesdif, num_mesgar, mto_pension 
        FROM c_cotizaciondetalle 
        WHERE num_operacion = @id
      `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  static async getCotizacionesCalculadasCarga23(id) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input("id", sql.Int, id)
        .query(`
        SELECT 
          d.num_operacion AS operacion, 
          c.num_cuspp AS CUSPP, 
          tiporenta.v_codsbs AS modalidad, 
          monedacot.v_codsbs AS moneda, 
          d.num_mesdif AS anosRT, 
          d.val_rentart AS porcentajeRVD, 
          d.num_mesgar AS periodoGarantizado, 
          d.ind_dercre AS derechoCrecer, 
          d.ind_dergra AS gratificacion, 
          CASE WHEN d.id_rechazo = 0 THEN 'S' ELSE 'N' END siCotizaNoCotiza,
          d.num_cot AS nroCotizacion, 
          ROUND(d.mto_pension,2) AS penref, 
          ROUND(d.mto_pensionRT,2) AS penafp, 
          ROUND(d.mto_sumpenben,2) AS pencia, 
          ROUND(d.mto_priAFP,2) AS primaUnicaAFPEESS, 
          ROUND(d.mto_priuni,2) AS primaUnicaEESS, 
          ROUND(d.val_tasavta,2) AS tasavta
        FROM c_cotizacion c
        JOIN c_cotizaciondetalle d ON c.id_cot = d.id_cot
        JOIN m_parametros_val afp ON afp.v_cod = c.id_afp AND afp.idpar = 1
        JOIN m_parametros_val monedacot ON monedacot.v_cod = d.id_moneda AND monedacot.idpar = 10
        JOIN m_parametros_val tiporenta ON tiporenta.v_cod = d.id_tipren AND tiporenta.idpar = 13
        JOIN c_solicitudes_meler_det sm ON c.num_operacion = sm.num_operacion
        WHERE sm.id_archivo = @id
        ORDER BY d.num_operacion ASC
      `);

      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  static async insertRegistraAcepta(ope, cor, fecha) {
    try {
      const pool = await poolPromise;

      const fechaAcepta = fecha && fecha.trim() !== "" ? fecha : null;

      const result = await pool.request()
        .input("fechaAcepta", sql.DateTime, fechaAcepta)
        .input("ope", sql.Int, ope)
        .input("cor", sql.Int, cor)
        .query(`
        UPDATE c_cotizaciondetalle 
        SET fec_acepta = @fechaAcepta, id_estado = 3
        WHERE num_operacion = @ope AND id_correlativo = @cor
      `);

      return result.rowsAffected[0] > 0;
    } catch (err) {
      throw err;
    }
  }

  static async insertaSolicitudesMeler(data) {
    const pool = await poolPromise;
    const transaction = pool.transaction();

    try {
      await transaction.begin();

      // 1. Insertar en c_solicitudes_meler (OUTPUT para recuperar ID)
      const request1 = new sql.Request(transaction);
      const res = await request1
        .input("idtipo", sql.Int, data.tipoArchivo)
        .input("v_descripcion", sql.VarChar(255), data.nombreArchivo)
        .input("fec_carga", sql.DateTime, data.fechaCarga)
        .input("idusuario", sql.Int, data.idusuario)
        .input("id_estado", sql.Int, data.estado)
        .query(`
        INSERT INTO c_solicitudes_meler (idtipo, v_descripcion, fec_carga, idusuario, id_estado)
        OUTPUT INSERTED.id_archivo AS idArchivo
        VALUES (@idtipo, @v_descripcion, @fec_carga, @idusuario, @id_estado)
      `);

      const idArchivo = res.recordset[0].idArchivo;

      // 2. Insertar múltiples registros en c_solicitudes_meler_det
      if (data.solicitudes && data.solicitudes.length > 0) {
        for (const p of data.solicitudes) {
          const request2 = new sql.Request(transaction);
          await request2
            .input("id_archivo", sql.Int, idArchivo)
            .input("num_operacion", sql.Int, parseInt(p.numeroop))
            .input("fec_envio", sql.DateTime, p.fecenvio)
            .input("fec_cierre", sql.DateTime, p.feccierre)
            .input("id_error", sql.Int, p.iderror)
            .input("v_descrierror", sql.VarChar(500), p.descrierror)
            .query(`
            INSERT INTO c_solicitudes_meler_det 
            (id_archivo, num_operacion, fec_envio, fec_cierre, id_error, v_descrierror)
            VALUES (@id_archivo, @num_operacion, @fec_envio, @fec_cierre, @id_error, @v_descrierror)
          `);
        }
      }

      await transaction.commit();
      console.log("Solicitud guardada en Matriz de errores.");
      return idArchivo;

    } catch (err) {
      if (transaction._aborted !== true) {
        await transaction.rollback();
      }
      console.error("Error al guardar:", err);
      throw err;
    }
  }

  static async insertaCotizacionesCalc(data) {
    const pool = await poolPromise;
    const transaction = pool.transaction();

    try {
      await transaction.begin();

      const request = transaction.request();

      // 0. Obtener numerador actual
      const anioActual = new Date().getFullYear();
      const numeradorRes = await request
        .input('anio', sql.Int, anioActual)
        .query(`SELECT n_numcot FROM m_numeradores WHERE n_aperiodo = @anio`);

      if (numeradorRes.recordset.length === 0) {
        throw new Error(`No se encontró numerador para el periodo ${anioActual}`);
      }

      let numerofinal = Number(numeradorRes.recordset[0].n_numcot);

      // Iterar por cabeceras
      for (const c of data.cabecera) {
        const numeroConCeros = String(numerofinal).padStart(6, "0");
        const nuevoNumCotFin = `${anioActual}${numeroConCeros}`;

        // 1. Insertar cabecera
        const cabReq = transaction.request();
        const resultCab = await cabReq
          .input('num_cot', sql.VarChar, nuevoNumCotFin)
          .input('num_operacion', sql.Int, c.num_operacion)
          .input('fec_suscripcion', sql.DateTime, c.fec_suscripcion)
          .input('fec_envio', sql.DateTime, c.fec_envio)
          .input('fec_cierre', sql.DateTime, c.fec_cierre)
          .input('fec_devenge', sql.DateTime, c.fec_devenge)
          .input('id_afp', sql.Int, c.id_afp)
          .input('id_prestacion', sql.Int, c.id_prestacion)
          .input('id_tipobenef', sql.Int, c.id_tipobenef)
          .input('id_estciv', sql.Int, c.id_estciv)
          .input('ind_clientecia', sql.Int, c.ind_clientecia)
          .input('num_cuspp', sql.VarChar, c.num_cuspp)
          .input('id_sucursal', sql.Int, c.id_sucursal)
          .input('num_aniojubila', sql.Int, c.num_aniojubila)
          .input('num_cargas', sql.Int, c.num_cargas)
          .input('id_agente', sql.Int, c.id_agente)
          .input('num_docagente', sql.VarChar, c.num_docagente)
          .input('id_moneda', sql.Int, c.id_moneda)
          .input('val_tcfondo', sql.Decimal(18, 4), c.val_tcfondo)
          .input('mto_capitalfon', sql.Decimal(18, 4), c.mto_capitalfon)
          .input('mto_cicfon', sql.Decimal(18, 4), c.mto_cicfon)
          .input('mto_bonofon', sql.Decimal(18, 4), c.mto_bonofon)
          .input('mto_priuni', sql.Decimal(18, 4), c.mto_priuni)
          .input('mto_cic', sql.Decimal(18, 4), c.mto_cic)
          .input('mto_bono', sql.Decimal(18, 4), c.mto_bono)
          .input('val_tasart', sql.Decimal(18, 4), c.val_tasart)
          .input('mto_apoadi', sql.Decimal(18, 4), c.mto_apoadi)
          .input('ind_cober', sql.Int, c.ind_cober)
          .input('id_tipocot', sql.Int, c.id_tipocot)
          .input('id_estadocot', sql.Int, c.id_estadocot)
          .input('num_mensual', sql.Int, c.num_mensual)
          .input('id_tipofon', sql.Int, c.id_tipofon)
          .input('id_region', sql.Int, c.id_region)
          .input('fec_devsol', sql.DateTime, c.fec_devsol)
          .query(`
          INSERT INTO c_cotizacion (
            num_cot, num_operacion, fec_suscripcion, fec_envio, fec_cierre, fec_devenge,
            id_afp, id_prestacion, id_tipobenef, id_estciv, ind_clientecia, num_cuspp, id_sucursal,
            num_aniojubila, num_cargas, id_agente, num_docagente, id_moneda, val_tcfondo,
            mto_capitalfon, mto_cicfon, mto_bonofon, mto_priuni, mto_cic, mto_bono, val_tasart,
            mto_apoadi, ind_cober, id_tipocot, id_estadocot, num_mensual, id_tipofon, id_region, fec_devsol
          )
          OUTPUT INSERTED.id_cot
          VALUES (
            @num_cot, @num_operacion, @fec_suscripcion, @fec_envio, @fec_cierre, @fec_devenge,
            @id_afp, @id_prestacion, @id_tipobenef, @id_estciv, @ind_clientecia, @num_cuspp, @id_sucursal,
            @num_aniojubila, @num_cargas, @id_agente, @num_docagente, @id_moneda, @val_tcfondo,
            @mto_capitalfon, @mto_cicfon, @mto_bonofon, @mto_priuni, @mto_cic, @mto_bono, @val_tasart,
            @mto_apoadi, @ind_cober, @id_tipocot, @id_estadocot, @num_mensual, @id_tipofon, @id_region, @fec_devsol
          )
        `);

        const idCotizacion = resultCab.recordset[0].id_cot;

        // 2. Insertar detalles
        const detalles = data.detalle.filter(d => d.num_operacion === c.num_operacion);
        for (const d of detalles) {
          const detReq = transaction.request();
          await detReq
            .input('id_cot', sql.Int, idCotizacion)
            .input('num_cot', sql.VarChar, nuevoNumCotFin)
            .input('id_correlativo', sql.Int, d.id_correlativo)
            .input('num_operacion', sql.Int, d.num_operacion)
            .input('fec_calcot', sql.DateTime, d.fec_calcot)
            // ⚠️ aquí seguirías con todos los campos uno por uno como arriba...
            .query(`
            INSERT INTO c_cotizaciondetalle (
              id_cot, num_cot, id_correlativo, num_operacion, fec_calcot, id_moneda
            )
            VALUES (@id_cot, @num_cot, @id_correlativo, @num_operacion, @fec_calcot, @id_moneda)
          `);
        }

        // 3. Insertar beneficiarios
        const beneficiarios = data.beneficiario.filter(b => b.num_operacion === c.num_operacion);
        for (const b of beneficiarios) {
          const benReq = transaction.request();
          await benReq
            .input('id_cot', sql.Int, idCotizacion)
            .input('num_cot', sql.VarChar, nuevoNumCotFin)
            .input('id_orden', sql.Int, b.id_orden)
            .input('num_operacion', sql.Int, b.num_operacion)
            .input('id_parentesco', sql.Int, b.id_parentesco)
            // ⚠️ igual que arriba: ir agregando .input() por cada campo
            .query(`
            INSERT INTO c_cotizacionbeneficiario (
              id_cot, num_cot, id_orden, num_operacion, id_parentesco
            )
            VALUES (@id_cot, @num_cot, @id_orden, @num_operacion, @id_parentesco)
          `);
        }

        numerofinal++;
      }

      // 4. Actualizar numerador
      await transaction.request()
        .input('nuevoNum', sql.Int, numerofinal)
        .input('anio', sql.Int, anioActual)
        .query(`UPDATE m_numeradores SET n_numcot = @nuevoNum WHERE n_aperiodo = @anio`);

      await transaction.commit();
      console.log("✅ Cotizaciones guardadas correctamente en SQL Server");
    } catch (err) {
      await transaction.rollback();
      console.error("❌ Error al guardar:", err);
      throw err;
    }
  }

  static async insertaSolicitudesRespuesta(data) {
    const pool = await poolPromise;
    const transaction = pool.transaction();

    try {
      pool = await poolPromise;
      await transaction.begin();

      // 1. Insertar cabecera en c_solicitudes_meler
      const request1 = new sql.Request(transaction);
      const res = await request1
        .input("idtipo", sql.Int, data.tipoArchivo)
        .input("v_descripcion", sql.VarChar(255), data.nombreArchivo)
        .input("fec_carga", sql.DateTime, data.fechaCarga)
        .input("idusuario", sql.Int, data.idusuario)
        .input("id_estado", sql.Int, data.estado)
        .query(`
        INSERT INTO c_solicitudes_meler (idtipo, v_descripcion, fec_carga, idusuario, id_estado)
        OUTPUT INSERTED.id_archivo AS idArchivo
        VALUES (@idtipo, @v_descripcion, @fec_carga, @idusuario, @id_estado)
      `);

      const idArchivo = res.recordset[0].idArchivo;
      console.log("📥 Insertado cabecera id:", idArchivo);

      // 2. Insertar detalle en c_solicitudes_meler_res
      if (data.respuestas && Array.isArray(data.respuestas) && data.respuestas.length > 0) {
        for (const r of data.respuestas) {
          const request2 = new sql.Request(transaction);
          await request2
            .input("id_archivo", sql.Int, idArchivo)
            .input("num_operacion", sql.Int, r.nroOperacion)
            .input("num_cussp", sql.VarChar(50), r.CUSPP)
            .input("var_desicion", sql.VarChar(50), r.decisionAfiliado)
            .input("var_modalidad", sql.VarChar(50), r.modalidad)
            .input("var_moneda", sql.VarChar(10), r.moneda)
            .input("num_anosRT", sql.Int, r.pd)
            .input("num_periodoGarantizado", sql.Int, r.pg)
            .input("num_porcentajeRVD", sql.Decimal(10, 4), r.porRVD)
            .input("var_derechoCrecer", sql.VarChar(10), r.dercre)
            .input("var_gratificacion", sql.VarChar(10), r.grati)
            .input("var_tipo", sql.VarChar(20), r.tipo)
            .input("var_codigo", sql.VarChar(20), r.codigo)
            .input("var_atiende", sql.VarChar(20), r.atiende)
            .input("var_gana", sql.VarChar(20), r.gana)
            .input("var_cotiza", sql.VarChar(20), r.cotiza)
            .input("var_cotizacion", sql.VarChar(20), r.nroCotizacion)
            .input("num_tasaafp", sql.Decimal(10, 4), r.tasaAFP)
            .input("num_pensionafp", sql.Decimal(18, 2), r.pensionAFP)
            .input("num_tasaaseg", sql.Decimal(10, 4), r.tasaAseg)
            .input("num_pesnionaseg", sql.Decimal(18, 2), r.pensionAseg)
            .query(`
            INSERT INTO c_solicitudes_meler_res (
              id_archivo, num_operacion, num_cussp, var_desicion, var_modalidad, var_moneda,
              num_anosRT, num_periodoGarantizado, num_porcentajeRVD, var_derechoCrecer,
              var_gratificacion, var_tipo, var_codigo, var_atiende, var_gana, var_cotiza,
              var_cotizacion, num_tasaafp, num_pensionafp, num_tasaaseg, num_pesnionaseg
            )
            VALUES (
              @id_archivo, @num_operacion, @num_cussp, @var_desicion, @var_modalidad, @var_moneda,
              @num_anosRT, @num_periodoGarantizado, @num_porcentajeRVD, @var_derechoCrecer,
              @var_gratificacion, @var_tipo, @var_codigo, @var_atiende, @var_gana, @var_cotiza,
              @var_cotizacion, @num_tasaafp, @num_pensionafp, @num_tasaaseg, @num_pesnionaseg
            )
          `);
        }
      }

      await transaction.commit();
      console.log("✅ Solicitud y respuestas guardadas con éxito");
      return idArchivo;

    } catch (err) {
      if (transaction._aborted !== true) {
        await transaction.rollback();
      }
      console.error("❌ Error al guardar:", err);
      throw err;
    }
  }

  static async getTablaSolicitudRespuesta(id) {
    try {
      const pool = await poolPromise;

      const query = `
      SELECT 
        num_operacion AS nroOperacion,
        num_cussp AS CUSPP,
        var_desicion AS decisionAfiliado,
        var_modalidad AS modalidad,
        var_moneda AS moneda,
        num_anosRT AS pd,
        num_periodoGarantizado AS pg,
        num_porcentajeRVD AS porRVD,
        var_derechoCrecer AS dercre,
        var_gratificacion AS grati,
        var_tipo AS tipo,
        var_codigo AS codigo,
        var_atiende AS atiende,
        var_gana AS gana,
        var_cotiza AS cotiza,
        var_cotizacion AS nroCotizacion,
        num_tasaafp AS tasaAFP,
        num_pensionafp AS pensionAFP,
        num_tasaaseg AS tasaAseg,
        num_pesnionaseg AS pensionAseg
      FROM c_solicitudes_meler_res
      WHERE id_archivo = @id
    `;

      const result = await pool.request()
        .input('id', sql.Int, id) // definimos el parámetro
        .query(query);

      return result.recordset;
    } catch (err) {
      console.error("❌ Error en getTablaSolicitudRespuesta:", err);
      throw err;
    }
  }
}

module.exports = cotizacion;


//configuraion MYSQL
/* const db = require('../config/db');  // Configuración de la base de datos
class cotizacion {
  static async creacotizacion(data) {
    try {
      const { numoperacion, fechacarga, fechaenvio, fechacierre, fechacal, estado, idcia } = data;

      const fechaCargaDB = fechacarga && fechacarga.trim() !== '' ? fechacarga : null;
      const fechaEnvioDB = fechaenvio && fechaenvio.trim() !== '' ? fechaenvio : null;
      const fechaCierreDB = fechacierre && fechacierre.trim() !== '' ? fechacierre : null;
      const fechaCalDB = fechacal && fechacal.trim() !== '' ? fechacal : null;

      // console.log("numoperacion",numoperacion);
      // console.log("fechacarga",fechacarga);
      // console.log("fechaenvio",fechaenvio);
      // console.log("fechacierre",fechacierre);
      // console.log("fechacal",fechacal);
      // console.log("estado",estado);
      // console.log("idcia",idcia);
      const [result] = await db.execute(
        'INSERT INTO c_cotizaciones (numoperacion, fechacarga, fechaenvio, fechacierre, fechacal, estado, idcia) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [numoperacion, fechaCargaDB, fechaEnvioDB, fechaCierreDB, fechaCalDB, estado, idcia]
      );
      return { id: result.insertId, ...data };
    } catch (err) {
      throw err;
    }
  }

  static async getTablaCotizacion(estado) {
    //console.log("entra a consultar")
    const query = 'select * from c_cotizaciones where estado=?';
    try {
      const [results] = await db.query(query, [estado]);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async getTablaSolicitudesMELER() {
    //console.log("entra a consultar")
    const query = `SELECT a.id_estado, a.id, a.v_descripcion, b.fec_envio, b.fec_cierre, min(b.num_operacion) inisol, max(b.num_operacion) finsol
                    FROM c_solicitudes_meler a join c_solicitudes_meler_det b ON a.id=b.id_archivo 
                    where id_estado>=1 
                    group by a.id, a.v_descripcion, b.fec_envio, b.fec_cierre order by id desc`;
    try {
      const [results] = await db.query(query);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async insertaSolicitudesMeler(data) {
    //console.log(data);
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Insertar en c_solicitudes_meler
      const [res] = await conn.execute(
        'INSERT INTO c_solicitudes_meler (idtipo, v_descripcion, fec_carga, idusuario, id_estado) VALUES (?,?,?,?,?)',
        [data.tipoArchivo, data.nombreArchivo, data.fechaCarga, data.idusuario, data.estado]
      );
      const idArchivo = res.insertId;

      // 2. Preparar los valores para insertar en batch
      const detalles = data.solicitudes.map(p => [idArchivo, parseInt(p.numeroop), p.feccierre, p.fecenvio, p.iderror, p.descrierror]);

      await conn.query(
        'INSERT INTO c_solicitudes_meler_det (id_archivo, num_operacion, fec_envio, fec_cierre, id_error, v_descrierror) VALUES ?',
        [detalles]
      );

      await conn.commit();
      console.log('Solicitud guadadas en Matriz de errores.');
      return idArchivo;
    } catch (err) {
      await conn.rollback();
      console.error('Error al guardar:', err);
    } finally {
      conn.release(); // ¡libera siempre la conexión!
    }

  }

  static async validaExisteOperacion(numeroOp) {
    //console.log("entra a consultar")
    const query = 'select count(*) valor from c_solicitudes_meler_det where num_operacion=?';
    try {
      const [results] = await db.query(query, [numeroOp]);
      return Number(results[0].valor);
    } catch (err) {
      throw err;
    }
  }

  static async insertaCotizacionesCalc(data) {
    //console.log(data);
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      //0.- Obtiene el numero de cotizacion
      const anioActual = new Date().getFullYear();

      const query = 'select n_numcot from m_numeradores where n_aperiodo=?';
      const [results] = await db.query(query, [anioActual]);
      let numerofinal = Number(results[0].n_numcot);
      for (const c of data.cabecera) {

        const numeroConCeros = String(numerofinal).padStart(6, '0');
        const nuevoNumCotFin = `${anioActual}${numeroConCeros}`;

        // 1. Insertar en cabecera
        const [result] = await conn.query(`
          INSERT INTO c_cotizacion (num_cot, num_operacion, fec_suscripcion, fec_envio, fec_cierre, fec_devenge, id_afp, id_prestacion, 
            id_tipobenef, id_estciv, ind_clientecia, num_cuspp, id_sucursal, num_aniojubila, num_cargas, id_agente, num_docagente, id_moneda, val_tcfondo, mto_capitalfon, 
            mto_cicfon, mto_bonofon,mto_priuni, mto_cic, mto_bono, val_tasart, mto_apoadi, ind_cober, id_tipocot, id_estadocot, num_mensual, id_tipofon, id_region, fec_devsol) 
          VALUES (?, ?, ?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?)`,
          [nuevoNumCotFin, parseInt(c.num_operacion), c.fec_suscripcion, c.fec_envio, c.fec_cierre, c.fec_devenge, c.id_afp, c.id_prestacion, c.id_tipobenef, c.id_estciv, c.ind_clientecia,
            c.num_cuspp, c.id_sucursal, c.num_aniojubila, c.num_cargas, c.id_agente, c.num_docagente, c.id_moneda, c.val_tcfondo, c.mto_capitalfon, c.mto_cicfon, c.mto_bonofon, c.mto_priuni,
            c.mto_cic, c.mto_bono, c.val_tasart, c.mto_apoadi, c.ind_cober, c.id_tipocot, c.id_estadocot, c.num_mensual, c.id_tipofon, c.id_region, c.fec_devsol]);

        const idCotizacion = result.insertId || result.recordset?.[0]?.id; // MySQL o SQL Server
        //console.log("idCotizacion", idCotizacion)
        // 2. Insertar detalles
        const detalles = data.detalle.filter(d => d.num_operacion === c.num_operacion);

        for (const d of detalles) {
          await conn.query(`
              INSERT INTO c_cotizaciondetalle (id_cot, num_cot, id_correlativo, num_operacion, fec_calcot, id_moneda, val_tcmon, mto_priuni, mto_capital,mto_bono, 
              val_agecom, val_agecomreal, mto_agecom, id_tipren, num_mesdif, id_modalidad, num_mesgar, num_mesesc, val_rentaesc, val_tasartafp, 
              val_rentart, mto_factorella, val_facorella, mto_sepelio, val_tasatce, val_tasavta, val_tasatir, val_tasagar, mto_priuni_CIA, mto_pension, 
              mto_pensiongar, mto_priAFP, mto_pensionRT, mto_reservamat, val_rentapentmp, mto_sumpenben, mto_penanual,mto_reservamatpen, mto_reservamatgs, mto_perdida, 
              val_perdida, ind_cober, ind_dercre, ind_dergra, id_estado, fec_acepta, id_rechazo, mto_resmatsepeliorv, val_ajusteipc, mto_parcap, 
              ind_calsobdiferida, val_reajustetri, val_reajustemen, des_error, ind_sisco, ind_pasofiltro) 
              VALUES (?, ?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?)`,
            [idCotizacion, nuevoNumCotFin, d.id_correlativo, d.num_operacion, d.fec_calcot, d.id_moneda, d.val_tcmon, d.mto_priuni, d.mto_capital,
              d.mto_bono, d.val_agecom, d.val_agecomreal, d.mto_agecom, d.id_tipren, d.num_mesdif, d.id_modalidad, d.num_mesgar, d.num_mesesc, d.val_rentaesc,
              d.val_tasartafp, d.val_rentart, d.mto_factorella, d.val_facorella, d.mto_sepelio, d.val_tasatce, d.val_tasavta, d.val_tasatir, d.val_tasagar,
              d.mto_priuni_CIA, d.mto_pension, d.mto_pensiongar, d.mto_priAFP, d.mto_pensionRT, d.mto_reservamat, d.val_rentapentmp, d.mto_sumpenben, d.mto_penanual,
              d.mto_reservamatpen, d.mto_reservamatgs, d.mto_perdida, d.val_perdida, d.ind_cober, d.ind_dercre, d.ind_dergra, d.id_estado, d.fec_acepta, d.id_rechazo,
              d.mto_resmatsepeliorv, d.val_ajusteipc, d.mto_parcap, d.ind_calsobdiferida, d.val_reajustetri, d.val_reajustemen, d.des_error, d.ind_sisco, d.ind_pasofiltro]);
        }

        // 3. Insertar beneficiarios
        const beneficiarios = data.beneficiario.filter(b => b.num_operacion === c.num_operacion);

        for (const b of beneficiarios) {
          await conn.query(`
              INSERT INTO c_cotizacionbeneficiario (id_cot, num_cot, id_orden, num_operacion, id_parentesco, id_grupofam, id_sexo, id_invalido, 
                fec_invalido, id_causainv, id_derpen, ind_dercre, id_tipodociden, num_dociden, des_nombre, des_nombresegundo, des_apepaterno, 
                des_apematerno, fec_nacimiento, fec_fallecimiento, fec_nachijomayor, val_pension, val_pensionleg, val_pensionrep, mto_pension, 
                mto_pensiongar, ind_estsob, ind_estudiante) 
              VALUES (?, ?, ?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?,?, ?)`,
            [idCotizacion, nuevoNumCotFin, b.id_orden, b.num_operacion, b.id_parentesco, b.id_grupofam, b.id_sexo, b.id_invalido,
              b.fec_invalido, b.id_causainv, b.id_derpen, b.ind_dercre, b.id_tipodociden, b.num_dociden, b.des_nombre, b.des_nombresegundo, b.des_apepaterno,
              b.des_apematerno, b.fec_nacimiento, b.fec_fallecimiento, b.fec_nachijomayor, b.val_pension, b.val_pensionleg, b.val_pensionrep, b.mto_pension,
              b.mto_pensiongar, b.ind_estsob, b.ind_estudiante]);
        }

        numerofinal++
      }

      await conn.query('UPDATE m_numeradores SET n_numcot = ? WHERE n_aperiodo = ?', [numerofinal, anioActual]);

      await conn.commit();
      console.log('Cotizaciones guardados correctamente.');
    } catch (err) {
      await conn.rollback();
      console.error('Error al guardar:', err);
    } finally {
      conn.release(); // ¡libera siempre la conexión!
    }

  }

  static async getCotizacionesCalculadasCarga23(id) {
    //console.log("consulta getCotizacionesCalculadasCarga23")
    const query = `SELECT 
                  d.num_operacion AS operacion, 
                  c.num_cuspp AS CUSPP, 
                  tiporenta.v_codsbs AS modalidad, 
                  monedacot.v_codsbs AS moneda, 
                  d.num_mesdif AS anosRT, 
                  d.val_rentart AS porcentajeRVD, 
                  d.num_mesgar AS periodoGarantizado, 
                  d.ind_dercre AS derechoCrecer, 
                  d.ind_dergra AS gratificacion, 
                  case when d.id_rechazo = 0 then 'S' else 'N' end siCotizaNoCotiza,
                  d.num_cot AS nroCotizacion, 
                  round(d.mto_pension,2) AS penref, 
                  round(d.mto_pensionRT,2) AS penafp, 
                  round(d.mto_sumpenben,2) AS pencia, 
                  round(d.mto_priAFP,2) AS primaUnicaAFPEESS, 
                  round(d.mto_priuni,2) AS primaUnicaEESS, 
                  round(d.val_tasavta,2) AS tasavta
              FROM c_cotizacion c
              JOIN c_cotizaciondetalle d
              ON c.id_cot = d.id_cot
              JOIN m_parametros_val as afp 
              ON afp.v_cod = c.id_afp 
              AND afp.idpar = 1
              JOIN m_parametros_val as monedacot 
              ON monedacot.v_cod = d.id_moneda 
              AND monedacot.idpar = 10
              JOIN m_parametros_val as tiporenta 
              ON tiporenta.v_cod = d.id_tipren 
              AND tiporenta.idpar = 13
              JOIN c_solicitudes_meler_det sm 
              ON c.num_operacion=sm.num_operacion
              WHERE sm.id_archivo = ?
              ORDER BY d.num_operacion ASC`;
    try {
      const [results] = await db.query(query, [id]);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async insertaSolicitudesRespuesta(data) {
    //console.log("📥 datos solicitud", data);

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Insertar en tabla cabecera (c_solicitudes_meler)
      const [res] = await conn.execute(
        `INSERT INTO c_solicitudes_meler 
        (idtipo, v_descripcion, fec_carga, idusuario, id_estado) 
       VALUES (?, ?, ?, ?, ?)`,
        [data.tipoArchivo, data.nombreArchivo, data.fechaCarga, data.idusuario, data.estado]
      );

      const idArchivo = res.insertId;
      console.log(data.respuestas)
      // 2. Insertar en la tabla de respuestas (c_solicitudes_meler_res)
      if (data.respuestas && Array.isArray(data.respuestas) && data.respuestas.length > 0) {
        const valores = data.respuestas.map(r => [
          idArchivo,
          r.nroOperacion,
          r.CUSPP,
          r.decisionAfiliado,
          r.modalidad,
          r.moneda,
          r.pd,
          r.pg,
          r.porRVD,
          r.dercre,
          r.grati,
          r.tipo,
          r.codigo,
          r.atiende,
          r.gana,
          r.cotiza,
          r.nroCotizacion,
          r.tasaAFP,
          r.pensionAFP,
          r.tasaAseg,
          r.pensionAseg
        ]);

        await conn.query(
          `INSERT INTO c_solicitudes_meler_res (
          id_archivo,
          num_operacion,
          num_cussp,
          var_desicion,
          var_modalidad,
          var_moneda,
          num_anosRT,
          num_periodoGarantizado,
          num_porcentajeRVD,
          var_derechoCrecer,
          var_gratificacion,
          var_tipo,
          var_codigo,
          var_atiende,
          var_gana,
          var_cotiza,
          var_cotizacion,
          num_tasaafp,
          num_pensionafp,
          num_tasaaseg,
          num_pesnionaseg
        ) VALUES ?`,
          [valores]
        );
      }

      await conn.commit();
      console.log("✅ Solicitud y respuestas guardadas con éxito");
      return idArchivo;

    } catch (err) {
      await conn.rollback();
      console.error("❌ Error al guardar:", err);
      throw err;
    } finally {
      conn.release(); // liberar conexión
    }
  }

  static async getTablaSolicitudRespuesta(id) {
    //console.log("entra a consultar")
    try {
      const query = `
          select num_operacion nroOperacion,
          num_cussp CUSPP,
          var_desicion decisionAfiliado,
          var_modalidad modalidad,
          var_moneda moneda,
          num_anosRT pd,
          num_periodoGarantizado pg,
          num_porcentajeRVD porRVD,
          var_derechoCrecer dercre,
          var_gratificacion grati,
          var_tipo tipo,
          var_codigo codigo,
          var_atiende atiende,
          var_gana gana,
          var_cotiza cotiza,
          var_cotizacion nroCotizacion,
          num_tasaafp tasaAFP,
          num_pensionafp pensionAFP,
          num_tasaaseg tasaAseg,
          num_pesnionaseg pensionAseg
          from c_solicitudes_meler_res 
          where id_archivo=?`;

      // const params = [];

      // if (id) {
      //   query += " AND id_archivo = ?";
      //   params.push(id);
      // }

      // if (codcia) {
      //   query += " AND var_codigo = ?";
      //   params.push(codcia);
      // }

      // if (gana) {
      //   query += " AND var_gana = ?";
      //   params.push(gana);
      // }
      const [results] = await db.query(query, [id]);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async getCotizacionind(id) {
    //console.log("entra a consultar")
    const query = 'select id_tipren, id_moneda, num_mesdif, num_mesgar, mto_pension from c_cotizaciondetalle where num_operacion=?';
    try {
      const [results] = await db.query(query, [id]);
      return results;
    } catch (err) {
      throw err;
    }
  }

  static async insertRegistraAcepta(ope, cor, fecha) {
    try {

      const fechaAcepta = fecha && fecha.trim() !== '' ? fecha : null;

      const query = `update c_cotizaciondetalle set 
                      fec_acepta=?, 
                      id_estado=3 
                      where num_operacion=? and id_correlativo=?`

      const [result] = await db.execute(query, [fechaAcepta, ope, cor]
      );
      return result.affectedRows > 0;
    } catch (err) {
      throw err;
    }
  }

}

 */