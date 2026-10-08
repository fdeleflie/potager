# Extract the block
sed -n '2427,2465p' src/views/Orchard.tsx > /tmp/planned_trees.tsx
# Delete it from original
sed -i '2427,2465d' src/views/Orchard.tsx
# Insert it after 1657
sed -i '1657r /tmp/planned_trees.tsx' src/views/Orchard.tsx
