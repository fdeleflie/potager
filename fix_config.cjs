const fs = require('fs');

let content = fs.readFileSync('src/views/Config.tsx', 'utf8');

content = content.replace(/const catalogItem = activeTab === 'variety' && newParentId \? PLANT_CATALOG\.find\(p => p\.name\.toLowerCase\(\) === config\.find\(v => v\.id === newParentId\)\?\.value\?\.trim\(\)\.toLowerCase\(\)\) : null;/g, 'const catalogItem = null;');
content = content.replace(/\(activeTab !== 'variety' \|\| c\.parentId === newParentId\) &&/g, '');
content = content.replace(/\(activeTab !== 'variety' \|\| i\.parentId === newParentId\) &&/g, '');
content = content.replace(/parentId: activeTab === 'variety' \? newParentId : \(activeTab === 'variety_option' \? selectedAttrType : undefined\),/g, "parentId: activeTab === 'variety_option' ? selectedAttrType : undefined,");
content = content.replace(/attributes: type === 'vegetable' \? \{[\s\S]*?\} : \{\}/g, 'attributes: {}');
content = content.replace(/if \(activeTab === 'vegetable'\) \{[\s\S]*?\}\s*\} else \{/g, '');
content = content.replace(/const suggestedVegetables = activeTab === 'vegetable'[\s\S]*?: \[\];/g, 'const suggestedVegetables: any[] = [];');
content = content.replace(/const suggestedVarieties = activeTab === 'variety' && newParentId && catalogItem[\s\S]*?: \[\];/g, 'const suggestedVarieties: any[] = [];');
content = content.replace(/if \(activeTab === 'variety' && newParentId\) \{[\s\S]*?\}/g, '');
content = content.replace(/\{activeTab === 'variety' && \([\s\S]*?\)\}/g, '');
content = content.replace(/list=\{activeTab === 'vegetable' \|\| activeTab === 'variety' \? datalistId : undefined\}/g, '');
content = content.replace(/\{\(activeTab === 'vegetable' \|\| activeTab === 'variety'\) && \([\s\S]*?\)\}/g, '');
content = content.replace(/\{\(activeTab === 'vegetable' && suggestedVegetables\.length > 0\) && \([\s\S]*?\)\}/g, '');
content = content.replace(/\{\(activeTab === 'variety' && suggestedVarieties\.length > 0\) && \([\s\S]*?\)\}/g, '');
content = content.replace(/\{activeTab === 'vegetable' && \([\s\S]*?\)\}/g, '');
content = content.replace(/\{activeTab === 'vegetable' && editingVegetableId === item\.id && \([\s\S]*?\)\}/g, '');
content = content.replace(/\{activeTab === 'variety' && editingVarietyId === item\.id && \([\s\S]*?\)\}/g, '');

// Also remove the remaining activeTab === 'vegetable' and activeTab === 'variety'
content = content.replace(/activeTab === 'vegetable'/g, 'false');
content = content.replace(/activeTab === 'variety'/g, 'false');

fs.writeFileSync('src/views/Config.tsx', content);
