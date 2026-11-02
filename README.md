# Geoplanetical Lightweight Graphics + Month-end Browsing

An **experimental, unofficial Windows x64 mod** for players who want simpler graphics while keeping the game's strategy and simulation rules.

**Compatibility is narrow:** v1.1.1 supports one inspected older game build labelled `1.0.0`. The installer checks the actual renderer SHA-256, because different updates can have the same version label. It refuses unknown or already modified bundles. **Do not assume a current game update is compatible.**

## Month-end calculation build: experimental opt-in

An early-access full-month preparation build is available: [download version 1.2.0 experimental](experimental/month-ahead-1.2.0/Geoplanetical-Month-Preparation-1.2.0-experimental.zip). It is **not validated as a full-year equivalent or proven to reduce total elapsed time**. In one four-month native comparison, the exact-prefix check refused a result and the final state differed; player choices may not have matched. Your campaign may diverge, so back up saves first. The build requires Windows x64 and the exact inspected game build, uses extra CPU/RAM, and asks you to confirm the experimental risk during installation. It creates a separate game copy but shares the regular saves/profile. Not a Mod Studio or Steam Workshop pack. Read the included `README.txt` and `VALIDATION.txt`.

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
- Specialist overlays and Moon view keep the original surface renderer.
- Previously opened panels can retain their last committed figures during calculations. A notice identifies those figures as previous data. Fresh queries wait for the completed transaction; unvisited panels can still have to wait.

Settings > Graphics contains two independent switches:

- **Lightweight strategy graphics**, also toggled with `Ctrl+Alt+L`.
- **Browse during calculations**.

You can turn either feature off or launch the untouched original game. Photographic/satellite view also turns lightweight graphics off.

## What has been verified

Local checks covered startup, shader errors, map picking, graphics restoration, specialist-overlay fallback, archive integrity, and the browsing contracts. The tests in this repository exercise parameter/session isolation, fresh-query deferral, mutable input capture, failures, and graphics fallback behavior without including game files.

The installer modifies the copied renderer and updates the copied executable's ASAR integrity record. Integrity validation stays enabled. Simulation workers, numerical rules, country coverage, and datasets are unchanged.

**No verified reduction in the numerical month-end solve time and no guaranteed 60 FPS.** This has not been validated across a complete campaign or all game versions. Rendering gains vary by view, hardware, and other running applications. The separate installation does not automatically receive game updates.

## Source and development

- `lightweight.js`: graphics and browsing adapter.
- `mod.json`: exact supported hashes and four integration patches.
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
