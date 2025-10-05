#!/bin/bash

FILE="app/(app)/incidencias/[id]/chat-proveedor/page.tsx"

# Fix all instances of "!autorId" to "!perfil"
sed -i '' 's/!perfil\.persona_id/!perfil/g' "$FILE"

# Fix instances where we check if autorId exists alone
sed -i '' 's/ || !perfil\.persona_id)/ || !perfil)/g' "$FILE"
sed -i '' 's/if (!perfil\.persona_id)/if (!perfil)/g' "$FILE"

# Remove "perfil?" and use just "perfil" where we already have null checks
sed -i '' 's/perfil?\.rol/perfil.rol/g' "$FILE"

echo "Fixed all error references"
