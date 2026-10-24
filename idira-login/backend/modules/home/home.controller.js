const showHome = (req, res) => res.render('home/index', { user: req.session.user, saml: req.session.saml });

module.exports = { showHome };
