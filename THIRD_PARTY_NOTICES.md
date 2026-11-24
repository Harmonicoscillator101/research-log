# Third-Party Notices

[English](THIRD_PARTY_NOTICES.md) | [简体中文](THIRD_PARTY_NOTICES.zh-CN.md)

ResearchLog itself is released under the [MIT](LICENSE) license. Release packages or runtime environments may include the following third-party components, each governed by its own license.

## Python runtime (optional, bundled with Releases)

- Component: Python 3.12 (including the standard library)
- License: Python Software Foundation License Version 2 (PSF-2.0)
- Source: https://www.python.org/
- Note: if `runtime/python/` is included in a release, keep its `LICENSE.txt` and this file.

## Tcl/Tk (provided with the Python runtime)

- Component: Tcl/Tk 8.6 (used for file/folder pickers)
- License: BSD-style Tcl/Tk License
- Note: the license text ships with the Python runtime at `runtime/python/tcl/tk8.6/license.terms`.

## Microsoft Edge / Chromium (system dependency, not distributed)

- Purpose: rendering runtime for the desktop window; the app opens a local page in the system-installed Edge.
- License: the Chromium project uses a BSD-style license; Edge also includes Microsoft terms.
- Note: this project does **not** copy, modify, or redistribute any Edge/Chromium files; users use the browser already installed on their system.

## Frontend

- Vanilla JavaScript / CSS; no framework, no bundler, no npm runtime dependencies.
- Formula rendering uses the browser's built-in MathML; it does not include KaTeX/MathJax code or fonts.

## Icons and assets

- `app/web/icon.ico`, `app/web/icon.png`, `app/web/icon.svg`: original project assets, released with this project under MIT.
- Screenshots are rendered by the project itself; sample data is fictional.

## Development dependencies (not distributed at runtime)

- pytest (MIT)
- ruff (MIT)

If you add any third-party code, font, or icon to a release, document its source and license here and keep the corresponding license text.
