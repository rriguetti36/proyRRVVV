const fs = require('fs');
const { create } = require('xmlbuilder2');
const libxmljs = require('libxmljs');

// 👉 JSON de ejemplo (puedes reemplazarlo con tu variable)
//const datos = require('./datos.json'); // o reemplázalo directamente

// 👇 Función para convertir a XML
function generarXML(jsonData, rutaSalida = 'salida.xml') {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('cargaCotizaciones', {
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance'
    });

  // Agrupar por nroOperacion
  const agrupadoPorOperacion = {};
  for (const item of jsonData) {
    const key = item.operacion;
    if (!agrupadoPorOperacion[key]) agrupadoPorOperacion[key] = [];
    agrupadoPorOperacion[key].push(item);
  }

  for (const nroOperacion in agrupadoPorOperacion) {
    const items = agrupadoPorOperacion[nroOperacion];
    const cuspp = items[0]?.CUSPP || '';

    const cotizaciones = root.ele('cotizaciones');
    cotizaciones.ele('nroOperacion').txt(nroOperacion);
    cotizaciones.ele('CUSPP').txt(cuspp);

    items.forEach(item => {
      const producto = cotizaciones.ele('productoCotizado');
      producto.ele('modalidad').txt(item.modalidad);
      producto.ele('moneda').txt(item.moneda);

      if (item.anosRT && parseFloat(item.anosRT) > 0) {
        if (item.anosRT) producto.ele('anosRT').txt(item.anosRT);
        if (item.porcentajeRVD) producto.ele('porcentajeRVD').txt(item.porcentajeRVD);
      }

      if (item.periodoGarantizado && parseFloat(item.periodoGarantizado) > 0) {
        if (item.periodoGarantizado) producto.ele('periodoGarantizado').txt(item.periodoGarantizado);
      }

      producto.ele('derechoCrecer').txt(item.derechoCrecer);
      producto.ele('gratificacion').txt(item.gratificacion);

      const cotizacion = producto.ele('cotizacionEESS');
      cotizacion.ele('siCotizaNoCotiza').txt(item.siCotizaNoCotiza);
      cotizacion.ele('nroCotizacion').txt(item.nroCotizacion);

      if (item.primaUnicaAFPEESS && parseFloat(item.primaUnicaAFPEESS) > 0)
        cotizacion.ele('primaUnicaAFPEESS').txt(item.primaUnicaAFPEESS);

      if (item.primaUnicaEESS && parseFloat(item.primaUnicaEESS) > 0)
        cotizacion.ele('primaUnicaEESS').txt(item.primaUnicaEESS);

      if (item.modalidad === 'RV') {
        cotizacion.ele('primeraPensionRV').txt(item.pencia);
        cotizacion.ele('tasaInteresRV').txt(item.tasavta);
      } else if (item.modalidad === 'RTVD') {
        cotizacion.ele('primeraPensionRT').txt(item.penafp);
        cotizacion.ele('tasaInteresRT').txt(item.tasavta);
        cotizacion.ele('primeraPensionRVD').txt(item.penref);
        cotizacion.ele('tasaInteresRVD').txt(item.tasavta);
      }
    });
  }

  const xmlString = root.end({ prettyPrint: true });
  fs.writeFileSync(rutaSalida, xmlString, 'utf8');
  return xmlString;
}


// 👇 Validar XML con XSD
function validarXML(xmlString, xsdPath) {
  const xsd = fs.readFileSync(xsdPath, 'utf8');
  const xmlDoc = libxmljs.parseXml(xmlString);
  const xsdDoc = libxmljs.parseXml(xsd);
  const isValid = xmlDoc.validate(xsdDoc);
  return { isValid, errores: xmlDoc.validationErrors };
}

// function validarXML(xmlContent, xsdPath) {
//   const xsd = fs.readFileSync(xsdPath, 'utf8');
//   const xmlDoc = libxmljs.parseXml(xmlContent);
//   const xsdDoc = libxmljs.parseXml(xsd);

//   const isValid = xmlDoc.validate(xsdDoc);
//   if (!isValid) {
//     console.error('❌ Errores de validación XML:', xmlDoc.validationErrors);
//   } else {
//     console.log('✅ XML válido con el esquema XSD.');
//   }
//   return isValid;
// }

module.exports = { generarXML, validarXML };
