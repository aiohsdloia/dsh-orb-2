import { pathToFileURL } from 'node:url';

const pkg = 'C:/Users/10840/Documents/OpenLab/projects/dsh-orb-2/butler/data/dsh-0.2.2-rc.4/home/profiles/headless/node_modules/@trycua/cua-driver/dist/index.js';
const mod = await import(pathToFileURL(pkg).href);
const { CuaDriver } = mod;

const d = CuaDriver.create(undefined);
const signal = new AbortController().signal;
try {
  const res = await d.callTool('get_window_state', JSON.stringify({
    pid: 40092,
    window_id: 3474382,
    include_accessibility_tree: true,
    include_screenshot: false,
    max_elements: 300,
  }), { signal });
  console.log('isError:', res.isError, 'errorCode:', res.errorCode);
  console.log('text:', res.text);
  console.log('raw:', res.rawJson.slice(0, 2000));
} finally {
  try { await d.shutdown(); } catch (e) { console.error('shutdown err', String(e)); }
  try { d.uniffiDestroy(); } catch {}
}
