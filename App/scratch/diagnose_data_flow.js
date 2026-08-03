const fs = require('fs');
const html = fs.readFileSync('C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/generics_monthly.html', 'utf8');
const lines = html.split('\n');

console.log('=== Total lines:', lines.length, '===\n');

// 1. Find ALL localStorage accesses
console.log('=== ALL localStorage ACCESS ===');
lines.forEach((line, i) => {
  if (line.includes('localStorage.')) {
    console.log(`Line ${i + 1}: ${line.trim().substring(0, 120)}`);
  }
});

console.log('\n=== ALL rawData ASSIGNMENTS (excluding function param and getEmptyRawData) ===');
lines.forEach((line, i) => {
  const trimmed = line.trim();
  if (/rawData\s*=/.test(trimmed) && !trimmed.includes('getEmptyRawData') && !trimmed.includes('function') && !trimmed.includes('//')) {
    console.log(`Line ${i + 1}: ${trimmed.substring(0, 150)}`);
  }
});

console.log('\n=== SCRIPT TAG LOCATIONS ===');
lines.forEach((line, i) => {
  if (line.includes('<script')) {
    console.log(`Script start: Line ${i + 1}`);
  }
  if (line.includes('</script>')) {
    console.log(`Script end: Line ${i + 1}`);
  }
});

console.log('\n=== defaultRawData references ===');
lines.forEach((line, i) => {
  if (line.includes('defaultRawData')) {
    console.log(`Line ${i + 1}: ${line.trim().substring(0, 120)}`);
  }
});

console.log('\n=== savedData / cached data references ===');
lines.forEach((line, i) => {
  if (line.includes('savedData') || line.includes('cachedData') || line.includes('saved_data') || line.includes('JSON.parse(localStorage')) {
    console.log(`Line ${i + 1}: ${line.trim().substring(0, 120)}`);
  }
});
