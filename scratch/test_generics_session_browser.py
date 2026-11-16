"""Headless browser smoke test. All authentication and purchases are synthetic.

Uses installed Chrome, the actual HTML/DOM and local scripts; replaces CDN
libraries and Supabase with small stubs. Does not contact the live database.
"""
import http.server
import pathlib
import re
import subprocess
import tempfile
import threading

ROOT = pathlib.Path(__file__).resolve().parents[1] / 'App'
BOOT = r"""
window.smokeErrors = [];
window.addEventListener('error', e => smokeErrors.push(e.message));
window.addEventListener('unhandledrejection', e => smokeErrors.push(String(e.reason)));
window.Chart = class { constructor(ctx, config) { this.data = config.data; this.options = config.options; } destroy() {} update() {} };
window.smokeUser = 'A'; window.smokeCallbacks = []; window.smokeSaveFails = true;
window.supabase = { createClient() { return {
 auth: { getUser: async () => ({data:{user:{id:smokeUser,email:'synthetic@example.test'}}}),
 onAuthStateChange: cb => smokeCallbacks.push(cb), signOut: async () => {} },
 from(table) { return {
 select() { return this; }, eq() { return this; }, order() { return this; },
 maybeSingle: async () => ({data: table === 'profiles' ? {pharmacy_id:'A'} : {name:'Synthetic pharmacy A'}}),
 limit: async () => ({data:[{data:{manufacturers:[],totals:{2022:0,2023:0,2024:0,2025:0,2026:0},years:[2022,2023,2024,2025,2026],monthly_2026:{}},updated_at:'synthetic'}]}),
 upsert: async () => ({error:smokeSaveFails ? {message:'Synthetic save failure'} : null})
 }; }
}; } };
"""
CHECK = r"""
window.addEventListener('load', async () => {
 const dashboard = location.pathname.includes('monthly') || location.pathname.includes('annual');
 const ready = () => dashboard ? !document.documentElement.hasAttribute('data-generics-locked') : !document.getElementById('workspace').hidden;
 for (let i=0; i<100 && !ready(); i++) await new Promise(r=>setTimeout(r,10));
 if (!ready()) smokeErrors.push('Page did not finish loading');
 if (dashboard && ready()) {
  rawData.manufacturers.push({name:'UNSAVED SYNTHETIC IMPORT'});
  await window.syncGenericsDataToCloud(rawData);
  const warning=document.getElementById('generics-save-warning');
  if (!warning || warning.hidden || !rawData.manufacturers.length) smokeErrors.push('Failed import was not preserved with retry notice');
  smokeSaveFails=false;
  warning?.querySelector('button').click();
  for(let i=0;i<20 && !warning?.hidden;i++) await new Promise(r=>setTimeout(r,10));
  if (!warning?.hidden) smokeErrors.push('Retry save did not succeed');
 }
 smokeUser = 'B'; smokeCallbacks.forEach(cb => cb('SIGNED_IN',{user:{id:'B'}}));
 await Promise.resolve();
 if (dashboard) {
  if (!document.documentElement.hasAttribute('data-generics-locked')) smokeErrors.push('Dashboard not locked');
  if (rawData.manufacturers.length) smokeErrors.push('Purchases not cleared');
  if (await window.syncGenericsDataToCloud(rawData) !== false) smokeErrors.push('Save not rejected');
  const notice = document.getElementById('generics-session-notice');
  if (!notice || getComputedStyle(notice).display === 'none') smokeErrors.push('Session notice not visible');
  const header = document.querySelector('.generics-account-header');
  if (getComputedStyle(header).display !== 'none') smokeErrors.push('Old dashboard still visible');
 } else if (!document.getElementById('workspace').hidden) smokeErrors.push('Workspace still visible');
 const result=document.createElement('pre');result.id='smoke-result';
 result.textContent=smokeErrors.length ? 'FAIL: '+JSON.stringify(smokeErrors) : 'PASS';
 document.body.append(result);
});
"""


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        target = (ROOT / self.path.split('?')[0].lstrip('/')).resolve()
        if not target.is_relative_to(ROOT) or not target.is_file():
            self.send_error(404)
            return
        data = target.read_bytes()
        mime = 'application/javascript' if target.suffix == '.js' else 'text/css'
        if target.name == 'supabase.js':
            data = b'// Supabase replaced by synthetic bootstrap in test HTML.'
        if target.suffix == '.html':
            mime = 'text/html; charset=utf-8'
            html = data.decode('utf-8')
            html = re.sub(r'<script[^>]+src="https?://[^>]+></script>', '', html)
            html = re.sub(r'<link[^>]+href="https?://[^>]+>', '', html)
            html = html.replace('<head>', '<head><script>' + BOOT + '</script>')
            html = html.replace('</body>', '<script>' + CHECK + '</script></body>')
            data = html.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.end_headers()
        self.wfile.write(data)


if __name__ == '__main__':
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    chrome = pathlib.Path('C:/Program Files/Google/Chrome/Application/chrome.exe')
    for name in ['monthly', 'annual', 'molecules', 'name_review']:
        with tempfile.TemporaryDirectory(prefix='generics-session-smoke-', ignore_cleanup_errors=True) as profile:
            url = f'http://127.0.0.1:{server.server_port}/generics_{name}.html'
            result = subprocess.run([str(chrome), '--headless', '--no-first-run', '--disable-gpu',
                                     '--disable-background-networking', f'--user-data-dir={profile}',
                                     '--virtual-time-budget=5000', '--dump-dom', url],
                                    capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=30)
            match = re.search(r'<pre id="smoke-result">(.*?)</pre>', result.stdout)
            outcome = match.group(1) if match else 'FAIL: browser did not return test results'
            print(f'{name}: {outcome}', flush=True)
            if outcome != 'PASS':
                print(result.stderr[-1800:])
                raise SystemExit(1)
    server.shutdown()
