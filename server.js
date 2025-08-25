require('dotenv').config();
const express = require('express');
const app = express();
const PORT = 3000;
const rutinaRoutes = require('./routes/rutinaRoutes');
const authRoutes = require('./routes/authRoutes');
const requestLogger = require("./middleware/requestLogger");

// Middleware para parsear JSON
//app.use(express.json());
app.use(express.json({ limit: '10mb' })); // o el tamaño que necesites
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: ['application/xml', 'text/plain'], limit: '1mb' }));
app.use(requestLogger);

// RUTAS
app.use('/auth', authRoutes);
app.use('/rutinarv', rutinaRoutes);

// Ruta base
app.get('/', (req, res) => {
  res.send('¡Hola desde Express!');
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});