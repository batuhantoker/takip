const fs = require('fs');
const file = process.argv[2];
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/pick 91f425c/g, 'edit 91f425c')
                 .replace(/pick d54eaec/g, 'edit d54eaec')
                 .replace(/pick 481fcb1/g, 'edit 481fcb1')
                 .replace(/pick 3041615/g, 'edit 3041615');
fs.writeFileSync(file, content);
