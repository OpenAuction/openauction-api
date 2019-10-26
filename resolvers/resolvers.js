const resolvers = {
  Query: {
    messages: async (parent, queryArgs, context) => {
      const results = await context.postgresPool.query(
        `SELECT * FROM bids ORDER BY id DESC LIMIT 10`
      );
      return results.rows;
    },
  },
  EventMessage: {
    __resolveType: parent => {
      return `${parent.eventTag}_Message`;
    },
  },
  Message: {
    __resolveType: parent => {
      return parent.eventTag;
    },
  },
};

module.exports = resolvers;
