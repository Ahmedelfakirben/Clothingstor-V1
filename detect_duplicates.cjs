const fs = require('fs');

const content = fs.readFileSync('src/contexts/LanguageContext.tsx', 'utf8');

// Extract the translations object logic roughly
// We assume structure is: const translations = { es: { ... }, fr: { ... } }

// Helper to find duplicates in a text block
function findDuplicates(text, lang) {
    const lines = text.split('\n');
    const keys = new Set();
    const duplicates = [];

    lines.forEach((line, index) => {
        const match = line.match(/^\s*['"](.+?)['"]:/);
        if (match) {
            const key = match[1];
            if (keys.has(key)) {
                duplicates.push({ key, line: index + 1, content: line.trim() });
            } else {
                keys.add(key);
            }
        }
    });

    return duplicates;
}

// Quick split (naive but likely sufficient for this file structure)
const esStart = content.indexOf('es: {');
const frStart = content.indexOf('fr: {');
const frEnd = content.lastIndexOf('}'); // Assuming file ends with closing braces

const esBlock = content.substring(esStart, frStart);
const frBlock = content.substring(frStart, frEnd);

console.log('--- Duplicados en ES ---');
const esDups = findDuplicates(esBlock, 'es');
esDups.forEach(d => console.log(`Line (rel): ${d.line} - Key: ${d.key}`));

console.log('\n--- Duplicados en FR ---');
const frDups = findDuplicates(frBlock, 'fr');
frDups.forEach(d => console.log(`Line (rel): ${d.line} - Key: ${d.key}`));
