#!/bin/bash

# Fix all autorId references - change to perfil.persona_id
sed -i '' '
# Fix shorthand property syntax issues (replace "autorId," or "autorId" at end of object)
s/autorId,$/autorId: perfil.persona_id,/g;
s/autorId$/autorId: perfil.persona_id/g;
# Fix regular autorId usage
s/\bautorId\b/perfil.persona_id/g;
# Fix tipoUsuario checks
s/{tipoUsuario === /{perfil?.rol === /g;
' app/\(app\)/incidencias/\[id\]/chat-proveedor/page.tsx

echo "Fixed autorId and tipoUsuario references"
