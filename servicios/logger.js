// logger.js
const { createLogger, transports, format } = require("winston");
const path = require("path");

const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
  ),
  transports: [
    new transports.File({ filename: path.join(__dirname, "../logs.log") }), // archivo .log
    new transports.Console() // también muestra en consola
  ]
});

module.exports = logger;