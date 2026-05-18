const fs = require('fs');

const file = '/opt/osiris-scanner/server.js';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('/scan/vuln')) {
  const insert = `    if (url.pathname === '/scan/vuln') {
      if (!validateTarget(target)) return json(res, 400, { error: 'Invalid target' });
      const { stdout } = await execAsync(
        \`nmap -Pn -sV --script vuln --max-retries 1 --host-timeout 45s -oX - \${target}\`,
        { timeout: 60000 }
      );
      return json(res, 200, { target, scan_type: 'vuln_scan', ...parseNmapXML(stdout), timestamp: new Date().toISOString() });
    }\n\n`;
    
  code = code.replace("    if (url.pathname === '/scan/headers')", insert + "    if (url.pathname === '/scan/headers')");
  fs.writeFileSync(file, code);
  console.log('Patched server.js successfully.');
} else {
  console.log('server.js is already patched.');
}
