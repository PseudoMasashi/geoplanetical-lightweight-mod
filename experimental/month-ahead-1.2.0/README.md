# Experimental month-end preparation candidate

This folder preserves the source-only Geoplanetical Month Preparation 1.2.0 candidate for review and follow-up testing. It is **not a playable release**. The bundled installer deliberately refuses installation while correctness and performance acceptance remain unresolved.

## Current evidence

- Original Low-speed native baseline: four month-end waits of 62.1, 53.9, 55.4 and 56.9 seconds.
- Candidate native run: 31.2, 18.8, 81.7 and 54.3 seconds. The first two prepared results were used; the third exact-prefix witness refused promotion. The final saved state differed from the original reference.
- The user reports changing research in one run, so this four-month comparison does not establish identical choices. The mismatch is unresolved, not proof that the calculation rules changed.
- Separate controlled unchanged-input runs passed exact saved-state comparisons for three consecutive closes and for a seeded one-month cancellation/restart. Full native year-end acceptance is still required.
- Expected experience is some waiting: preparation can be invalidated by player actions, memory fallback, or work not completed before month-end. Zero waiting is not guaranteed.

## Compatibility and use

This candidate is for the inspected Windows x64 game build only and is incompatible with Mod Studio / Steam Workshop packs. It requires a separate-copy installer in a future approved release. Do not bypass its installer gate or install this candidate as a playable update.

The ZIP includes mod source and scripts only. It excludes game binaries, artwork, saves and personal settings. Each player must supply their own game installation.

## Required before a usable release

Repeat the native month/year comparison with a recorded identical command sequence, diagnose the fresh mid-month recapture path, and demonstrate shorter total elapsed calendar time while all saved world sections and random state match. Then enable installation and publish a versioned release.

See `Geoplanetical-Month-Preparation-1.2.0-experimental.zip` and its included `VALIDATION.txt` for the fuller handoff.
