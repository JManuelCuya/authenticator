const showHome = (req, res) => res.render('home/index', { user: req.session.user });

module.exports = { showHome };
