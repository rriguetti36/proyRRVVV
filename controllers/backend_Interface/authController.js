const AuthModel = require('../../models/authModel');

exports.loginView = async (req, res) => {
    res.render('login', { layout: "layouts/layoutLogin" });
}

exports.login = async (req, res) => {
    const { usuario, password } = req.body;

    try {
        const user = await AuthModel.login(usuario, password);
        console.log("user",user)
        if (!user) return res.render('login', { layout: "layouts/layoutLogin", error: 'Usuario o contraseña inválidos' });

        req.session.user = user;
        res.redirect('/dashboard');
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).send('Error interno');
    }
}

exports.logout = async (req, res) => {
    req.session.destroy();
    res.redirect('/auth/login');
}