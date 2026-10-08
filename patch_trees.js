const fs = require('fs');

let content = fs.readFileSync('src/views/Orchard.tsx', 'utf-8');
content = content.replace(
  "  }, [trees, selectedTerrainId]);\n\n  const structuresInCurrentTerrain",
  "  }, [trees, selectedTerrainId]);\n\n  const placedTrees = useMemo(() => treesInCurrentTerrain.filter((t) => t.status !== 'planned' && t.positionX !== undefined), [treesInCurrentTerrain]);\n\n  const plannedTrees = useMemo(() => treesInCurrentTerrain.filter((t) => t.status === 'planned'), [treesInCurrentTerrain]);\n\n  const structuresInCurrentTerrain"
);

content = content.replace(
  "{treesInCurrentTerrain.map(tree => {",
  "{placedTrees.map(tree => {"
);

fs.writeFileSync('src/views/Orchard.tsx', content);
