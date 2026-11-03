const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const file of ['generics-molecule-data.js', 'generics-name-review.js', 'sw.js']) {
    new vm.Script(fs.readFileSync(path.join(root, 'App', file), 'utf8'), { filename: file });
    console.log(`Syntax OK: ${file}`);
}
for (const file of ['generics_annual.html', 'generics_monthly.html', 'generics_molecules.html', 'generics_name_review.html']) {
    const html = fs.readFileSync(path.join(root, 'App', file), 'utf8');
    for (const script of html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || []) {
        if (/^<script\b[^>]*\bsrc\s*=/i.test(script)) continue;
        new vm.Script(script.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, ''), { filename: file });
    }
    console.log(`Inline syntax OK: ${file}`);
}
const html = fs.readFileSync(path.join(root, 'App/generics_name_review.html'), 'utf8');
for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (!fs.existsSync(path.join(root, 'App', match[1]))) throw new Error(`Missing asset: ${match[1]}`);
}
console.log('New page links and assets OK');
