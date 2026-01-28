# Local HTTP middleware

A local HTTP Node.JS service that acts as a download and upload manager, and a proxy, allowing browser-triggered downloads/uploads to be handled with full control over upload streaming, file storage, and request scheduling.

> This project was built as a personal tool to bridge the gap between browser convenience and local filesystem control for downloads in a **structured layout**.
> It began as a small experiment to offload browser downloads to a local serer and gradually evolved into a general-purpose proxy and download manager.
> It has been iteratively improved over time and is actively used as part of a personal workflow.

> **Note**: It is not meant to be a production-facing server.

---

## Overview

Modern browsers are convenient for initiating downloads, but limiting when it comes to automation, streaming control, and custom handling of files.

This service runs locally and exposes a small HTTP API that allows:
- Sending download requests from the browser (e.g. via userscripts)
- Uploading binary data directly to the local filesystem in a **structured layout**
- Proxying remote requests through the server
- Managing downloads and proxies via queues and per-domain throttling

It is designed primarily for **personal workflows**, not as a multi-user or a production-facing service.

---

## Features

- **Download Manager**
  - Trigger downloads via HTTP requests
  - Stream files directly to disk without buffering entire payloads
  - Optional re-download prevention during a session

- **Proxy Mode**
  - Acts as a basic HTTP/HTTPS proxy
  - Per-domain request scheduling and concurrency limits
  - Automatic retry with timeout handling
  - Jittered backoff to reduce server load
  - Useful for downloads requiring browser-originated headers or cookies

- **Browser Integration**
  - Intended to be used with lightweight browser userscripts
  - Uses custom headers to keep the protocol simple and flexible

- **Filesystem Awareness**
  - Automatic directory resolution based on URLs
  - Existence checks before downloads
  - Persistent tracking of downloaded files

---

## Dependencies

- `mime-types`
- `file-type`
- `http`
- `tldts`
- `stream`
- `fs`
- `path`

> On linux, you can run `$ xargs -a dependencies.txt npm install`.

---

## Usage

1. Start the server:
```bash
$ node server.js
```
2. Choose a port and session options when prompted.
3. Send HTTP POST requests from a browser userscript or external tool with the appropriate intent and headers.

This project assumes a trusted local environment.

---

## Limitations

* No authentication or security (intended for trusted localhost use only)
* No resume support for interrupted downloads
* Minimal error recovery
* Not designed for concurrent multi-user access

