# Vendored packages

Third-party code kept in the repo, unchanged, and wired in through `overrides` in `package.json`.

| Folder | What | Why |
| --- | --- | --- |
| `dottie/` | dottie 2.0.7 (MIT), `dottie.js` and its `LICENSE` as published | `@sequelize/core` 7 requires it (to set nested values in JSON columns). npm marks every published dottie version "no longer supported", so installing it from the registry prints a deprecation warning. Version 2.0.7 differs from 2.0.6 only by a wider prototype-pollution guard. |

When Sequelize is upgraded, check whether it still requires dottie (`npm ls dottie`); remove the folder and the
override once it does not.
