const fs = require('fs');

const schema = fs.readFileSync('./schema.graphql');

module.exports = gql`
  ${schema}
`;
