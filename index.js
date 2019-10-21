try{require('dotenv').config()}catch(e){}
const { ApolloServer, gql } = require('apollo-server');
const { Pool } = require('pg');
const schema = require('./schema/schema');

const resolvers = {
  Query: {
    messages: async (parent, queryArgs, context) => {
      const results = await context.pool.query(
        `SELECT * FROM bids ORDER BY id DESC LIMIT 10`
      );
      return results.rows;
    },
  },
  EventMessage: {
    __resolveType: parent => {
      console.log(parent);
      return `${parent.eventTag}_Message`;
    },
  },
  Message: {
    __resolveType: parent => {
      return parent.eventTag;
    },
  },
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

pool.query('SELECT NOW()', err => {
  if (err) {
    console.log('Error connecting to postgres', err);
  } else {
    console.log('Connected to Postgres');
  }
});

const server = new ApolloServer({
  typeDefs: schema,
  resolvers,
  context: {
    pool,
  },
});

server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
