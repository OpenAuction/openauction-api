const { gql } = require('apollo-server');
const fs = require('fs');
const schema = fs.readFileSync('./schema/schema.graphql');

module.exports = gql`
  ${schema}
`;
