const fs = require('fs');

['generics_monthly.html', 'generics_annual.html'].forEach(f => {
  const html = fs.readFileSync('C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/' + f, 'utf8');
  const links = html.match(/href=["'][^"']*["']/gi) || [];
  console.log(f + ' href links:', links.filter(l => l.includes('.html')));
  const windowLocs = html.match(/location\.href\s*=\s*["'][^"']*["']/gi) || [];
  console.log(f + ' window.location links:', windowLocs);
});
