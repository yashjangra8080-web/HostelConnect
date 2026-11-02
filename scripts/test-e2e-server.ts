import http from 'http';
import path from 'path';
import express from 'express';
import { app } from '../server/src/index.js';

app.use(express.static(path.resolve('web/dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.resolve('web/dist/index.html'));
});

const server = http.createServer(app);
server.listen(4500, () => {
  console.log('E2E Test Server listening on http://localhost:4500');
  setTimeout(() => {
    server.close(() => console.log('Server closed'));
  }, 1000);
});
