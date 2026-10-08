# 1. Delete lines 1658 to 1696 (the corrupted block inserted earlier)
sed -i '1658,1696d' src/views/Orchard.tsx

# 2. Fix the corrupted end around 2426 (which was shifted up by 39 lines after deletion, so let's use search)
