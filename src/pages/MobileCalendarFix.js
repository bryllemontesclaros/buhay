const fs = require('fs');

const appShellPath = '/Users/bryllemontesclaros/Downloads/Takda/src/pages/AppShell.module.css';
let appShell = fs.readFileSync(appShellPath, 'utf8');

// Replace the massive padding-bottom in .mainCalendar
appShell = appShell.replace(
  /padding-bottom:\s*calc\(var\(--app-mobile-bottom-offset\)\s*\+\s*90px\);/g,
  'padding-bottom: calc(var(--app-mobile-bottom-offset) + 10px); /* Reduced padding to kill white space */'
);

// Also check .main if it has 80px
appShell = appShell.replace(
  /padding-bottom:\s*calc\(var\(--app-mobile-bottom-offset\)\s*\+\s*80px\);/g,
  'padding-bottom: calc(var(--app-mobile-bottom-offset) + 10px); /* Reduced padding to kill white space */'
);

fs.writeFileSync(appShellPath, appShell);
console.log('Updated AppShell.module.css');
