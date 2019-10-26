try {
  require('dotenv').config();
} catch (e) {}
const { ApolloServer } = require('apollo-server-express');
const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const fs = require('fs');
const FileStreamRotator = require('file-stream-rotator');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const helmet = require('helmet');
const Memcached = require('memcached');
const postgresStore = require('connect-pg-simple')(session);
const serverTiming = require('server-timing');
const { Pool } = require('pg');
const zlib = require('zlib');
const AWS = require('aws-sdk');
const schema = require('./schema/schema');
const resolvers = require('./resolvers/resolvers');
const index = require('./routes/index');

const isProd = process.env.NODE_ENV === 'production';

const allowedOrigins = {
  'https://openauction.dev': true,
  'https://openauction.app': true,
};

const logDirectory = path.join(__dirname, 'log');

console.log(`Running in NODE_ENV: ${process.env.NODE_ENV}`);

const postgresConnectionConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 10,
};

const postgresPool = new Pool(postgresConnectionConfig);

postgresPool.query('SELECT NOW()', err => {
  if (err) {
    console.log('Error connecting to postgres', err);
  } else {
    console.log('Connected to Postgres');
  }
});

const memcachedServer = process.env.MEMCACHED_URL.replace('memcached://', '');
const memcachedOptions = {
  timeout: 100,
  retries: 1,
};
const memcachedClient = new Memcached(memcachedServer, memcachedOptions);

memcachedClient.on('failure', details => {
  console.log(
    `Server
      ${details.server} went down due to: ${details.messages.join('')}`
  );
});

const app = express();

app.locals.memcachedClient = memcachedClient;
app.locals.postgresClient = postgresPool;
app.locals.isProd = isProd;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');



if (isProd) {
  app.use(helmet());
  app.set('trust proxy', 1);
  try {
    if (!fs.existsSync(logDirectory)) {
      fs.mkdirSync(logDirectory);
    }
  } catch (e) {
    console.error(e);
  }

  const accessLogStream = FileStreamRotator.getStream({
    filename: path.join(logDirectory, `${process.env.pm_id}-access.log`),
    frequency: 'daily',
    verbose: false,
  });

  accessLogStream.on('rotate', oldFile => {
    const body = fs.createReadStream(oldFile).pipe(zlib.createGzip());
    const s3obj = new AWS.S3({
      params: {
        Bucket: 'openauction-logs',
        Key: path.basename(oldFile),
      },
    });

    s3obj.upload({ Body: body }).send(err => {
      fs.unlink(oldFile, unlinkErr => {
        if (unlinkErr) console.error(unlinkErr);
      });

      if (err) {
        console.error(err);
        return;
      }
    });
  });

  app.use(logger('combined', { stream: accessLogStream }));

} else {
  app.use(logger('dev'))
}

app.use(serverTiming());
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const sessionKey = process.env.SESSION_KEY;

const sessionStore = isProd
  ? new postgresStore({
      pool: postgresPool,
    })
  : null;

const cookieSettings = isProd
  ? {
      secure: true,
      httpOnly: true,
      domain: 'openauction.app',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 30,
    }
  : null;

app.use(
  session({
    secret: sessionKey,
    name: 'OpenAuction',
    resave: true,
    saveUninitialized: false,
    store: sessionStore,
    cookie: cookieSettings,
  })
);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins[origin]) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept'
    );
  }

  next();
});

const server = new ApolloServer({
  typeDefs: schema,
  resolvers,
  engine: {
    apiKey: process.env.ENGINE_API_KEY,
    schemaTag: process.env.ENGINE_SCHEMA_TAG,
  },
  context: {
    postgresPool,
  },
  tracing: !isProd,
});

server.applyMiddleware({ app });

app.use('/', index);

app.use(express.static(path.join(__dirname, 'public')));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
