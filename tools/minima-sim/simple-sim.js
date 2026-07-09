const fastify = require('fastify')({ logger: true });
const { nanoid } = require('nanoid');

const port = process.env.PORT || 9007;
const scenario = {
  name: 'simple-test',
  region: 'eu-west',
  nodeType: 'rpc',
  healthScore: 100
};

// Add JSON parsing support
fastify.register(require('@fastify/formbody'));

// Info endpoint
fastify.get('/__info', async (request, reply) => {
  return {
    sim: true,
    name: scenario.name,
    region: scenario.region,
    nodeType: scenario.nodeType,
    startedAt: new Date().toISOString()
  };
});

// Status endpoint (like real Minima)
fastify.post('/', async (request, reply) => {
  const body = request.body || {};
  const command = (body.command || 'status').toLowerCase();
  
  // Add some realistic latency
  await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 40));
  
  if (command === 'status') {
    return {
      command: 'status',
      status: true,
      pending: false,
      response: {
        version: 'sim-1.0.0',
        uptime: '123s',
        locked: false,
        length: 5300 + Math.floor(Math.random() * 50),
        weight: String(7.983e14 + Math.floor(Math.random() * 1e6)),
        minima: '999991000.0000000000000000000000000000000000000000000',
        coins: String(1200000 + Math.floor(Math.random() * 1000)),
        memory: { ram: '200.0 MB', disk: '540.0 MB' }
      },
      timestamp: new Date().toISOString()
    };
  }

  // Generic response
  return {
    status: true,
    command,
    id: nanoid(12),
    echo: body,
    timestamp: new Date().toISOString()
  };
});

// Start server
fastify.listen({ port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Minima-sim running at ${address}`);
});