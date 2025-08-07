const db = require('../../config/db');
const { cotizacionMapa, relacionesTablas } = require('../../models/querys/cotizacionMapa');

// Buscar campo por alias amigable
function buscarCampoAmigable(campoUsuario) {
  for (const [tabla, campos] of Object.entries(cotizacionMapa)) {
    const campo = campos.find(c => c.atributo_query === campoUsuario);
    if (campo) {
      return {
        tabla,
        columna: campo.atributo,
        alias: campoUsuario
      };
    }
  }
  return null;
}

exports.ejecutarConsulta = async ({ campos, filtros, tablasSolicitadas = [], opciones = {} }) => {
  const { groupBy = [], orderBy = [] } = opciones;
  const camposTraducidos = [];
  const condiciones = [];
  const valores = [];
  const tablasUsadas = new Set();

  /* try {
    console.log("campos:", Array.isArray(campos) ? campos : JSON.parse(campos));
  } catch (e) {
    console.log("❌ Error al parsear 'campos':", e.message);
    console.log("Valor de 'campos':", campos);
  }
  try {
    console.log("filtros:", typeof filtros === "string" ? JSON.parse(filtros) : filtros);
  } catch (e) {
    console.log("❌ Error al parsear 'filtros':", e.message);
    console.log("Valor de 'filtros':", filtros);
  }
  try {
    console.log("tablasSolicitadas:", Array.isArray(tablasSolicitadas) ? tablasSolicitadas : JSON.parse(tablasSolicitadas));
  } catch (e) {
    console.log("❌ Error al parsear 'tablasSolicitadas':", e.message);
    console.log("Valor de 'tablasSolicitadas':", tablasSolicitadas);
  }
  console.log("opciones completas:", opciones); */

  // --- Traducción de campos ---
  for (const campo of campos) {
    let [func, campoUsuario] = campo.includes(':') ? campo.split(':') : [null, campo];
    const encontrado = buscarCampoAmigable(campoUsuario);
    if (!encontrado) continue;

    tablasUsadas.add(encontrado.tabla);
    const colSQL = `${encontrado.tabla}.${encontrado.columna}`;
    const alias = `${func ? func + "_" : ""}${campoUsuario}`;

    if (func) {
      const funcionSQL = func.toUpperCase();
      if (["SUM", "COUNT", "MIN", "MAX"].includes(funcionSQL)) {
        camposTraducidos.push(`${funcionSQL}(${colSQL}) AS ${alias}`);
      } else {
        throw new Error(`Función agregada no soportada: ${func}`);
      }
    } else {
      camposTraducidos.push(`${colSQL} AS ${alias}`);
    }
  }

  if (camposTraducidos.length === 0) {
    throw new Error("No hay campos válidos en la consulta.");
  }

  // --- Traducción de filtros ---
  for (const key in filtros) {
    const encontrado = buscarCampoAmigable(key);
    if (!encontrado) continue;

    tablasUsadas.add(encontrado.tabla);
    const colSQL = `${encontrado.tabla}.${encontrado.columna}`;
    //const { op = "=", valor } = filtros[key];
    const filtro = filtros[key];
    let op = filtro.op || "=";
    let val = filtro.valor;

    switch (op) {
      case "=":
      case ">":
      case ">=":
      case "<":
      case "<=":
        condiciones.push(`${colSQL} ${op} ?`);
        valores.push(val);
        break;
      case "like":
      case "LIKE":
        condiciones.push(`${colSQL} LIKE ?`);
        valores.push(val);
        break;
      case "between":
      case "BETWEEN":
        if (Array.isArray(val) && val.length === 2) {
          condiciones.push(`${colSQL} BETWEEN ? AND ?`);
          valores.push(val[0], val[1]);
        }
        break;
      case "in":
      case "IN":
        if (Array.isArray(val) && val.length > 0) {
          const placeholders = val.map(() => '?').join(', ');
          condiciones.push(`${colSQL} IN (${placeholders})`);
          valores.push(...val);
        }
        break;
      default:
        throw new Error(`Operador no soportado: ${op}`);
    }

  }

  // --- Determinar tablas base ---
  const tablasFinales = tablasSolicitadas.length > 0 ? tablasSolicitadas : Array.from(tablasUsadas);
  const tablaBase = tablasFinales[0];

  // --- JOINs automáticos ---
  //console.log("tablasFinales",tablasFinales)
  const joins = [];
  for (let i = 1; i < tablasFinales.length; i++) {
    for (let j = 0; j < tablasFinales.length; j++) {
      if (i === j) continue;
      const rel = relacionesTablas[tablasFinales[j]]?.[tablasFinales[i]];
      //console.log("rel",rel)
      //console.log("tablasFinales[j]",tablasFinales[j])
      //console.log("tablasFinales[i]",tablasFinales[i])
      

      if (rel) {
        for (const join of rel) {
          if (!joins.includes(join)) {
            joins.push(join);
          }
        }
      }
    }
  }

  // --- GROUP BY ---
  const groupSQL = groupBy.map(campo => {
    const encontrado = buscarCampoAmigable(campo);
    return encontrado ? `${encontrado.tabla}.${encontrado.columna}` : null;
  }).filter(Boolean);
  const groupClause = groupSQL.length ? `GROUP BY ${groupSQL.join(", ")}` : "";

  // --- ORDER BY ---
  const orderSQL = orderBy.map(o => {
    const [campo, dir] = o.split(":");
    const encontrado = buscarCampoAmigable(campo);
    return encontrado ? `${encontrado.tabla}.${encontrado.columna} ${dir?.toUpperCase() === "DESC" ? "DESC" : "ASC"}` : null;
  }).filter(Boolean);
  const orderClause = orderSQL.length ? `ORDER BY ${orderSQL.join(", ")}` : "";

  // --- Construir y ejecutar SQL ---
  const sql = `
    SELECT ${camposTraducidos.join(", ")}
    FROM ${tablaBase}
    ${joins.join("\n")}
    ${condiciones.length ? "WHERE " + condiciones.join(" AND ") : ""}
    ${groupClause}
    ${orderClause}
    LIMIT 100;
  `;
  console.log("Query", sql);
  const [rows] = await db.execute(sql, valores);
  return rows;
};
