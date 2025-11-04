// models/estudioModel.js
//const sql = require('mssql');
const { sql, poolPromise } = require('../config/db');

const EstudioModel = {
    async guardarEstudio(data, usu) {
        //const pool = await sql.connect(dbConfig);
        //const transaction = new sql.Transaction(pool);

        const pool = await poolPromise;
        const transaction = pool.transaction();

        try {
            await transaction.begin();

            // REQUEST de la transacción
            const req = new sql.Request(transaction);

            // Set audit user
            await req
                .input('UserId', sql.Int, usu)
                .query(`EXEC sp_set_audit_user_id @UserId`);

            // Numerador
            const anioActual = new Date().getFullYear();
            const numeradorRes = await req
                .input('anio', sql.Int, anioActual)
                .query(`SELECT n_numext FROM m_numeradores WHERE n_aperiodo = @anio`);

            if (numeradorRes.recordset.length === 0) {
                throw new Error(`No se encontró numerador para el periodo ${anioActual}`);
            }

            let numerofinal = Number(numeradorRes.recordset[0].n_numext);
            const nuevoNumCotFin = `${anioActual}${String(numerofinal).padStart(6, "0")}`;
            console.log(nuevoNumCotFin);

            // Insert principal
            const tmpEstudio = await req
                .input('num_cot', sql.VarChar(10), nuevoNumCotFin)
                .input('mto_priuni', sql.Decimal(18, 3), data.mto_priuni)
                .input('mto_gassep', sql.Decimal(18, 3), data.mto_gassep)
                .input('val_tc', sql.Decimal(18, 3), data.val_tc)
                .input('id_afp', sql.Int, data.id_afp)
                .input('id_estado', sql.Int, data.id_estado)
                .input('id_usu', sql.Int, usu)
                .query(`
                DECLARE @tmp TABLE(id INT);
                INSERT INTO c_estudio (num_cot, mto_priuni, mto_gassep, val_tc, id_afp, id_estado, id_usu)
                OUTPUT INSERTED.id INTO @tmp
                VALUES (@num_cot, @mto_priuni, @mto_gassep, @val_tc, @id_afp, @id_estado, @id_usu);
                SELECT id FROM @tmp;
            `);

            const idEstudio = tmpEstudio.recordset[0].id;

            // Insert asegurado
            if (data.asegurado) {
                const a = data.asegurado;
                await transaction.request()
                    .input('id_est', sql.Int, idEstudio)
                    .input('id_tipodociden', sql.Int, a.id_tipodociden)
                    .input('num_dociden', sql.VarChar(20), a.num_dociden)
                    .input('cod_cuspp', sql.VarChar(20), a.cod_cuspp)
                    .input('des_nombre', sql.VarChar(50), a.des_nombre)
                    .input('des_segundonombre', sql.VarChar(50), a.des_segundonombre)
                    .input('des_apepaterno', sql.VarChar(50), a.des_apepaterno)
                    .input('des_apematerno', sql.VarChar(50), a.des_apematerno)
                    .input('id_reg', sql.Int, a.id_reg)
                    .input('id_ivalido', sql.Int, a.id_ivalido)
                    .input('fec_nacimiento', sql.Date, a.fec_nacimiento)
                    .input('id_sexo', sql.Int, a.id_sexo)
                    .input('val_afp', sql.Decimal(18, 3), a.val_afp)
                    .input('id_prestacion', sql.VarChar(5), a.id_prestacion)
                    .input('fec_dev', sql.Date, a.fec_dev)
                    .input('fec_devsol', sql.Date, a.fec_devsol)
                    .query(`
                    INSERT INTO c_estudioasegurado
                    (id_est, id_tipodociden, num_dociden, cod_cuspp, des_nombre, des_segundonombre, des_apematerno, des_apepaterno,
                     id_reg, id_ivalido, fec_nacimiento, id_sexo, val_afp, id_prestacion, fec_dev, fec_devsol)
                    VALUES (@id_est, @id_tipodociden, @num_dociden, @cod_cuspp, @des_nombre, @des_segundonombre, @des_apematerno,
                            @des_apepaterno, @id_reg, @id_ivalido, @fec_nacimiento, @id_sexo, @val_afp, @id_prestacion, @fec_dev, @fec_devsol);
            `);
            }

            // Beneficiarios
            if (data.beneficiarios?.length > 0) {
                for (const b of data.beneficiarios) {
                    await transaction.request()
                        .input('id_est', sql.Int, idEstudio)
                        .input('id_orden', sql.Int, b.id_orden)
                        .input('id_tipodociden', sql.Int, b.id_tipodociden)
                        .input('num_dociden', sql.VarChar(20), b.num_dociden)
                        .input('des_nombre', sql.VarChar(50), b.des_nombre)
                        .input('des_segundonombre', sql.VarChar(50), b.des_segundonombre)
                        .input('des_apepaterno', sql.VarChar(50), b.des_apepaterno)
                        .input('des_apematerno', sql.VarChar(50), b.des_apematerno)
                        .input('id_parentesco', sql.Int, b.id_parentesco)
                        .input('id_sexo', sql.Int, b.id_sexo)
                        .input('fec_nacimiento', sql.Date, b.fec_nacimiento)
                        .input('id_ivalido', sql.Int, b.id_ivalido)
                        .input('val_pension', sql.Decimal(18, 3), b.val_pension)
                        .input('mto_pension', sql.Decimal(18, 3), b.mto_pension)
                        .query(`
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
                    await transaction.request()
                        .input('id_est', sql.Int, idEstudio)
                        .input('id_correlativo', sql.Int, m.id_correlativo)
                        .input('id_moneda', sql.Int, m.id_moneda)
                        .input('num_mesdif', sql.Int, m.num_mesdif)
                        .input('num_mesgar', sql.Int, m.num_mesgar)
                        .input('ind_dergra', sql.VarChar(5), m.ind_dergra)
                        .input('num_mesesc', sql.Int, m.num_mesesc)
                        .input('val_rentaesc', sql.Decimal(18, 3), m.val_rentaesc)
                        .query(`
                            INSERT INTO c_estudiomodalidad (id_est, id_correlativo, id_moneda, num_mesdif, num_mesgar, ind_dergra, num_mesesc, val_rentaesc, 
                            mto_pensionref, mto_pensionafp, mto_pension, mto_primaafp, mto_primacia, val_tasavta, val_tasaTci, val_tasaTce, val_tasaTir, val_perdida)
                            VALUES (@id_est, @id_correlativo, @id_moneda, @num_mesdif, @num_mesgar, @ind_dergra, @num_mesesc, @val_rentaesc, 
                            0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
                        `);
                }
            }

            // Insert modalidades con los resultados
            if (data.resultados && data.resultados.length > 0) {
                for (const r of data.resultados) {
                    await transaction.request()
                        .input('id_est', sql.Int, idEstudio)
                        .input('id_correlativo', sql.Int, r.id_correlativo)
                        .input('mto_pensionref', sql.Decimal(18, 3), r.mto_pensionref)
                        .input('mto_pensionafp', sql.Decimal(18, 3), r.mto_pensionafp)
                        .input('mto_pension', sql.Decimal(18, 3), r.mto_pension)
                        .input('mto_primaafp', sql.Decimal(18, 3), r.mto_primaafp)
                        .input('mto_primacia', sql.Decimal(18, 3), r.mto_primacia)
                        .input('val_tasavta', sql.Decimal(18, 3), r.val_tasavta)
                        .input('val_tasaTci', sql.Decimal(18, 3), r.val_tasaTci)
                        .input('val_tasaTce', sql.Decimal(18, 3), r.val_tasaTce)
                        .input('val_tasaTir', sql.Decimal(18, 3), r.val_tasaTir)
                        .input('val_perdida', sql.Decimal(18, 3), r.val_perdida)
                        .query(`
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

                    for (const rb of r.resultadosben) {
                        await transaction.request()
                            .input('id_est', sql.Int, idEstudio)
                            .input('id_ordenben', sql.Int, rb.id)
                            .input('val_pensionben', sql.Decimal(18, 3), rb.prc)
                            .query(`
                            UPDATE c_estudiobeneficiario SET
                            val_pension = @val_pensionben
                            WHERE id_est = @id_est AND id_orden = @id_ordenben
                        `);
                    }
                }
            }

            numerofinal++;
            // 4. Actualizar numerador de cotizacion extroficial
            await transaction.request()
                .input('nuevoNum', sql.Int, numerofinal)
                .input('anio', sql.Int, anioActual)
                .query(`UPDATE m_numeradores SET n_numext = @nuevoNum WHERE n_aperiodo = @anio`);

            await transaction.commit();
            return { ok: true, message: 'Cotización guardada con éxito' };

        } catch (error) {
            console.error("💥 SQL ERROR:", error?.originalError);
            console.error("💥 MESSAGE:", error.message);
            console.error("💥 CODE:", error.code);
            await transaction.rollback();
            console.error('Error en guardarEstudio:', error);
            // try {
            //     await transaction.rollback();
            // } catch (rbErr) {
            //     console.error("⚠️ Rollback ya había sido abortado");
            // }
            return { ok: false, message: 'Error al guardar la cotización', error };
        } finally {
            //pool.close();
        }
    },

    async listarEstudios(filtros = {}) {
        try {
            const pool = await poolPromise;
            const request = pool.request();

            // Parámetros opcionales
            if (filtros.tipoDoc) request.input('tipoDoc', sql.Int, filtros.tipoDoc);
            if (filtros.numDoc) request.input('numDoc', sql.VarChar(20), `%${filtros.numDoc}%`);
            if (filtros.nombre) request.input('nombre', sql.VarChar(50), `%${filtros.nombre}%`);
            if (filtros.apepat) request.input('apepat', sql.VarChar(50), `%${filtros.apepat}%`);
            if (filtros.apemat) request.input('apemat', sql.VarChar(50), `%${filtros.apemat}%`);

            let query = `
                        SELECT TOP 20
                        e.id,
                        e.num_cot,
                        e.fec_creacion,
                        a.id_tipodociden,
                        a.num_dociden,
                        a.cod_cuspp,
                        a.des_nombre,
                        a.des_apepaterno,
                        a.des_apematerno
                        FROM c_estudio e
                        INNER JOIN c_estudioasegurado a ON e.id = a.id_est
                        WHERE 1=1
                    `;

            // Agregamos filtros dinámicamente
            if (filtros.tipoDoc) query += ' AND a.id_tipodociden = @tipoDoc';
            if (filtros.numDoc) query += ' AND a.num_dociden LIKE @numDoc';
            if (filtros.nombre) query += ' AND a.des_nombre LIKE @nombre';
            if (filtros.apepat) query += ' AND a.des_apepaterno LIKE @apepat';
            if (filtros.apemat) query += ' AND a.des_apematerno LIKE @apemat';

            query += ' ORDER BY e.id DESC';

            const result = await request.query(query);
            return result.recordset;
        } catch (err) {
            console.error('Error al listar estudios:', err);
            throw err;
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
    },

    async obtenerEstudioCompleto(id) {
        try {
            const pool = await poolPromise;
            const [estudio, asegurado, beneficiarios, modalidades] = await Promise.all([
                pool.request().input("id", sql.Int, id).query("SELECT * FROM c_estudio WHERE id = @id"),
                pool.request().input("id", sql.Int, id).query("SELECT * FROM c_estudioasegurado WHERE id_est = @id"),
                pool.request().input("id", sql.Int, id).query("SELECT * FROM c_estudiobeneficiario WHERE id_est = @id"),
                pool.request().input("id", sql.Int, id).query("SELECT * FROM c_estudiomodalidad WHERE id_est = @id")
            ]);

            if (estudio.recordset.length === 0) return null;

            return {
                ...estudio.recordset[0],
                asegurado: asegurado.recordset[0],
                beneficiarios: beneficiarios.recordset,
                modalidades: modalidades.recordset
            };
        } catch (err) {
            console.error('Error al listar estudios para PDF:', err);
            throw err;
        }
    }
};

module.exports = EstudioModel;
