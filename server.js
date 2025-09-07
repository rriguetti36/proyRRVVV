require('dotenv').config();
const express = require('express');
const http = require("http");   // si usas CommonJS
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const PORT = 3000;
const rutinaRoutes = require('./routes/rutinaRoutes');
const authRoutes = require('./routes/authRoutes');
const requestLogger = require("./middleware/requestLogger");
const cors = require("cors");
const path = require("path");

// Montar socket.io sobre el mismo servidor http
const io = new Server(server, {
  cors: {
    origin: "*", // ⚠️ ajustar según necesidad
    methods: ["GET", "POST"]
  }
});

// habilita CORS para todos los orígenes
app.use(cors());
// Middleware para parsear JSON
//app.use(express.json());
app.use(express.json({ limit: '10mb' })); // o el tamaño que necesites
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: ['application/xml', 'text/plain'], limit: '1mb' }));
app.use(requestLogger);

//uso de ejs
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// Middleware para interceptar console.log
const logs = [];
const originalLog = console.log;
console.log = function (...args) {
  logs.push(args.join(" "));
  io.emit("log", args.join(" ")); // enviar a los clientes conectados
  originalLog.apply(console, args);
};

// RUTAS
app.use('/auth', authRoutes);
app.use('/rutinarv', rutinaRoutes);

// Ruta base
/* app.get('/', (req, res) => {
  res.send('¡Hola desde Express!, con Socket.IO activo 🚀');
});
 */
// Escuchar conexiones de clientes
io.on("connection", (socket) => {
  console.log("🔌 Cliente conectado");

  // mandar un log de prueba
  socket.emit("log", "Bienvenido, estás conectado al backend");

  socket.on("disconnect", () => {
    console.log("❌ Cliente desconectado");
  });
});

//pagina vista inicial
app.get("/", (req, res) => {
  res.render("index", { titulo: "App EJS", mensaje: "Hola con CommonJS" });
});

// Iniciar el servidor
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});