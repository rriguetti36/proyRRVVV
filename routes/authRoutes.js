const authController = require('../controllers/backend_Interface/authController');
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Clientes válidos (puedes mover esto a una BD o archivo config)
const CLIENTES_AUTORIZADOS = {
  cliente1: 'secret123',
  cliente2: 'clave456'
};

router.post('/token', (req, res) => {
  const { clientId, clientSecret } = req.body;

  if (CLIENTES_AUTORIZADOS[clientId] !== clientSecret) {
    return res.status(403).json({ error: 'Credenciales inválidas' });
  }

  const payload = { clientId };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '2h' });

  res.json({ token });
});

router.get('/login', authController.loginView);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

module.exports = router;