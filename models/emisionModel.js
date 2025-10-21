const { sql, poolPromise } = require('../config/db');

class emision {
    static async getCotizaciones(dni = '') {
        try {
            const pool = await poolPromise;
            let query = `
        SELECT a.num_cot, a.num_cuspp, 
               (b.des_nombre + ' ' + b.des_nombresegundo + ' ' + b.des_apepaterno + ' ' + b.des_apematerno) AS afiliado,
               b.num_dociden
        FROM c_cotizacion a
        JOIN c_cotizacionbeneficiario b ON a.id_cot = b.id_cot
        JOIN c_cotizaciondetalle c ON a.id_cot = c.id_cot
        WHERE b.id_orden = 1 AND c.id_estado = 4
      `;

            if (dni && dni.trim() !== '') {
                query += ' AND b.num_dociden = @dni';
            }

            const request = pool.request();
            if (dni && dni.trim() !== '') request.input('dni', dni.trim());

            const result = await request.query(query);
            return result.recordset;
        } catch (err) {
            console.error('Error getCotizaciones:', err);
            throw err;
        }
    }

    static async getPolizas(dni = '') {
        try {
            const pool = await poolPromise;
            let query = `
        SELECT a.num_pol, a.num_cuspp, 
               (c.des_nombre + ' ' + c.des_nombresegundo + ' ' + c.des_apepaterno + ' ' + c.des_apematerno) AS afiliado,
               c.num_dociden
        FROM p_polizas a
        JOIN p_polizaversion b ON a.id_pol = b.id_pol
        JOIN p_beneficiarios c ON b.id_polver = c.id_polver
        WHERE c.id_orden = 1 AND a.id_estado = 1
      `;

            if (dni && dni.trim() !== '') {
                query += ' AND c.num_dociden = @dni';
            }

            const request = pool.request();
            if (dni && dni.trim() !== '') request.input('dni', dni.trim());

            const result = await request.query(query);
            return result.recordset;
        } catch (err) {
            console.error('Error getPolizas:', err);
            throw err;
        }
    }

    static async GuardaPoliza(polizaData, versionData, beneficiarios) {
        const pool = await poolPromise;
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();

            /** INSERT principal en p_polizas **/
            const polizaRequest = new sql.Request(transaction);
            const polizaResult = await polizaRequest
                .input('num_pol', sql.NVarChar(10), polizaData.num_pol)
                .input('id_correlativo', sql.Int, polizaData.id_correlativo)
                .input('num_cot', sql.Int, polizaData.num_cot)
                .input('id_trapagpen', sql.NVarChar(5), polizaData.id_trapagpen)
                .input('fec_trapagpen', sql.Date, polizaData.fec_trapagpen)
                .input('id_afp', sql.Int, polizaData.id_afp)
                .input('id_tipobenef', sql.NVarChar(5), polizaData.id_tipobenef)
                .input('num_cuspp', sql.NVarChar(15), polizaData.num_cuspp)
                .input('fec_solicitud', sql.Date, polizaData.fec_solicitud)
                .input('fec_ingreso', sql.Date, polizaData.fec_ingreso)
                .input('fec_vigencia', sql.Date, polizaData.fec_vigencia)
                .input('fec_tgervigencia', sql.Date, polizaData.fec_tgervigencia)
                .input('fec_dev', sql.Date, polizaData.fec_dev)
                .input('num_annojub', sql.Int, polizaData.num_annojub)
                .input('fec_emision', sql.Date, polizaData.fec_emision)
                .input('fec_iniciocia', sql.Date, polizaData.fec_iniciocia)
                .input('fec_efecto', sql.Date, polizaData.fec_efecto)
                .input('fec_calculo', sql.Date, polizaData.fec_calculo)
                .input('fec_ingresospp', sql.Date, polizaData.fec_ingresospp)
                .input('id_tipoorigen', sql.Int, polizaData.id_tipoorigen)
                .input('id_estado', sql.Int, polizaData.id_estado)
                .query(`
          INSERT INTO p_polizas (
            num_pol, id_correlativo, num_cot, id_trapagpen, fec_trapagpen,
            id_afp, id_tipobenef, num_cuspp, fec_solicitud, fec_ingreso,
            fec_vigencia, fec_tgervigencia, fec_dev, num_annojub,
            fec_emision, fec_iniciocia, fec_efecto, fec_calculo,
            fec_ingresospp, id_tipoorigen, id_estado
          )
          OUTPUT INSERTED.id_pol
          VALUES (
            @num_pol, @id_correlativo, @num_cot, @id_trapagpen, @fec_trapagpen,
            @id_afp, @id_tipobenef, @num_cuspp, @fec_solicitud, @fec_ingreso,
            @fec_vigencia, @fec_tgervigencia, @fec_dev, @num_annojub,
            @fec_emision, @fec_iniciocia, @fec_efecto, @fec_calculo,
            @fec_ingresospp, @id_tipoorigen, @id_estado
          )
        `);

            const id_pol = polizaResult.recordset[0].id_pol;

            /** INSERT en p_polizaversion **/
            const versionRequest = new sql.Request(transaction);
            const versionResult = await versionRequest
                .input('id_pol', sql.Int, id_pol)
                .input('id_end', sql.Int, versionData.id_end)
                .input('fec_vigini', sql.Date, versionData.fec_vigini)
                .input('fec_vigter', sql.Date, versionData.fec_vigter)
                .input('id_prestacion', sql.Int, versionData.id_prestacion)
                .input('id_estciv', sql.NVarChar(5), versionData.id_estciv)
                .input('fec_acepta', sql.Date, versionData.fec_acepta)
                .input('fec_devsol', sql.Date, versionData.fec_devsol)
                .input('fec_pripago', sql.Date, versionData.fec_pripago)
                .input('id_monfondo', sql.Int, versionData.id_monfondo)
                .input('val_tcfondo', sql.Decimal(5, 3), versionData.val_tcfondo)
                .input('mto_capitalfon', sql.Decimal(15, 8), versionData.mto_capitalfon)
                .input('mto_cicfon', sql.Decimal(15, 8), versionData.mto_cicfon)
                .input('mto_bonofon', sql.Decimal(15, 8), versionData.mto_bonofon)
                .input('mto_apoadi', sql.Decimal(15, 8), versionData.mto_apoadi)
                .input('mto_priuni', sql.Decimal(15, 8), versionData.mto_priuni)
                .input('mto_cic', sql.Decimal(15, 8), versionData.mto_cic)
                .input('mto_bono', sql.Decimal(15, 8), versionData.mto_bono)
                .input('val_tasarptr', sql.Decimal(5, 3), versionData.val_tasarptr)
                .input('ind_cober', sql.NVarChar(5), versionData.ind_cober)
                .input('id_bensocial', sql.NVarChar(5), versionData.id_bensocial)
                .input('id_moneda', sql.Int, versionData.id_moneda)
                .input('val_tcmon', sql.Decimal(5, 3), versionData.val_tcmon)
                .input('id_tipren', sql.Int, versionData.id_tipren)
                .input('id_modalidad', sql.Int, versionData.id_modalidad)
                .input('num_mesdif', sql.Int, versionData.num_mesdif)
                .input('num_mesgar', sql.Int, versionData.num_mesgar)
                .input('num_mesesc', sql.Int, versionData.num_mesesc)
                .input('val_rentaesc', sql.Decimal(5, 3), versionData.val_rentaesc)
                .input('id_dercre', sql.Int, versionData.id_dercre)
                .input('id_dergra', sql.Int, versionData.id_dergra)
                .input('val_rentaafp', sql.Decimal(5, 3), versionData.val_rentaafp)
                .input('val_rentatmp', sql.Decimal(5, 3), versionData.val_rentatmp)
                .input('mto_gassep', sql.Decimal(15, 8), versionData.mto_gassep)
                .input('val_tasatce', sql.Decimal(5, 3), versionData.val_tasatce)
                .input('val_tasavta', sql.Decimal(5, 3), versionData.val_tasavta)
                .input('val_tasatir', sql.Decimal(5, 3), versionData.val_tasatir)
                .input('val_taspergar', sql.Decimal(5, 3), versionData.val_taspergar)
                .input('val_tasactorea', sql.Decimal(5, 3), versionData.val_tasactorea)
                .input('val_tasainpergar', sql.Decimal(5, 3), versionData.val_tasainpergar)
                .input('val_tasares', sql.Decimal(5, 3), versionData.val_tasares)
                .input('val_prerentmp', sql.Decimal(5, 3), versionData.val_prerentmp)
                .input('val_perdida', sql.Decimal(5, 3), versionData.val_perdida)
                .input('mto_priunitot', sql.Decimal(15, 8), versionData.mto_priunitot)
                .input('mto_priunieess', sql.Decimal(15, 8), versionData.mto_priunieess)
                .input('mto_peninicial', sql.Decimal(15, 8), versionData.mto_peninicial)
                .input('mto_pension', sql.Decimal(15, 8), versionData.mto_pension)
                .input('mto_pensiongar', sql.Decimal(15, 8), versionData.mto_pensiongar)
                .input('mto_priuniafpeess', sql.Decimal(15, 8), versionData.mto_priuniafpeess)
                .input('mto_pensionafp', sql.Decimal(15, 8), versionData.mto_pensionafp)
                .input('fec_iniciopagos', sql.Date, versionData.fec_iniciopagos)
                .input('fec_finperiododif', sql.Date, versionData.fec_finperiododif)
                .input('fec_finperiodogar', sql.Date, versionData.fec_finperiodogar)
                .input('fec_finrentaesc', sql.Date, versionData.fec_finrentaesc)
                .input('ind_recalculo', sql.NVarChar(2), versionData.ind_recalculo)
                .input('mto_ajusteipc', sql.Decimal(15, 8), versionData.mto_ajusteipc)
                .input('val_reajustetri', sql.Decimal(15, 8), versionData.val_reajustetri)
                .input('val_reajustemen', sql.Decimal(15, 8), versionData.val_reajustemen)
                .input('id_estver', sql.Int, versionData.id_estver)
                .query(`
          INSERT INTO p_polizaversion (
            id_pol, id_end, fec_vigini, fec_vigter, id_prestacion, id_estciv,
            fec_acepta, fec_devsol, fec_pripago, id_monfondo, val_tcfondo,
            mto_capitalfon, mto_cicfon, mto_bonofon, mto_apoadi, mto_priuni,
            mto_cic, mto_bono, val_tasarptr, ind_cober, id_bensocial, id_moneda,
            val_tcmon, id_tipren, id_modalidad, num_mesdif, num_mesgar, num_mesesc,
            val_rentaesc, id_dercre, id_dergra, val_rentaafp, val_rentatmp,
            mto_gassep, val_tasatce, val_tasavta, val_tasatir, val_taspergar,
            val_tasactorea, val_tasainpergar, val_tasares, val_prerentmp,
            val_perdida, mto_priunitot, mto_priunieess, mto_peninicial,
            mto_pension, mto_pensiongar, mto_priuniafpeess, mto_pensionafp,
            fec_iniciopagos, fec_finperiododif, fec_finperiodogar, fec_finrentaesc,
            ind_recalculo, mto_ajusteipc, val_reajustetri, val_reajustemen, id_estver
          )
          OUTPUT INSERTED.id_polver
          VALUES (
            @id_pol, @id_end, @fec_vigini, @fec_vigter, @id_prestacion, @id_estciv,
            @fec_acepta, @fec_devsol, @fec_pripago, @id_monfondo, @val_tcfondo,
            @mto_capitalfon, @mto_cicfon, @mto_bonofon, @mto_apoadi, @mto_priuni,
            @mto_cic, @mto_bono, @val_tasarptr, @ind_cober, @id_bensocial, @id_moneda,
            @val_tcmon, @id_tipren, @id_modalidad, @num_mesdif, @num_mesgar, @num_mesesc,
            @val_rentaesc, @id_dercre, @id_dergra, @val_rentaafp, @val_rentatmp,
            @mto_gassep, @val_tasatce, @val_tasavta, @val_tasatir, @val_taspergar,
            @val_tasactorea, @val_tasainpergar, @val_tasares, @val_prerentmp,
            @val_perdida, @mto_priunitot, @mto_priunieess, @mto_peninicial,
            @mto_pension, @mto_pensiongar, @mto_priuniafpeess, @mto_pensionafp,
            @fec_iniciopagos, @fec_finperiododif, @fec_finperiodogar, @fec_finrentaesc,
            @ind_recalculo, @mto_ajusteipc, @val_reajustetri, @val_reajustemen, @id_estver
          )
        `);

            const id_polver = versionResult.recordset[0].id_polver;

            /** INSERT en p_beneficiarios (varios registros) **/
            for (const b of beneficiarios) {
                const benRequest = new sql.Request(transaction);
                await benRequest
                    .input('id_polver', sql.Int, id_polver)
                    .input('id_orden', sql.Int, b.id_orden)
                    .input('id_parentesco', sql.Int, b.id_parentesco)
                    .input('id_grupofam', sql.Int, b.id_grupofam)
                    .input('id_sexo', sql.Int, b.id_sexo)
                    .input('id_invalido', sql.Int, b.id_invalido)
                    .input('fec_invalido', sql.Date, b.fec_invalido)
                    .input('id_causainv', sql.Int, b.id_causainv)
                    .input('id_estado', sql.Int, b.id_estado)
                    .input('id_dercre', sql.NVarChar(2), b.id_dercre)
                    .input('id_tipodociden', sql.Int, b.id_tipodociden)
                    .input('num_dociden', sql.NVarChar(21), b.num_dociden)
                    .input('des_nombre', sql.NVarChar(50), b.des_nombre)
                    .input('des_nombresegundo', sql.NVarChar(50), b.des_nombresegundo)
                    .input('des_apepaterno', sql.NVarChar(50), b.des_apepaterno)
                    .input('des_apematerno', sql.NVarChar(50), b.des_apematerno)
                    .input('fec_nacimiento', sql.Date, b.fec_nacimiento)
                    .input('fec_fallecimiento', sql.Date, b.fec_fallecimiento)
                    .input('fec_nachijomayor', sql.Date, b.fec_nachijomayor)
                    .input('fec_ingresocia', sql.Date, b.fec_ingresocia)
                    .input('fec_iniciopagopen', sql.Date, b.fec_iniciopagopen)
                    .input('fec_terminapergar', sql.Date, b.fec_terminapergar)
                    .input('mto_pension', sql.Decimal(15, 8), b.mto_pension)
                    .input('val_pension', sql.Decimal(5, 3), b.val_pension)
                    .input('val_pensionleg', sql.Decimal(5, 3), b.val_pensionleg)
                    .input('mto_pensiongar', sql.Decimal(15, 8), b.mto_pensiongar)
                    .input('val_pensiongar', sql.Decimal(5, 3), b.val_pensiongar)
                    .input('id_derpago', sql.Int, b.id_derpago)
                    .input('des_telef1', sql.NVarChar(20), b.des_telef1)
                    .input('des_telef2', sql.NVarChar(20), b.des_telef2)
                    .input('des_telef3', sql.NVarChar(20), b.des_telef3)
                    .input('des_email1', sql.NVarChar(20), b.des_email1)
                    .input('des_email2', sql.NVarChar(20), b.des_email2)
                    .input('des_email3', sql.NVarChar(20), b.des_email3)
                    .input('id_benefestudios', sql.Int, b.id_benefestudios)
                    .input('fec_efectiva', sql.Date, b.fec_efectiva)
                    .input('des_dircorrespon', sql.NVarChar(50), b.des_dircorrespon)
                    .input('id_ubidircorrespon', sql.Int, b.id_ubidircorrespon)
                    .input('des_direxpediente', sql.NVarChar(50), b.des_direxpediente)
                    .input('id_direxpediente', sql.Int, b.id_direxpediente)
                    .input('id_protecdatos', sql.Int, b.id_protecdatos)
                    .input('id_genboleta', sql.Int, b.id_genboleta)
                    .input('id_nacionalidad', sql.Int, b.id_nacionalidad)
                    .input('id_viapago', sql.Int, b.id_viapago)
                    .input('id_tipocuenta', sql.Int, b.id_tipocuenta)
                    .input('id_banco', sql.Int, b.id_banco)
                    .input('num_cuenta', sql.Int, b.num_cuenta)
                    .input('num_cuentacci', sql.Int, b.num_cuentacci)
                    .input('ind_incluido', sql.Int, b.ind_incluido)
                    .input('ind_excluido', sql.Int, b.ind_excluido)
                    .input('id_instsalud', sql.Int, b.id_instsalud)
                    .input('id_modalidasalud', sql.Int, b.id_modalidasalud)
                    .input('mto_plansalud', sql.Decimal(15, 8), b.mto_plansalud)
                    .input('id_causasuspencion', sql.Int, b.id_causasuspencion)
                    .input('fec_suspencion', sql.Date, b.fec_suspencion)
                    .query(`
            INSERT INTO p_beneficiarios (
              id_polver, id_orden, id_parentesco, id_grupofam, id_sexo, id_invalido, fec_invalido,
              id_causainv, id_estado, id_dercre, id_tipodociden, num_dociden, des_nombre,
              des_nombresegundo, des_apepaterno, des_apematerno, fec_nacimiento, fec_fallecimiento,
              fec_nachijomayor, fec_ingresocia, fec_iniciopagopen, fec_terminapergar,
              mto_pension, val_pension, val_pensionleg, mto_pensiongar, val_pensiongar,
              id_derpago, des_telef1, des_telef2, des_telef3, des_email1, des_email2, des_email3,
              id_benefestudios, fec_efectiva, des_dircorrespon, id_ubidircorrespon, des_direxpediente,
              id_direxpediente, id_protecdatos, id_genboleta, id_nacionalidad, id_viapago,
              id_tipocuenta, id_banco, num_cuenta, num_cuentacci, ind_incluido, ind_excluido,
              id_instsalud, id_modalidasalud, mto_plansalud, id_causasuspencion, fec_suspencion
            )
            VALUES (
              @id_polver, @id_orden, @id_parentesco, @id_grupofam, @id_sexo, @id_invalido, @fec_invalido,
              @id_causainv, @id_estado, @id_dercre, @id_tipodociden, @num_dociden, @des_nombre,
              @des_nombresegundo, @des_apepaterno, @des_apematerno, @fec_nacimiento, @fec_fallecimiento,
              @fec_nachijomayor, @fec_ingresocia, @fec_iniciopagopen, @fec_terminapergar,
              @mto_pension, @val_pension, @val_pensionleg, @mto_pensiongar, @val_pensiongar,
              @id_derpago, @des_telef1, @des_telef2, @des_telef3, @des_email1, @des_email2, @des_email3,
              @id_benefestudios, @fec_efectiva, @des_dircorrespon, @id_ubidircorrespon, @des_direxpediente,
              @id_direxpediente, @id_protecdatos, @id_genboleta, @id_nacionalidad, @id_viapago,
              @id_tipocuenta, @id_banco, @num_cuenta, @num_cuentacci, @ind_incluido, @ind_excluido,
              @id_instsalud, @id_modalidasalud, @mto_plansalud, @id_causasuspencion, @fec_suspencion
            )
          `);
            }

            await transaction.commit();
            return { success: true, id_pol, id_polver };

        } catch (error) {
            await transaction.rollback();
            console.error('Error al registrar póliza con versión y beneficiarios:', error);
            throw error;
        }
    }
};

module.exports = emision;