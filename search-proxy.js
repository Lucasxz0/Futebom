const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        searchFiles(fullPath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.mjs')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('proxy') && file !== 'proxy.ts' && file !== 'search-proxy.js') {
        console.log(`Found 'proxy' in: ${fullPath}`);
        // print matching lines
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('proxy')) {
            console.log(`  L${index + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

searchFiles('.');
