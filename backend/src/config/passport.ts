import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import pool from './database';

// JWT Strategy
const jwtOptions: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKeyProvider: (_req, _rawJwtToken, done) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      done(new Error('JWT_SECRET environment variable is required'), undefined);
      return;
    }
    done(null, secret);
  },
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const result = await pool.query(
        'SELECT id, username, email, email_verified, is_admin, account_status, token_version FROM users WHERE id = $1',
        [payload.id]
      );

      if (result.rows.length > 0) {
        const user = result.rows[0];
        if (user.account_status === 'disabled') {
          return done(null, false);
        }
        const payloadTokenVersion = Number((payload as any).token_version ?? 0);
        const currentTokenVersion = Number(user.token_version ?? 0);
        if (payloadTokenVersion !== currentTokenVersion) {
          return done(null, false);
        }
        return done(null, user);
      } else {
        return done(null, false);
      }
    } catch (error) {
      return done(error, false);
    }
  })
);

// Local Strategy
passport.use(
  new LocalStrategy({ usernameField: 'identifier' }, async (identifier, password, done) => {
    try {
      const lookup = identifier.trim();
      const result = await pool.query(
        `SELECT *
         FROM users
         WHERE username = $1 OR LOWER(email) = LOWER($1)
         LIMIT 1`,
        [lookup]
      );

      if (result.rows.length === 0) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      const user = result.rows[0];
      if (user.account_status === 'disabled') {
        return done(null, false, { message: '账号已被停用，请联系管理员', code: 'ACCOUNT_DISABLED' } as any);
      }
      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (!isMatch) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      return done(null, {
        id: user.id,
        username: user.username,
        email: user.email,
        email_verified: user.email_verified,
        is_admin: user.is_admin,
        account_status: user.account_status,
        token_version: user.token_version,
      });
    } catch (error) {
      return done(error);
    }
  })
);

export default passport;

