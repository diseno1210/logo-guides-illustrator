'use strict';
// Project-owned CEP page only. No browser profiles, user tabs or credentials.
async function connect(port = 8097) {
  const pages = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
  const page = pages.find(p => /\/local\.logoguides\.panel\/index\.html$/.test(p.url));
  if (!page) throw new Error('Open the Logo Guides CEP panel with its local .debug port enabled');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id); pending.delete(message.id); clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  };
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('CEP timeout: ' + method)); }, 30000);
      pending.set(id, {resolve, reject, timer}); socket.send(JSON.stringify({id, method, params}));
    });
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {expression, awaitPromise:true, returnByValue:true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  return {page, send, evaluate, close:() => socket.close()};
}
module.exports = {connect};
