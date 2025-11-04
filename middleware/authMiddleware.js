// module.exports = {
//   ensureAuthenticated: (req, res, next) => {
//     if (req.session.user) {
//       return next();
//     } else {
//       return res.redirect('/login');
//     }
//   }
// };

module.exports = function (req, res, next) {
    if (!req.session || !req.session.user) {
        return res.redirect('/auth/login'); // Si perdió sesión, manda al login
    }
    next();
};