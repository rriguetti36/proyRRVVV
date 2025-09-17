const fs = require("fs");
const iconv = require("iconv-lite");

/**
 * Normaliza cualquier XML a UTF-8 válido.
 * - Convierte desde ISO-8859-1 (latin1) u otros a UTF-8.
 * - Reemplaza la cabecera por encoding UTF-8.
 * - Limpia caracteres ilegales.
 *
 * @param {string|Buffer} input - Ruta del archivo XML o contenido en texto.
 * @param {boolean} isFile - true si es un archivo, false si es texto.
 * @returns {string} XML normalizado en UTF-8
 */
function normalizeXmlToUtf8(input, isFile = true) {
  let xmlContent = "";

  if (isFile) {
    const buffer = fs.readFileSync(input);
    // decodifica asumiendo ISO-8859-1, puedes cambiar a "utf-8" si lo requieres
    xmlContent = iconv.decode(buffer, "latin1");
  } else {
    xmlContent = input;
  }

  // fuerza cabecera en UTF-8
  xmlContent = xmlContent.replace(
    /<\?xml.*encoding=.*\?>/i,
    '<?xml version="1.0" encoding="UTF-8"?>'
  );

  // elimina caracteres ilegales
  xmlContent = xmlContent.replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD]/g, "");
  console.log(xmlContent);
  return xmlContent;
}

module.exports = { normalizeXmlToUtf8 };