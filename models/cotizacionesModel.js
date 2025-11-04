//configuraion SQL server
const { sql, poolPromise } = require('../config/db');

class cotizacion {

  //Cotizaciones
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
      const pool = await poolPromise; // conexión activa
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

      return result.recordset;
    } catch (err) {
      console.error("❌ Error en getTablaSolicitudesMELER:", err);
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

  static async insertaSolicitudesMeler(data, usu) {
    const pool = await poolPromise;
    const transaction = pool.transaction();

    try {
      await transaction.begin();

      // 1. Insertar en c_solicitudes_meler (OUTPUT para recuperar ID)
      const request1 = new sql.Request(transaction);
      await request1
        .input('UserId', sql.Int, usu)
        .query(`EXEC sp_set_audit_user_id @UserId`);

      const res = await request1
        .input("idtipo", sql.Int, data.tipoArchivo)
        .input("v_descripcion", sql.VarChar(255), data.nombreArchivo)
        .input("fec_carga", sql.DateTime, data.fechaCarga)
        .input("idusuario", sql.Int, data.idusuario)
        .input("id_estado", sql.Int, data.estado)
        .query(`
        DECLARE @tmp TABLE(id INT);
        INSERT INTO c_solicitudes_meler (idtipo, v_descripcion, fec_carga, idusuario, id_estado)
        OUTPUT INSERTED.id INTO @tmp
        VALUES (@idtipo, @v_descripcion, @fec_carga, @idusuario, @id_estado)
        SELECT id FROM @tmp;
      `);

      const idArchivo = res.recordset[0].id;

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
          .input('num_cot', sql.VarChar(10), nuevoNumCotFin)
          .input('num_operacion', sql.Int, c.num_operacion)
          .input('fec_suscripcion', sql.DateTime, c.fec_suscripcion)
          .input('fec_envio', sql.DateTime, c.fec_envio)
          .input('fec_cierre', sql.DateTime, c.fec_cierre)
          .input('fec_devenge', sql.DateTime, c.fec_devenge)
          .input('id_afp', sql.Int, c.id_afp)
          .input('id_prestacion', sql.Int, c.id_prestacion)
          .input('id_tipobenef', sql.VarChar(5), c.id_tipobenef)
          //.input('id_estciv', sql.Int, c.id_estciv)
          //.input('ind_clientecia', sql.Int, c.ind_clientecia)
          .input('num_cuspp', sql.VarChar(15), c.num_cuspp)
          .input('id_sucursal', sql.Int, c.id_sucursal)
          .input('num_aniojubila', sql.Int, c.num_aniojubila)
          .input('num_cargas', sql.Int, c.num_cargas)
          .input('id_agente', sql.Int, c.id_agente)
          .input('num_docagente', sql.VarChar(15), c.num_docagente)
          .input('id_moneda', sql.Int, c.id_moneda)
          .input('val_tcfondo', sql.Decimal(18, 3), c.val_tcfondo)
          .input('mto_capitalfon', sql.Decimal(18, 3), c.mto_capitalfon)
          .input('mto_cicfon', sql.Decimal(18, 3), c.mto_cicfon)
          .input('mto_bonofon', sql.Decimal(18, 3), c.mto_bonofon)
          .input('mto_priuni', sql.Decimal(18, 3), c.mto_priuni)
          .input('mto_cic', sql.Decimal(18, 3), c.mto_cic)
          .input('mto_bono', sql.Decimal(18, 3), c.mto_bono)
          .input('val_tasart', sql.Decimal(18, 3), c.val_tasart)
          .input('mto_apoadi', sql.Decimal(18, 3), c.mto_apoadi)
          .input('ind_cober', sql.VarChar(2), c.ind_cober)
          .input('id_tipocot', sql.VarChar(2), c.id_tipocot)
          .input('id_estadocot', sql.Int, c.id_estadocot)
          .input('num_mensual', sql.Int, c.num_mensual)
          .input('id_tipofon', sql.Int, c.id_tipofon)
          .input('id_region', sql.Int, c.id_region)
          .input('fec_devsol', sql.DateTime, c.fec_devsol)
          .query(`
          INSERT INTO c_cotizacion (
            num_cot, num_operacion, fec_suscripcion, fec_envio, fec_cierre, fec_devenge, id_afp, id_prestacion, id_tipobenef, num_cuspp, id_sucursal,
            num_aniojubila, num_cargas, id_agente, num_docagente, id_moneda, val_tcfondo, mto_capitalfon, mto_cicfon, mto_bonofon, mto_priuni, mto_cic,
            mto_bono, val_tasart, mto_apoadi, ind_cober, id_tipocot, id_estadocot, num_mensual, id_tipofon, id_region, fec_devsol
          )
          OUTPUT INSERTED.id_cot
          VALUES (
            @num_cot, @num_operacion, @fec_suscripcion, @fec_envio, @fec_cierre, @fec_devenge, @id_afp, @id_prestacion, @id_tipobenef, @num_cuspp, @id_sucursal,
            @num_aniojubila, @num_cargas, @id_agente, @num_docagente, @id_moneda, @val_tcfondo, @mto_capitalfon, @mto_cicfon, @mto_bonofon, @mto_priuni, @mto_cic, 
            @mto_bono, @val_tasart, @mto_apoadi, @ind_cober, @id_tipocot, @id_estadocot, @num_mensual, @id_tipofon, @id_region, @fec_devsol
          )
        `);

        const idCotizacion = resultCab.recordset[0].id_cot;
        //console.log("idCotizacion guarda el detalle", idCotizacion)
        // 2. Insertar detalles
        const detalles = data.detalle.filter(d => d.num_operacion === c.num_operacion);
        for (const d of detalles) {
          const detReq = transaction.request();
          await detReq
            .input('id_cot', sql.Int, idCotizacion)
            .input('num_cot', sql.VarChar(10), nuevoNumCotFin)
            .input('id_correlativo', sql.Int, d.id_correlativo)
            .input('num_operacion', sql.Int, d.num_operacion)
            .input('fec_calcot', sql.DateTime, d.fec_calcot)
            .input('id_moneda', sql.Int, d.id_moneda)
            .input('val_tcmon', sql.Decimal(18, 3), d.val_tcmon)
            .input('mto_priuni', sql.Decimal(18, 3), d.mto_priuni)
            .input('mto_capital', sql.Decimal(18, 3), d.mto_capital)
            .input('mto_bono', sql.Decimal(18, 3), d.mto_bono)
            .input('val_agecom', sql.Decimal(18, 3), d.val_agecom)
            .input('val_agecomreal', sql.Decimal(18, 3), d.val_agecomreal)
            .input('mto_agecom', sql.Decimal(18, 3), d.mto_agecom)
            .input('id_tipren', sql.Int, d.id_tipren)
            .input('num_mesdif', sql.Int, d.num_mesdif)
            .input('id_modalidad', sql.Int, d.id_modalidad)
            .input('num_mesgar', sql.Int, d.num_mesgar)
            .input('num_mesesc', sql.Int, d.num_mesesc)
            .input('val_rentaesc', sql.Decimal(18, 3), d.val_rentaesc)
            .input('val_tasartafp', sql.Decimal(18, 3), d.val_tasartafp)
            .input('val_rentart', sql.Decimal(18, 3), d.val_rentart)
            .input('mto_sepelio', sql.Decimal(18, 3), d.mto_sepelio)
            .input('val_tasatce', sql.Decimal(18, 3), d.val_tasatce)
            .input('val_tasavta', sql.Decimal(18, 3), d.val_tasavta)
            .input('val_tasatir', sql.Decimal(18, 3), d.val_tasatir)
            .input('mto_pension', sql.Decimal(18, 3), d.mto_pension)
            .input('mto_pensiongar', sql.Decimal(18, 3), d.mto_pensiongar)
            .input('mto_priAFP', sql.Decimal(18, 3), d.mto_priAFP)
            .input('mto_pensionRT', sql.Decimal(18, 3), d.mto_pensionRT)
            .input('val_rentapentmp', sql.Decimal(18, 3), d.val_rentapentmp)
            .input('mto_sumpenben', sql.Decimal(18, 3), d.mto_sumpenben)
            .input('val_perdida', sql.Decimal(18, 3), d.val_perdida)
            .input('ind_cober', sql.Int, d.ind_cober)
            .input('ind_dercre', sql.VarChar(2), d.ind_dercre)
            .input('ind_dergra', sql.VarChar(2), d.ind_dergra)
            .input('id_estado', sql.Int, d.id_estado)
            //.input('fec_acepta', sql.DateTime, d.fec_acepta)
            .input('id_rechazo', sql.Int, d.id_rechazo)
            .input('mto_parcap', sql.Decimal(18, 3), d.mto_parcap)
            .input('des_error', sql.VarChar(200), d.des_error)
            .input('ind_sisco', sql.Int, d.ind_sisco)
            .input('ind_pasofiltro', sql.Int, d.ind_pasofiltro)

            // ⚠️ aquí seguirías con todos los campos uno por uno como arriba...
            .query(`
            INSERT INTO c_cotizaciondetalle (
              id_cot,num_cot,id_correlativo,num_operacion,fec_calcot,id_moneda,val_tcmon,mto_priuni,mto_capital,mto_bono,val_agecom,val_agecomreal,mto_agecom,id_tipren,num_mesdif,
              id_modalidad,num_mesgar,num_mesesc,val_rentaesc,val_tasartafp,val_rentart,mto_sepelio,val_tasatce,val_tasavta,val_tasatir,mto_pension,mto_pensiongar,
              mto_priAFP,mto_pensionRT,val_rentapentmp,mto_sumpenben,val_perdida,ind_cober,ind_dercre,ind_dergra,id_estado,id_rechazo,mto_parcap,des_error,
              ind_sisco,ind_pasofiltro
            )
            VALUES (@id_cot,@num_cot,@id_correlativo,@num_operacion,@fec_calcot,@id_moneda,@val_tcmon,@mto_priuni,@mto_capital,@mto_bono,@val_agecom,@val_agecomreal,@mto_agecom,@id_tipren,@num_mesdif,
              @id_modalidad,@num_mesgar,@num_mesesc,@val_rentaesc,@val_tasartafp,@val_rentart,@mto_sepelio,@val_tasatce,@val_tasavta,@val_tasatir,@mto_pension,@mto_pensiongar,
              @mto_priAFP,@mto_pensionRT,@val_rentapentmp,@mto_sumpenben,@val_perdida,@ind_cober,@ind_dercre,@ind_dergra,@id_estado,@id_rechazo,@mto_parcap,@des_error,
              @ind_sisco,@ind_pasofiltro)
          `);
        }

        //console.log("idCotizacion guarda el beneficiario", idCotizacion)
        // 3. Insertar beneficiarios
        const beneficiarios = data.beneficiario.filter(b => b.num_operacion === c.num_operacion);
        for (const b of beneficiarios) {
          const benReq = transaction.request();
          await benReq
            .input('id_cot', sql.Int, idCotizacion)
            .input('num_cot', sql.VarChar(10), nuevoNumCotFin)
            .input('id_orden', sql.Int, b.id_orden)
            .input('num_operacion', sql.Int, b.num_operacion)
            .input('id_parentesco', sql.Int, b.id_parentesco)
            .input('id_grupofam', sql.Int, b.id_grupofam)
            .input('id_sexo', sql.Int, b.id_sexo)
            .input('id_invalido', sql.Int, b.id_invalido)
            .input('id_derpen', sql.Int, b.id_derpen)
            .input('id_tipodociden', sql.Int, b.id_tipodociden)
            .input('num_dociden', sql.VarChar(20), b.num_dociden)
            .input('des_nombre', sql.VarChar(50), b.des_nombre)
            .input('des_nombresegundo', sql.VarChar(50), b.des_nombresegundo)
            .input('des_apepaterno', sql.VarChar(50), b.des_apepaterno)
            .input('des_apematerno', sql.VarChar(50), b.des_apematerno)
            .input('fec_nacimiento', sql.DateTime, b.fec_nacimiento)
            //.input('fec_fallecimiento', sql.DateTime, b.fec_fallecimiento)
            .input('fec_fallecimiento', sql.DateTime,
              b.fec_fallecimiento && b.fec_fallecimiento.trim() !== ""
                ? new Date(b.fec_fallecimiento)
                : null
            )
            //.input('fec_nachijomayor', sql.DateTime, b.fec_nachijomayor)
            .input('fec_nachijomayor', sql.DateTime,
              b.fec_nachijomayor && b.fec_nachijomayor.trim() !== ""
                ? new Date(b.fec_nachijomayor)
                : null
            )
            .input('val_pension', sql.Decimal(18, 3), b.val_pension)
            .input('val_pensionleg', sql.Decimal(18, 3), b.val_pensionleg)
            .input('mto_pension', sql.Decimal(18, 3), b.mto_pension)
            .input('mto_pensiongar', sql.Decimal(18, 3), b.mto_pensiongar)
            .input('ind_estsob', sql.VarChar(2), b.ind_estsob)
            .input('ind_estudiante', sql.VarChar(2), b.ind_estudiante)
            // ⚠️ igual que arriba: ir agregando .input() por cada campo
            .query(`
            INSERT INTO c_cotizacionbeneficiario (
              id_cot,num_cot,id_orden,num_operacion,id_parentesco,id_grupofam,id_sexo,id_invalido,id_derpen,id_tipodociden,num_dociden,des_nombre,des_nombresegundo,des_apepaterno,
              des_apematerno,fec_nacimiento,fec_fallecimiento,fec_nachijomayor,val_pension,val_pensionleg,mto_pension,mto_pensiongar,ind_estsob,ind_estudiante
            )
            VALUES (@id_cot,@num_cot,@id_orden,@num_operacion,@id_parentesco,@id_grupofam,@id_sexo,@id_invalido,@id_derpen,@id_tipodociden,@num_dociden,@des_nombre,@des_nombresegundo,@des_apepaterno,
            @des_apematerno,@fec_nacimiento,@fec_fallecimiento,@fec_nachijomayor,@val_pension,@val_pensionleg,@mto_pension,@mto_pensiongar,@ind_estsob,@ind_estudiante)
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

  static async insertaSolicitudesRespuesta(data, usu) {
    const pool = await poolPromise;
    const transaction = pool.transaction();

    try {
      pool = await poolPromise;
      await transaction.begin();

      // 1. Insertar cabecera en c_solicitudes_meler
      const request1 = new sql.Request(transaction);
      await request1
        .input('UserId', sql.Int, usu)
        .query(`EXEC sp_set_audit_user_id @UserId`);

      const res = await request1
        .input("idtipo", sql.Int, data.tipoArchivo)
        .input("v_descripcion", sql.VarChar(255), data.nombreArchivo)
        .input("fec_carga", sql.DateTime, data.fechaCarga)
        .input("idusuario", sql.Int, data.idusuario)
        .input("id_estado", sql.Int, data.estado)
        .query(`
        DECLARE @tmp TABLE(id INT);
        INSERT INTO c_solicitudes_meler (idtipo, v_descripcion, fec_carga, idusuario, id_estado)
        OUTPUT INSERTED.id INTO @tmp
        VALUES (@idtipo, @v_descripcion, @fec_carga, @idusuario, @id_estado)
        SELECT id FROM @tmp;
      `);

      const idArchivo = res.recordset[0].id;
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

  //crud parametros
  static async getCabecerasParam() {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query(`SELECT * FROM m_parametros ORDER BY id`);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  static async insertCabeceraParam(nombre) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('v_nombre', sql.NVarChar, nombre)
        .query(`INSERT INTO m_parametros (nombre) VALUES (@v_nombre)`);
    } catch (err) {
      throw err;
    }
  }

  static async getDetallesParam(idpar) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('idpar', sql.Int, idpar)
        .query(`SELECT * FROM m_parametros_val WHERE idpar = @idpar ORDER BY id`);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  static async insertDetalleParam(data) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('idpar', sql.Int, data.idpar)
        .input('v_cod', sql.NVarChar, data.v_cod)
        .input('v_nombre', sql.NVarChar, data.v_nombre)
        .input('n_valor', sql.Decimal(18, 3), data.n_valor || 0)
        .input('v_codsbs', sql.NVarChar, data.v_codsbs)
        .input('v_nombrecorto', sql.NVarChar, data.v_nombrecorto)
        .query(`
        INSERT INTO m_parametros_val (idpar, v_cod, v_nombre, n_valor, v_codsbs, v_nombrecorto)
        VALUES (@idpar, @v_cod, @v_nombre, @n_valor, @v_codsbs, @v_nombrecorto)
      `);
    } catch (err) {
      throw err;
    }
  }

  static async updateDetalleParam(data) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id', sql.Int, data.id)
        .input('v_cod', sql.NVarChar, data.v_cod)
        .input('v_nombre', sql.NVarChar, data.v_nombre)
        .input('n_valor', sql.Decimal(18, 3), data.n_valor)
        .input('v_codsbs', sql.NVarChar, data.v_codsbs)
        .input('v_nombrecorto', sql.NVarChar, data.v_nombrecorto)
        .query(`
        UPDATE m_parametros_val 
        SET v_cod=@v_cod, v_nombre=@v_nombre, n_valor=@n_valor, 
            v_codsbs=@v_codsbs, v_nombrecorto=@v_nombrecorto
        WHERE id=@id
      `);
    } catch (err) {
      throw err;
    }
  }

  static async deleteDetalleParam(id) {
    try {
      const pool = await poolPromise;
      await pool.request().input('id', sql.Int, id)
        .query(`DELETE FROM m_parametros_val WHERE id=@id`);
    } catch (err) {
      throw err;
    }
  }

  static async ConfiguracionMatrizCF() {
    try {
      const pool = await poolPromise;
      const res = await pool.request().query(`
        select a.id, c.nombre, b.v_nombre, a.n_mtodesde, a.n_mtohasta, 
        n_jubleg, n_jubant, n_invtot, n_invpar, n_sobrev, a.estado
        from m_configuracionmatriz a 
        join m_parametros_val b on a.n_cod=b.idpar and a.v_cod=b.v_cod
        join m_parametros c on b.idpar=c.id
      `);
      return res.recordset;
    } catch (err) {
      console.error('Error en listar configuracion matriz:', err);
      throw err;
    }
  }

  static async actualizarCampoMatrizCF(id, campo, valor) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id', sql.Int, id)
        .input('valor', sql.Int, valor)
        .query(`UPDATE m_configuracionmatriz SET ${campo} = @valor WHERE id = @id`);
      return { success: true };
    } catch (err) {
      console.error('Error en actualizarCampo:', err);
      throw err;
    }
  }

  static async actualizarMontosMatrizCF(id, desde, hasta) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id', sql.Int, id)
        .input('desde', sql.Decimal(18, 2), desde)
        .input('hasta', sql.Decimal(18, 2), hasta)
        .query(`
        UPDATE m_configuracionmatriz 
        SET n_mtodesde = @desde, n_mtohasta = @hasta 
        WHERE id = @id
      `);
      return { success: true };
    } catch (err) {
      console.error('Error en actualizarCampo:', err);
      throw err;
    }
  }
}

module.exports = cotizacion;


