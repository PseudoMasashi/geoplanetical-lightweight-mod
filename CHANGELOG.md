# Changelog

## 1.2.0 (development preview)

- Reduce idle map updates during calculations to about 1 Hz, with interaction/capture/original-mode bypasses and a separate switch.
- Add bounded, session-scoped timing observations and synchronous map CPU measurements in Graphics settings.
- Add a read-only local ASAR inspector for economic and month-end source candidates. No formulas or causal contributions are inferred from field names.
- Keep all existing exact-build and baseline-patch hash verification, then verify the separate month-end module before composing the installed bundle.
- Cover map pacing, session changes, worker failure, bounded history, source discovery and malformed archive rejection. Windows installation and actual game month-end performance still need validation.

## 1.1.1

- Preserve source bytes in Windows Git checkouts so the adapter continues to match the installer manifest with Git's usual Windows settings.
- Include the MIT license, third-party notice, standalone tests, and repeatable release builder in the public repository.
- Graphics and browsing behavior are unchanged from 1.1.0. The normal game remains untouched by installation.

## 1.1.0

- Experimental lightweight Earth graphics and browsing of previously committed panel figures during calculations.
- Exact-build installer that creates a separate local copy.
