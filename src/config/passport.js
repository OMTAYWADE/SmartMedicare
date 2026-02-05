const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

// Local login strategy
passport.use(
  new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      // ❌ DO NOT populate here
      const user = await User.findOne({ email });
      if (!user) return done(null, false, { message: 'Email not registered' });

      const match = await user.comparePassword(password);
      if (!match) return done(null, false, { message: 'Incorrect password' });

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

// Session handling
passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  // ❌ DO NOT populate here
  const user = await User.findById(id);
  done(null, user);
});
