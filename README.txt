GEOPLANETICAL LIGHTWEIGHT GRAPHICS + MONTH-END BROWSING
Community code modification, version 1.1.1, Windows x64.

This is a shareable installer, not a Steam Workshop presentation pack.
The built-in mod system does not load graphics or interface code.
No game executable, assets, saves or paid game bundle are included.
Each player needs their own compatible installation.

INSTALL
1. Extract this entire ZIP to a folder.
2. Run Install.cmd.
3. Select the folder containing Geoplanetical.exe.
4. The installer checks the exact supported game bundle and makes a separate
   copy under Documents\Geoplanetical-Lightweight, requiring about 4 GB.
5. Save and close the original game, then use the new desktop shortcut.

The original game is not overwritten. No administrator access or Node.js is
required when the destination is in your own Documents folder. Installation
uses Windows PowerShell and .NET locally, without downloads.
The package integrity record is updated; integrity validation stays enabled.

SWITCHES
Settings > Graphics > Lightweight strategy graphics: On/Off.
Shortcut: Ctrl+Alt+L. Photographic/satellite view also turns it off.
Original graphics settings are retained for switching back.

Settings > Graphics > Browse during calculations: On/Off.
Already available committed panel data is retained when the worker reports
that an update is pending, only for matching panel parameters and session.
A notice labels previous figures during calculation.
Fresh read requests wait for the consistent completed transaction. Financial
quotes are never replaced with stale values. Policy actions, saving and
transaction boundaries keep the game's original safeguards.
Unvisited panels with no committed data still have to wait.

GRAPHICS
Normal Earth view uses simple land/sea shading and a lower-detail
camera-facing spherical cap. Borders, labels, selections and strategic markers
keep their original projection. Specialist overlays retain their original
surface renderer. Moon view retains its original renderer.
Decorative effects are reduced. Idle map drawing is about 10 Hz,
and about 5 Hz during calculations; interaction wakes faster drawing.
Simulation and UI updates are not subjected to that map redraw limit.
This is not a complete 2D map rewrite.

COMPATIBILITY
This release supports one exact inspected 1.0.0 build, identified by the
graphics-bundle SHA-256 in mod.json. Some later updates use the same version
label, so the installer checks the actual bundle and refuses unknown builds.
The separate copy does not automatically inherit Steam/game updates.
An updated game needs a matching mod release.

RESTORE / REMOVE
Use your original shortcut to run the untouched original application,
or turn the graphics and browsing switches off in the modified edition.
The editions use the normal profile; close one before opening the other.
Removing only the separate lightweight folder and shortcut removes this copy.
Do not delete the normal Geoplanetical profile or saves.

LIMITS
Simulation workers, rules, country coverage and datasets are unchanged.
This does not promise a shorter numerical monthly solve or 60 FPS.
Rendering gains vary with zoom, overlays, other applications and hardware.
Browsing keeps committed figures available; it never exposes partial results
or invents data for an unloaded panel.

SHARING
Share this ZIP whole. Do not distribute your copied game or personal profile.
Source is lightweight.js and install.ps1.
Packaging reference:
https://github.com/electron/electron/blob/main/docs/tutorial/asar-integrity.md
