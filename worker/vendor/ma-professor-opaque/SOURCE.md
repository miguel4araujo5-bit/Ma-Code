# MA-Professor OPAQUE runtime provenance

- Upstream: serenity-kit/opaque
- Upstream commit: c89f6f5853b806dff1a681a7fb447316603b18d8
- Protocol core: opaque-ke (resolved exactly in UPSTREAM_CARGO_LOCK)
- wasm-bindgen CLI: wasm-bindgen 0.2.128
- opaque.js SHA-256: b0ea9694032d222c23dd39b24fbd43debf544aae26a989d63ad2285bc71e8ce8
- opaque_bg.wasm SHA-256: e124dc83250f9fd2b9a62377a6967d1b02da20d03150b816305a89fa1fe2f2d4
- License: MIT (see LICENSE)

Estes ficheiros foram recompilados a partir do commit upstream fixado
e só são publicados se os hashes coincidirem exatamente com o runtime
que passou o round-trip OPAQUE no workerd.

Não regenerar ou substituir sem repetir os gates de compatibilidade,
protocolo e regressão.
