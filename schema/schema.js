const { gql } = require('apollo-server-express');
const fs = require('fs');
const schema = fs.readFileSync('./schema/schema.graphql');

module.exports = gql`
  ${schema}
`;
