# Changelog

[English](CHANGELOG.md) | [简体中文](CHANGELOG.zh-CN.md)

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned

- one-click MCP client configuration;
- MCP Resources / Prompts (weekly review, project summary);
- cross-project paper library.

## [0.1.1] - 2026-11-27

### Fixed

- Project deletion is atomic and available from the project detail header; undo still restores the project.
- Project folders open in a dedicated Explorer window instead of being merged into an existing window;
  the UI also offers an in-app folder browser as a fallback.
- Text and code files open in Notepad for editing instead of being intercepted by a document app.

### Changed

- Windows package should be extracted to a normal Medium-integrity directory; do not run it from a
  workspace that has inherited a Low mandatory integrity label.

## [0.1.0] - 2026-11-24

First open-source release.

### Added

- Project board: planned / active / done columns, drag cards between columns;
- One main goal per project, plus success criteria and target date;
- Milestones: checkboxes, due dates, notes, drag-and-drop ordering, progress bar;
- Project search and status filters;
- Progress log with per-project filtering and copy;
- Weekly view: overdue, today, next 7 days, completed this week, progress this week, stale projects;
- One-click Markdown weekly review;
- Resources: papers, repositories, and notes, multiple per project;
- Native drop window, folder/file pickers, reveal in folder;
- Built-in Markdown reader: headings, lists, task lists, tables, code, quotes;
- Formula rendering: `$...$` / `$$...$$`, TeX→MathML, fully offline;
- CLI: `rlog.cmd`, with `--json` and `--data`;
- MCP stdio server: 12 tools sharing the same Store as GUI and CLI;
- Atomic writes, daily backups (14 days), `rev` versioning;
- File watcher + SSE live refresh;
- Export Markdown / JSON, import JSON;
- Chinese / English UI switch (follows the browser language; UI only, user data is never translated);
- Light / dark themes;
- Zero third-party runtime dependencies.
