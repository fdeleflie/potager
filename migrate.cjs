const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const viewsDir = path.join(srcDir, 'views');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const allFiles = walk(srcDir);

allFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // 1. imports
    if (content.includes("useLiveQuery")) {
        content = content.replace(/import \{ useLiveQuery \} from 'dexie-react-hooks';\n?/g, '');
        if (!content.includes('useFirebaseData')) {
            content = "import { useFirebaseData, fb } from '../hooks/useFirebaseData';\n" + content;
            // Fix import path if it's not in views
            if (file.includes('src/App.tsx')) {
                content = content.replace("'../hooks/useFirebaseData'", "'./hooks/useFirebaseData'");
            } else if (file.includes('src/components/')) {
                // not using uselivequery likely
            }
        }
    }

    // Replace `useLiveQuery(() => db.X.filter(fn).toArray())`
    // with `useFirebaseData<Type>('X').filter(fn)`
    // Note: useFirebaseData returns the array directly! Just doing .filter() on it is synchronous array filtering.
    let rx = /useLiveQuery\(\(\)\s*=>\s*db\.([a-zA-Z]+)\.filter\(([^)]+)\)\.toArray\(\)(?:,\s*\[([^\]]*)\])?\)/g;
    content = content.replace(rx, (match, table, filterBody, deps) => {
        return `useFirebaseData<any>('${table}').filter(${filterBody})`;
    });

    // Replace `useLiveQuery(() => db.X.toArray())`
    let rx2 = /useLiveQuery\(\(\)\s*=>\s*db\.([a-zA-Z]+)\.toArray\(\)(?:,\s*\[([^\]]*)\])?\)/g;
    content = content.replace(rx2, (match, table, deps) => {
        return `useFirebaseData<any>('${table}')`;
    });

    // Replace `useLiveQuery(() => db.config.where(...)...toArray())`
    let rx3 = /useLiveQuery\(\(\)\s*=>\s*db\.([a-zA-Z]+)\.where\('([^']+)'\)\.equals\('([^']+)'\)\.toArray\(\)(?:,\s*\[([^\]]*)\])?\)/g;
    content = content.replace(rx3, (match, table, field, value, deps) => {
        return `useFirebaseData<any>('${table}').filter(item => item.${field} === '${value}')`;
    });

    // Replace single item `db.X.get(id)`
    let rxGet = /useLiveQuery\(\(\)\s*=>\s*(?:[a-zA-Z0-9_]+\s*\?\s*)?db\.([a-zA-Z]+)\.get\(([a-zA-Z0-9_]+)\)(?:\s*:\s*undefined)?\s*,\s*\[(.*?)\]\)/g;
    content = content.replace(rxGet, (match, table, idVar, deps) => {
        return `useFirebaseData<any>('${table}').find(item => item.id === ${idVar})`;
    });

    // Handle db.tasks.where ...
    let rxSort = /useLiveQuery\(\(\)\s*=>\s*db\.([a-zA-Z]+)\.where\('([^']+)'\)\.equals\('([^']+)'\)\.sortBy\('([^']+)'\)\)/g;
    content = content.replace(rxSort, (match, table, field, val, sortField) => {
        return `useFirebaseData<any>('${table}').filter(x => x.${field} === '${val}').sort((a,b) => String(a.${sortField}).localeCompare(String(b.${sortField})))`;
    });

    // Ensure db is imported if used (we will replace db with fb for writes too)
    if (content.includes('db.') && !content.includes('db.transaction') && !content.includes('dexie')) {
        content = content.replace(/db\.([a-zA-Z]+)\.update\(/g, "fb.update('$1', ");
        content = content.replace(/db\.([a-zA-Z]+)\.delete\(/g, "fb.delete('$1', ");
        content = content.replace(/db\.([a-zA-Z]+)\.add\(/g, "fb.add('$1', ");
        content = content.replace(/db\.([a-zA-Z]+)\.put\(/g, "fb.put('$1', ");
    }

    if (original !== content) {
        fs.writeFileSync(file, content, 'utf8');
        console.log("Updated", file);
    }
});