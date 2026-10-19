/** Local synthetic harness; never connect this process to real user data. */
import { createServer } from 'node:http';
import { createMockService } from '../src/domain/service';
import type { Request } from '../src/domain/types';
const service = createMockService();
const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !['http://127.0.0.1:8932', 'http://localhost:8932'].includes(origin)) {res.writeHead(403).end();return;}
  res.setHeader('Access-Control-Allow-Origin', origin || 'http://127.0.0.1:8932');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {res.writeHead(204).end();return;}
  const snapshot = () => ({...service.getSnapshot(),runtimeProfile:'connected'});
  try {
    const path = new URL(req.url || '/', 'http://127.0.0.1').pathname;
    if (req.method === 'GET' && path === '/api/snapshot') {res.end(JSON.stringify(snapshot()));return;}
    if (req.method === 'GET' && path.startsWith('/api/operations/')) {
      const operation = await service.getOperation(decodeURIComponent(path.slice('/api/operations/'.length)));
      res.writeHead(operation ? 200 : 404).end(JSON.stringify(operation || {code:'NOT_FOUND'}));return;
    }
    if (req.method === 'POST' && path === '/api/commands') {
      let body='';
      for await (const chunk of req) {body+=chunk;if(Buffer.byteLength(body)>1024*1024){res.writeHead(413).end();return;}}
      const request=JSON.parse(body) as Request;
      if (!request || request.operationId !== req.headers['idempotency-key'] || !['emma','john'].includes(request.role) || !request.command) {res.writeHead(400).end(JSON.stringify({code:'INVALID_REQUEST'}));return;}
      await service.execute(request);res.end(JSON.stringify(snapshot()));return;
    }
    res.writeHead(404).end(JSON.stringify({code:'NOT_FOUND'}));
  } catch {res.writeHead(400).end(JSON.stringify({code:'SYNTHETIC_COMMAND_FAILED'}));}
});
server.listen(8933,'127.0.0.1',()=>console.log('Synthetic contract harness: http://127.0.0.1:8933/api/ (no real backend/model/voice)'));
