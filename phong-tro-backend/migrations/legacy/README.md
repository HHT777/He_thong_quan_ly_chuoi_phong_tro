# Legacy migrations 001–003

These migrations describe an earlier prototype schema that used integer identifiers and snake_case table names such as `phong_tro`, `nguoi_o`, and `yeu_cau`.

They are retained only for historical reference and are not part of the active migration chain. The active schema is defined by `data2.md`; the verifier intentionally executes migrations `004` through `011` only.

Do not run these files against the current UUID/camel-case schema.
