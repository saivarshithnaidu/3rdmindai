const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../components/workspace/WorkspaceLayout.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('flex items-center') && (line.includes('border-b') || line.includes('justify-between') || line.includes('px-'))) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
