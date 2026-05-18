const fs = require('fs');
const file = '/opt/osiris-scanner/server.js';
let code = fs.readFileSync(file, 'utf8');

// Replace the slow nmap command with a fast one
code = code.replace(
  /nmap -Pn -sV --script vuln --max-retries 1 --host-timeout 45s -oX - \$\{target\}/g,
  'nmap -Pn -sV -F -T4 --script vulners,vuln --max-retries 1 --host-timeout 80s -oX - ${target}'
);

// Increase the execAsync timeout to 90000
code = code.replace(
  /\{ timeout: 60000 \}/g,
  '{ timeout: 90000 }'
);

fs.writeFileSync(file, code);
console.log('Backend patched for speed and timeout.');
