const fs = require('fs');

const supabaseInitSnippet = `
  const SUPABASE_URL = "https://hhmwlzaeipyrowwjlbbj.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhobXdsemFlaXB5cm93d2psYmJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDM5NjYsImV4cCI6MjA5OTE3OTk2Nn0.vv1Zw3oFDilKSxh7FEocWi8Y2pzu7uX1rf_L0Jhf1m4";

  if (window.supabase && !window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[Generics Supabase] Client initialisé dans iFrame');
  }
`;

['generics_monthly.html', 'generics_annual.html'].forEach(filename => {
  const filePath = 'C:/Users/victo/OneDrive/Desktop/Fichiers_Antigravity/Procédure expirés/App/' + filename;
  let html = fs.readFileSync(filePath, 'utf8');

  // Injecter l'initialisation de supabaseClient juste sous <script src="supabase.js"></script>
  if (!html.includes('window.supabase.createClient')) {
    html = html.replace(
      '<script src="supabase.js"></script>',
      `<script src="supabase.js"></script>\n<script>${supabaseInitSnippet}</script>`
    );
    fs.writeFileSync(filePath, html);
    console.log(`Injected Supabase Client initialization into ${filename}`);
  }
});
