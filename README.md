# Geoplanetical Lightweight Graphics + Month-end Browsing

**1.2.0 development preview:** adds month-end map focus, sampled calculation timing, and a local economy-source inspector. The JavaScript contracts have automated coverage; this update still needs a Windows install and a real month-end run on the supported game. The published 1.1.1 release remains available below.

An **experimental, unofficial Windows x64 mod** for players who want simpler graphics while keeping the game's strategy and simulation rules.

**Compatibility is narrow:** the mod supports one inspected older game build labelled `1.0.0`. The installer checks the actual renderer SHA-256, because different updates can have the same version label. It refuses unknown or already modified bundles. **Do not assume a current game update is compatible.**

## Download and install

Get the installer ZIP from the [latest release](https://github.com/PseudoMasashi/geoplanetical-lightweight-mod/releases/latest). No account is needed to download it.

1. Extract the entire ZIP to a folder.
2. Read `README.txt`, then run `Install.cmd`.
3. Select your own installation folder containing `Geoplanetical.exe`.
4. The installer checks compatibility and creates a separate copy in `Documents\Geoplanetical-Lightweight`. Allow about **4 GB** of free space.
5. Save and close the original game before opening the new desktop shortcut.

The original installation is preserved. The two editions use the **same normal game profile and saves**, so close one before opening the other. This is an external installer, not a Steam Workshop presentation pack. No administrator access, Node.js, or downloads are needed by the installer when using your own Documents folder.

If you download GitHub's **Source code (zip)** instead, it also contains the installer at the repository root. Extract it and follow the same steps.

## What it changes

- Simple unlit land/sea shading and a coarser camera-facing **spherical cap** in normal Earth view. It is not a flat-map rewrite.
- Reduced decorative effects, with borders, labels, selections, and strategic markers retained.
- Idle map redraws of about 10 Hz, falling to about 5 Hz during calculations. Interaction wakes faster drawing. Simulation and interface updates are not subject to this map redraw limit.
- In the 1.2.0 preview, **Month-end map focus** reduces the idle calculation redraw rate further to about 1 Hz. Moving/using the map wakes faster drawing. Capture and original-graphics modes bypass this extra limit.
- The preview shows the last renderer-observed calculation duration and synchronous map CPU time in Graphics settings. It retains at most 20 observations in memory and clears them when the session identity/epoch changes.
- Specialist overlays and Moon view keep the original surface renderer.
- Previously opened panels can retain their last committed figures during calculations. A notice identifies those figures as previous data. Fresh queries wait for the completed transaction; unvisited panels can still have to wait.

Settings > Graphics contains independent switches:

- **Lightweight strategy graphics**, also toggled with `Ctrl+Alt+L`.
- **Browse during calculations**.
- **Month-end map focus** (1.2.0 preview).

You can turn either feature off or launch the untouched original game. Photographic/satellite view also turns lightweight graphics off.

## What has been verified

Local checks covered startup, shader errors, map picking, graphics restoration, specialist-overlay fallback, archive integrity, and the browsing contracts. The tests in this repository exercise parameter/session isolation, fresh-query deferral, mutable input capture, failures, and graphics fallback behavior without including game files.

The installer modifies the copied renderer and updates the copied executable's ASAR integrity record. Integrity validation stays enabled. It verifies the original renderer, the unchanged 1.1.1 adapter, its exact known patched bundle, and the new month-end module separately before combining them. The installed manifest records the final combined hash. Simulation workers, numerical rules, country coverage, and datasets are unchanged.

**No verified reduction in the numerical month-end solve time and no guaranteed 60 FPS.** This has not been validated across a complete campaign or all game versions. Rendering gains vary by view, hardware, and other running applications. The separate installation does not automatically receive game updates.

The fake-clock regression scenario measures **50 vs 10 idle map draws over 10 seconds** with focus off/on. This is a map-pacing result, not an end-to-end game benchmark. The timing recorder samples the work flag in the application loop: its intervals include waiting/scheduling time, cannot distinguish worker phases or saving, and include sampling uncertainty. Map CPU time excludes GPU execution and worker CPU time. `window.__geoLite.monthEnd.report()` returns these measurements and their limits; it does not query the simulation or alter its state.

## Find the actual economic formulas

This repository contains no economic simulation source. The existing four integration patches touch frame scheduling, globe setup, and read-only panel queries. They cannot establish what produces GDP growth, inflation, or unemployment, or how much randomness contributes.

The source inspector reads the JavaScript inside **your own local** `app.asar`, ranks candidate files, and records bounded source excerpts around economic and month-end terms. It never executes game code, follows archive links, or reads saves/profiles. It works independently of the mod's supported renderer hash because it performs no patching.

With Node.js 20 or later, run from the extracted source folder:

```powershell
node scripts/inspect-economy.cjs 'C:\path\to\your\game'
```

It creates `diagnostics/economy-inspection.json`. Send that report privately for the next tracing pass; it contains game source excerpts and should stay out of public issues/commits. Existing reports are never overwritten; supply a second argument for a new report filename. Size limits, omitted files and snippet counts are included so incomplete coverage is visible. Search matches are candidates, not verified formulas or numerical contributions.

The next pass must establish each metric's units/period, exact expression, input sources, policy delays, random draws, smoothing/caps, and execution order from those workers. Only then can a contribution explanation reconcile to the real result or a numerical optimization be checked against the same starting state and random stream.

## Source and development

- `lightweight.js`: graphics and browsing adapter.
- `month-end.js`: optional map pacing and sampled timing; does not replace simulation methods.
- `scripts/inspect-economy.cjs`: read-only local source inspection; requires Node.js 20+.
- `mod.json`: exact supported hashes, four integration patches and the pinned month-end module hash.
- `install.ps1` / `Install.cmd`: local, separate-copy installer.
- `tests/`: tests that do not require the game.
- `scripts/build-release.ps1`: builds the distributable ZIP from an explicit file list, using only PowerShell/.NET.
- `.gitattributes`: preserves exact source bytes in Git checkouts, including Windows.

With Node.js 20 or later, run:

```sh
npm test
```

On Windows, build the installer ZIP with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-release.ps1
```

The build writes the ZIP and its SHA-256 in `downloads/`. To check your local game without copying it, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1 -GameFolder 'C:\path\to\your\game' -CheckOnly
```

For another game build, inspect its integration points and verify behavior first. Do not bypass the hash check or claim compatibility solely because the version label matches. If the mod source or patches change, update the corresponding hashes and tests before releasing.

## Reporting problems

Open a GitHub issue with the game build, whether each switch was on, the map view/overlay, and steps to reproduce. Do not upload saves, personal profiles, paid game files, or private logs. This is a community experiment; it is not endorsed by the game developer.

## License and game ownership

Original mod code and documentation are released under the [MIT License](LICENSE). See [NOTICE](NOTICE) for the scope of that license and third-party compatibility snippets. Geoplanetical and its assets remain the property of their owners. Each player must supply their own compatible game installation.

Packaging reference: [Electron ASAR integrity](https://github.com/electron/electron/blob/main/docs/tutorial/asar-integrity.md).
