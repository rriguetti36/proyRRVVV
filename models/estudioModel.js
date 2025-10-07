// models/estudioModel.js
//const sql = require('mssql');
const { sql, poolPromise } = require('../config/db');

const EstudioModel = {
    async guardarEstudio(data) {
        //const pool = await sql.connect(dbConfig);
        //const transaction = new sql.Transaction(pool);

        const pool = await poolPromise;
        const transaction = pool.transaction();

        try {
            await transaction.begin();

            // Insert principal en c_estudio
            const request = new sql.Request(transaction);
            request.input('num_cot', sql.Int, data.num_cot);
            request.input('mto_priuni', sql.Decimal(18, 3), data.mto_priuni);
            request.input('mto_gassep', sql.Decimal(18, 3), data.mto_gassep);
            request.input('val_tc', sql.Decimal(18, 3), data.val_tc);
            request.input('id_afp', sql.Int, data.id_afp);
            request.input('id_estado', sql.Int, data.id_estado);
            request.input('id_usu', sql.Int, data.id_usu);

            const insertEstudio = await request.query(`
        INSERT INTO c_estudio (num_cot, mto_priuni, mto_gassep, val_tc, id_afp, id_estado, id_usu)
        OUTPUT INSERTED.id
        VALUES (@num_cot, @mto_priuni, @mto_gassep, @val_tc, @id_afp, @id_estado, @id_usu)
      `);

            const idEstudio = insertEstudio.recordset[0].id;

            // Insert asegurado (único registro)
            if (data.asegurado) {
                const reqAseg = new sql.Request(transaction);
                const a = data.asegurado;
                reqAseg.input('id_est', sql.Int, idEstudio);
                reqAseg.input('id_tipodociden', sql.Int, a.id_tipodociden);
                reqAseg.input('num_dociden', sql.VarChar(20), a.num_dociden);
                reqAseg.input('cod_cuspp', sql.VarChar(20), a.cod_cuspp);
                reqAseg.input('des_nombre', sql.VarChar(50), a.des_nombre);
                reqAseg.input('des_segundonombre', sql.VarChar(50), a.des_segundonombre);
                reqAseg.input('des_apepaterno', sql.VarChar(50), a.des_apepaterno);
                reqAseg.input('des_apematerno', sql.VarChar(50), a.des_apematerno);
                reqAseg.input('id_reg', sql.Int, a.id_reg);
                reqAseg.input('id_ivalido', sql.Int, a.id_ivalido);
                reqAseg.input('fec_nacimiento', sql.Date, a.fec_nacimiento);
                reqAseg.input('id_sexo', sql.Int, a.id_sexo);
                reqAseg.input('val_afp', sql.Decimal(18, 3), a.val_afp);
                reqAseg.input('id_prestacion', sql.Int, a.id_prestacion);
                reqAseg.input('fec_dev', sql.Date, a.fec_dev);
                reqAseg.input('fec_devsol', sql.Date, a.fec_devsol);
                await reqAseg.query(`
          INSERT INTO c_estudioasegurado (id_est, id_tipodociden, num_dociden, cod_cuspp, des_nombre, des_segundonombre, des_apematerno, des_apepaterno,
          id_reg, id_ivalido, fec_nacimiento, id_sexo, val_afp, id_prestacion, fec_dev, fec_devsol)
          VALUES (@id_est, @id_tipodociden, @num_dociden, vcod_cuspp, @des_nombre, @des_segundonombre, @des_apematerno, @des_apepaterno,
          @id_reg, @id_ivalido, @fec_nacimiento, @id_sexo, @val_afp, @id_prestacion, @fec_dev, @fec_devsol)
        `);
            }

            // Insert beneficiarios
            if (data.beneficiarios && data.beneficiarios.length > 0) {
                for (const b of data.beneficiarios) {
                    const reqBen = new sql.Request(transaction);
                    reqBen.input('id_est', sql.Int, idEstudio);
                    reqBen.input('id_orden', sql.Int, b.id_orden);
                    reqBen.input('id_tipodociden', sql.Int, b.id_tipodociden);
                    reqBen.input('num_dociden', sql.VarChar(20), b.num_dociden);
                    reqBen.input('des_nombre', sql.VarChar(50), b.des_nombre);
                    reqBen.input('des_segundonombre', sql.VarChar(50), a.des_segundonombre);
                    reqBen.input('des_apepaterno', sql.VarChar(50), a.des_apepaterno);
                    reqBen.input('des_apematerno', sql.VarChar(50), a.des_apematerno);
                    reqBen.input('id_parentesco', sql.Int, b.id_parentesco);
                    reqBen.input('id_sexo', sql.Int, b.id_sexo);
                    reqBen.input('fec_nacimiento', sql.Date, b.fec_nacimiento);
                    reqBen.input('id_ivalido', sql.Int, b.id_ivalido);
                    reqBen.input('val_pension', sql.Decimal(18, 3), b.val_pension);
                    reqBen.input('mto_pension', sql.Decimal(18, 3), b.mto_pension);
                    await reqBen.query(`
            INSERT INTO c_estudiobeneficiario (id_est, id_orden, id_tipodociden, num_dociden, des_nombre, des_segundonombre, des_apepaterno, des_apematerno,
            id_parentesco, id_sexo, fec_nacimiento, id_ivalido, val_pension, mto_pension)
            VALUES (@id_est, @id_orden, @id_tipodociden, @num_dociden, @des_nombre, @des_segundonombre, @des_apepaterno, @des_apematerno,
            @id_parentesco, @id_sexo, @fec_nacimiento, @id_ivalido, @val_pension, @mto_pension)
          `);
                }
            }

            // Insert modalidades
            if (data.modalidades && data.modalidades.length > 0) {
                for (const m of data.modalidades) {
                    const reqMod = new sql.Request(transaction);
                    reqMod.input('id_est', sql.Int, idEstudio);
                    reqMod.input('id_correlativo', sql.Int, m.id_correlativo);
                    reqMod.input('id_moneda', sql.Int, m.id_moneda);
                    reqMod.input('num_mesdif', sql.Int, m.num_mesdif);
                    reqMod.input('num_mesgar', sql.Int, m.num_mesgar);
                    reqMod.input('ind_dergra', sql.VarChar(5), m.ind_dergra);
                    reqMod.input('num_mesesc', sql.Int, m.num_mesesc);
                    reqMod.input('val_rentaesc', sql.Decimal(18, 3), m.val_rentaesc);
                    await reqMod.query(`
            INSERT INTO c_estudiomodalidad (id_est, id_correlativo, id_moneda, num_mesdif, num_mesgar, ind_dergra, num_mesesc, val_rentaesc, 
            mto_pensionref, mto_pensionafp, mto_pension, mto_primaafp, mto_primacia, val_tasavta, val_tasaTci, val_tasaTce, val_tasaTir, val_perdida)
            VALUES (@id_est, @id_correlativo, @id_moneda, @num_mesdif, @num_mesgar, @ind_dergra, @num_mesesc, @val_rentaesc, 
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
          `);
                }
            }

            // Insert modalidades con los resultados
            if (data.reultados && data.reultados.length > 0) {
                for (const r of data.reultados) {
                    const reqMod = new sql.Request(transaction);
                    reqMod.input('id_est', sql.Int, idEstudio);
                    reqMod.input('id_correlativo', sql.Int, m.id_correlativo);
                    reqMod.input('mto_pensionref', sql.Decimal(18, 3), m.mto_pensionref);
                    reqMod.input('mto_pensionafp', sql.Decimal(18, 3), m.mto_pensionafp);
                    reqMod.input('mto_pension', sql.Decimal(18, 3), m.mto_pension);
                    reqMod.input('mto_primaafp', sql.Decimal(18, 3), m.mto_primaafp);
                    reqMod.input('mto_primacia', sql.Decimal(18, 3), m.mto_primacia);
                    reqMod.input('val_tasavta', sql.Decimal(18, 3), m.val_tasavta);
                    reqMod.input('val_tasaTci', sql.Decimal(18, 3), m.val_tasaTci);
                    reqMod.input('val_tasaTce', sql.Decimal(18, 3), m.val_tasaTce);
                    reqMod.input('val_tasaTir', sql.Decimal(18, 3), m.val_tasaTir);
                    reqMod.input('val_perdida', sql.Decimal(18, 3), m.val_perdida);
                    await reqMod.query(`
                            UPDATE c_estudiomodalidad SET
                            mto_pensionref = @mto_pensionref,
                            mto_pensionafp = @mto_pensionafp,
                            mto_pension = @mto_pension,
                            mto_primaafp = @mto_primaafp,
                            mto_primacia = @mto_primacia,
                            val_tasavta = @val_tasavta,
                            val_tasaTci = @val_tasaTci,
                            val_tasaTce = @val_tasaTce,
                            val_tasaTir = @val_tasaTir,
                            val_perdida = @val_perdida
                            WHERE id_est = @id_est AND id_correlativo = @id_correlativo
                        `);
                }
            }

            await transaction.commit();
            return { ok: true, message: 'Cotización guardada con éxito' };

        } catch (error) {
            await transaction.rollback();
            console.error('Error en guardarEstudio:', error);
            return { ok: false, message: 'Error al guardar la cotización', error };
        } finally {
            pool.close();
        }
    },

    async listarEstudios() {
        try {
            //const pool = await sql.connect(dbConfig);
            const pool = await poolPromise;
            const result = await pool.request().query(`
        SELECT id, num_cot, mto_priuni, mto_gassep, val_tc, fec_creacion
        FROM c_estudio
        ORDER BY id DESC
      `);
            return result.recordset;
        } catch (err) {
            console.error(err);
            return [];
        }
    },

    async eliminarEstudio(id) {
        try {
            //const pool = await sql.connect(dbConfig);
            const pool = await poolPromise;
            await pool.request().input('id', sql.Int, id).query(`
        DELETE FROM c_estudiobeneficiario WHERE id_est = @id;
        DELETE FROM c_estudiomodalidad WHERE id_est = @id;
        DELETE FROM c_estudioasegurado WHERE id_est = @id;
        DELETE FROM c_estudio WHERE id = @id;
      `);
            return { ok: true, message: 'Registro eliminado con éxito' };
        } catch (err) {
            console.error(err);
            return { ok: false, message: 'Error al eliminar el registro' };
        }
    }
};

module.exports = EstudioModel;
