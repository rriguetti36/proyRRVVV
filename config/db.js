const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
// Probar conexión
(async () => {
    try {
      const connection = await db.getConnection();
      console.log('✅ Conexión a MySQL exitosa');
      connection.release(); // importante
    } catch (err) {
      console.error('❌ Error de conexión:', err.message);
    }
  })();
module.exports = db;
// const mysql = require('mysql2');

// const db = mysql.createConnection({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_DATABASE,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0
// });

// db.connect((err) => {
//     if (err) {
//         console.error('Error de conexión:', err);
//         return;
//     }
//     console.log('Conectado a MySQL');
// });

// module.exports = db;