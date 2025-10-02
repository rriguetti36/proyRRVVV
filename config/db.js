//Conexion con SQL SERVER
const sql = require('mssql');
require('dotenv').config();

// Configuración de conexión
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,    // Ej: "localhost" o "127.0.0.1"
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT) || 50535,
  options: {
    encrypt: false,               // en local normalmente false
    trustServerCertificate: true, // true si usas Express o sin SSL
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  }
};

// Creamos un pool de conexiones
const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then(pool => {
    console.log('✅ Conexión a SQL Server exitosa');
    return pool;
  })
  .catch(err => {
    console.error('❌ Error de conexión a SQL Server:', err.message);
  });

module.exports = {
  sql, poolPromise
};


//conexio con MYSQL
/* const mysql = require('mysql2/promise');
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
module.exports = db; */





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