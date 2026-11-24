# Security Policy

[English](SECURITY.md) | [简体中文](SECURITY.zh-CN.md)

## Supported versions

The latest version on the `main` branch is supported. Older versions do not receive security updates.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Email **wzykyle101@foxmail.com** with:

- affected version / operating system;
- reproduction steps or a minimal example;
- impact (data disclosure, arbitrary file read, code execution, etc.);
- how you would like to be credited (optional).

We will acknowledge receipt within 72 hours and credit you after the fix, unless you prefer to stay anonymous.

## Security design

ResearchLog is a **single-machine, local-first** tool. These boundaries help decide whether something is a vulnerability:

- The HTTP engine binds to `127.0.0.1` only; the default port is `47823`;
- No accounts, no cloud, no telemetry, and no data sent upstream;
- MCP communicates over **stdio** between local processes and opens no network port;
- Resources store paths only; before opening, the server verifies the path belongs to the current data file;
- The note reader only opens text files registered in the data file (`.md` / `.markdown` / `.txt` / `.tex` / `.bib`) and enforces a size limit;
- `data/` contains user data and must never be committed to a public repository.

## Known boundaries (not vulnerabilities)

- Any process running as the same local user can read and write `data/`, as with any desktop app;
- Paths explicitly attached by the user are opened with the current user's permissions — that is intended;
- If `config.json` points `dataDir` at a shared folder, access control is the user's responsibility.

## Dependencies

The runtime depends only on the Python standard library and the system browser, so the third-party surface is small. If a release bundles the Python runtime, keep its license (see `THIRD_PARTY_NOTICES.md`).
