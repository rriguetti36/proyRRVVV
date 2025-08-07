const db = require('../config/db');  // Configuración de la base de datos

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
      console.log('Solicitud y detalles guardados correctamente.');
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
      console.log('Solicitud y detalles guardados correctamente.');
    } catch (err) {
      await conn.rollback();
      console.error('Error al guardar:', err);
    } finally {
      conn.release(); // ¡libera siempre la conexión!
    }

  }

  static async getCotizacionesCalculadasCarga23(id) {
    console.log("consulta getCotizacionesCalculadasCarga23")
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

}

module.exports = cotizacion;