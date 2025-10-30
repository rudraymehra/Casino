/**
 * Linera GraphQL Mock Server
 * Gerçek Linera GraphQL endpoint'ini simüle eder
 */

const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { buildSchema } = require('graphql');
const cors = require('cors');

// GraphQL Schema - Linera'nın gerçek schema'sına benzer
const schema = buildSchema(`
  type Query {
    chains: [Chain!]!
    chain(chainId: String!): Chain
    applications(chainId: String!): [Application!]!
    application(chainId: String!, applicationId: String!): Application
  }

  type Mutation {
    executeOperation(chainId: String!, operation: String!): OperationResult!
    transfer(from: String!, to: String!, amount: String!): TransferResult!
  }

  type Chain {
    id: String!
    blockHeight: Int!
    timestamp: String!
    description: String
    balance: String!
    nextBlockHeight: Int!
  }

  type Application {
    id: String!
    description: String!
    state: String
    link: String
  }

  type OperationResult {
    hash: String!
    blockHeight: Int!
    timestamp: String!
    success: Boolean!
    chainId: String!
  }

  type TransferResult {
    hash: String!
    blockHeight: Int!
    timestamp: String!
    success: Boolean!
    amount: String!
  }
`);

// Mock data generator
const generateTxHash = () => {
  return Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
};

const generateChainId = () => {
  return Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
};

// Mock chains data
const mockChains = [
  {
    id: 'e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65',
    blockHeight: 1234,
    timestamp: new Date().toISOString(),
    description: 'Casino Game Logger Chain',
    balance: '1000000000000000000000',
    nextBlockHeight: 1235
  }
];

// Resolvers
const root = {
  chains: () => {
    return mockChains;
  },

  chain: ({ chainId }) => {
    return mockChains.find(chain => chain.id === chainId) || mockChains[0];
  },

  applications: ({ chainId }) => {
    return [
      {
        id: 'e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65010000000000000000000000e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65030000000000000000000000',
        description: 'Casino Game Logger Application',
        state: JSON.stringify({
          gamesLogged: Math.floor(Math.random() * 1000),
          lastUpdate: new Date().toISOString(),
          totalBets: '50000000000000000000',
          totalPayouts: '45000000000000000000'
        }),
        link: `http://localhost:3000/linera/${chainId}`
      }
    ];
  },

  application: ({ chainId, applicationId }) => {
    return {
      id: applicationId,
      description: 'Casino Game Logger Application',
      state: JSON.stringify({
        gamesLogged: Math.floor(Math.random() * 1000),
        lastUpdate: new Date().toISOString(),
        totalBets: '50000000000000000000',
        totalPayouts: '45000000000000000000'
      }),
      link: `http://localhost:3000/linera/${chainId}`
    };
  },

  executeOperation: ({ chainId, operation }) => {
    const parsedOperation = JSON.parse(operation);
    console.log('🎮 Linera Operation Executed:', {
      chainId: chainId.slice(0, 8) + '...',
      operation: parsedOperation,
      timestamp: new Date().toISOString()
    });

    // Mock chain'in block height'ını artır
    const chain = mockChains.find(c => c.id === chainId) || mockChains[0];
    chain.blockHeight += 1;
    chain.nextBlockHeight += 1;
    chain.timestamp = new Date().toISOString();

    return {
      hash: generateTxHash(),
      blockHeight: chain.blockHeight,
      timestamp: new Date().toISOString(),
      success: true,
      chainId: chainId
    };
  },

  transfer: ({ from, to, amount }) => {
    console.log('💸 Linera Transfer:', {
      from: from.slice(0, 8) + '...',
      to: to.slice(0, 8) + '...',
      amount,
      timestamp: new Date().toISOString()
    });

    const chain = mockChains[0];
    chain.blockHeight += 1;
    chain.nextBlockHeight += 1;
    chain.timestamp = new Date().toISOString();

    return {
      hash: generateTxHash(),
      blockHeight: chain.blockHeight,
      timestamp: new Date().toISOString(),
      success: true,
      amount
    };
  }
};

// Express app
const app = express();

// CORS
app.use(cors());

// GraphQL endpoint
app.use('/graphql', graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true,
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Linera GraphQL Mock Server',
    timestamp: new Date().toISOString(),
    chains: mockChains.length,
    latestBlock: mockChains[0].blockHeight
  });
});

// Explorer endpoint
app.get('/explorer', (req, res) => {
  res.json({
    chains: mockChains,
    totalTransactions: mockChains[0].blockHeight,
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = 8080;
app.listen(PORT, () => {
  console.log('🚀 Linera GraphQL Mock Server running on http://localhost:8080/graphql');
  console.log('📊 GraphiQL interface available at http://localhost:8080/graphql');
  console.log('🔍 Explorer API at http://localhost:8080/explorer');
  console.log('❤️ Health check at http://localhost:8080/health');
  console.log('');
  console.log('🎮 Ready to receive casino game logs!');
});