const fs = require('fs');
const path = require('path');

function checkFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  
  let foundReturn = false;
  let returnLine = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for top-level early returns (very naive heuristic but good enough for typical React)
    if (line.match(/^\s*if\s*\([^)]+\)\s*return\s+/)) {
      foundReturn = true;
      returnLine = i + 1;
    }
    else if (line.match(/^\s*if\s*\([^)]+\)\s*\{\s*return\s+/)) {
      foundReturn = true;
      returnLine = i + 1;
    }
    
    // Check for hooks
    if (foundReturn && line.match(/^\s*(const \[[^\]]+\] = useState|const [a-zA-Z0-9_]+ = useRef|useEffect|useMemo|useCallback)\b/)) {
      console.log(`File: ${filepath}`);
      console.log(`  Return at line ${returnLine}`);
      console.log(`  Hook at line ${i + 1}: ${line.trim()}`);
    }
  }
}

const dir = 'src/views';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
for (const val of files) {
  checkFile(path.join(dir, val));
}
