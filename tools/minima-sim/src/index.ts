const Fastify = require('fastify');
const { nanoid } = require('nanoid');
const { registry, simLatency, simReqs, simErrors, simBlendAlpha } = require('./metrics');
const { Behavior } = require('./behavior');
const { loadScenario } = require('./scenario');
const { ScenarioSequencer } = require('./sequencer');

const scenarioPath = process.env.SIM_SCENARIO;
const schedulePath = process.env.SIM_SCHEDULE;          // NEW: path to diurnal schedule YAML
const defaultPort = 9005;
const port = Number(process.env.PORT || defaultPort);

let currentMeta = { name: 'default', region: 'unknown', nodeType: 'rpc' };

const baseScenario = loadScenario(scenarioPath);        // fallback / initial
const behavior = new Behavior(baseScenario);

// NEW: Start sequencer if schedule provided
let sequencer = null;
if (schedulePath) {
  try {
    sequencer = new ScenarioSequencer(schedulePath);
    sequencer.start(behavior, (meta) => {
      currentMeta = meta;
    });
  } catch (err) {
    console.warn('Failed to start sequencer:', err.message);
  }
}

const app = Fastify({ logger: true });

(async () => {
  try {
    const { emitInvocation } = await import('../../../packages/observability/src/node.js');
    await emitInvocation({
      dappId: process.env.AXIA_DAPP_ID || 'minima-sim',
      method: 'tool.minima_sim.boot',
      platform: 'node',
      region: process.env.SIM_REGION || currentMeta.region,
    });
  } catch {}
})();

app.get('/metrics', async (_req: any, reply: any) => {
  reply.header('Content-Type', registry.contentType);
  reply.send(await registry.metrics());
});

app.get('/__info', async (_req: any, reply: any) => {
  reply.send({
    sim: true,
    name: currentMeta.name || baseScenario.name,
    region: currentMeta.region || baseScenario.region || 'na',
    nodeType: currentMeta.nodeType || baseScenario.nodeType || 'rpc',
    sequencer: !!sequencer,
    startedAt: new Date().toISOString()
  });
});

/**
 * Minimal JSON-RPC-like Minima shape:
 * POST /
 *  { command: 'status' | 'balance' | 'send' ... , ... }
 */
app.post('/', async (req: any, reply: any) => {
  const body: any = req.body || {};
  const command = (body.command || 'rpc').toLowerCase();
  simReqs.labels(command).inc();

  const { enabled, latency, failure } = behavior.decide(command);
  await new Promise(r => setTimeout(r, latency));
  simLatency.labels(command).observe(latency);

  if (!enabled) {
    simErrors.labels('capability_disabled').inc();
    return reply.code(501).send({ status:false, error:'capability disabled' });
  }

  // Failure injection
  if (failure === 'timeout') {
    simErrors.labels('timeout').inc();
    // never respond (let client timeout)
    return new Promise(() => {/* hang */});
  }
  if (failure === 'http500') {
    simErrors.labels('http500').inc();
    return reply.code(500).send({ status:false, error:'simulated 500' });
  }
  if (failure === 'malformed') {
    simErrors.labels('malformed').inc();
    reply.header('Content-Type', 'application/json');
    return reply.send('{"oops":'); // broken JSON
  }
  if (failure === 'drop') {
    simErrors.labels('drop').inc();
    // close connection abruptly
    (req.raw as any).socket.destroy();
    return;
  }

  // Success responses
  if (command === 'status') {
    const now = new Date();
    return reply.send({
      command: 'status',
      status: true,
      pending: false,
      response: {
        version: 'sim-1.0.0',
        uptime: `${Math.floor((Date.now()-(app.server as any).startTime)/1000)}s`,
        locked: false,
        length: 5300 + Math.floor(Math.random()*50),
        weight: String(7.983e14 + Math.floor(Math.random()*1e6)),
        minima: '999991000.0000000000000000000000000000000000000000000',
        coins: String(1200000 + Math.floor(Math.random()*1000)),
        memory: { ram: '200.0 MB', disk: '540.0 MB' }
      },
      timestamp: now.toISOString()
    });
  }

  // Generic echo with a simulated tx id
  return reply.send({
    status: true,
    command,
    id: nanoid(12),
    echo: body,
    timestamp: new Date().toISOString()
  });
});

// save server start time
(app.server as any).startTime = Date.now();

app.listen({ host: '0.0.0.0', port }).then(() => {
  app.log.info(`Minima-sim running on :${port} (${scenario.name})`);
}).catch((e: any) => {
  app.log.error(e, 'Failed to start minima-sim');
  process.exit(1);
});