# Scriptorium
 
**Part of the [Petrarca Project](https://github.com/DBA991/Petrarca-Project) — by Delta2Studio**
 
> "Nothing has such power to broaden the mind as the ability to investigate systematically and truly all that comes under thy observation in life."
> — Marcus Aurelius, *Meditations*, III, 11
 
Scriptorium is a desktop application (built with **Electron** and **Vue 3**) for the digitization, encoding, analysis, and publication of philological texts. It covers the full workflow of a digital scholarly edition: from scanning a printed page, through OCR and TEI-XML encoding, to statistical analysis, reading, and export.
 
The app follows a **multi-window, workshop-style architecture**: a central "Home" window acts as a companion and launcher, while each stage of the editorial workflow opens in its own dedicated window (a "child window"), so a philologist can keep several tools open side by side. Every tool is named after a monastic scriptorium role, reflecting the medieval metaphor of the app: a *Copyist* who transcribes, a *Scriptor* who writes the text, a *Librarius* who reads it back, a *Compilator* who assembles documents, an *Exemplator* who prepares the front matter, and so on.
 
---
 
## Table of Contents
 
- [Architecture Overview](#architecture-overview)
- [Home — the Companion Window](#home--the-companion-window)
- [Copyist (Image)](#copyist-image)
- [Scriptor (Coder)](#scriptor-coder)
- [Librarius (Viewer)](#librarius-viewer)
- [Compilator (Assembler)](#compilator-assembler)
- [Exemplator (HeaderBuilder)](#exemplator-headerbuilder)
- [Glossographus (Vocabulary)](#glossographus-vocabulary)
- [Speculum](#speculum)
- [Export](#export)
- [Cross-cutting Systems](#cross-cutting-systems)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
---
 
## Architecture Overview
 
Scriptorium is structured as an Electron application with a clear separation between:
 
- **Main process** (`src/main/`) — window management, the local filesystem workspace, OCR orchestration, TEI/XML parsing (via SAX), persistent storage, clipboard monitoring, and spellchecker configuration.
- **Renderer process** (`src/renderer/src/`) — the Vue 3 application, organized as one top-level component per tool, each mounted on its own route/window (`src/renderer/src/router.js`), plus a set of shared modules used across tools (TEI tag definitions, metrical form processors, editor helpers, notification system).
- **Preload script** (`src/preload/`) — exposes a safe `window.electronAPI` bridge between renderer and main process (IPC).
All tools share a single **project state**: the XML document being edited in Scriptor, the images loaded in Copyist, and the generated HTML are persisted centrally (via `electron-store`) so that other windows (Viewer, Vocabulary, Speculum, HeaderBuilder, Export) can always read the "current document" without passing files around manually.
 
A lightweight **Session** system (save / load / reset, available from Home) snapshots this entire state to disk, so a work session can be closed and resumed later.
 
---
 
## Home — the Companion Window
 
Home is the always-open dashboard and entry point of Scriptorium. It is not an editing tool itself, but the control room for the rest of the app. It provides:
 
- **Tool launcher** — a grid of cards, one per tool, each showing its own name and a full description (not just a tooltip) so the purpose of each window is clear before opening it. Clicking a card opens or closes the corresponding child window.
- **Session management** — Save Session, Load Session, and Clear Session buttons that persist or restore the entire working state (documents, images, generated header/vocabulary/HTML) to/from a file.
- **Clipboard companion** — a FIFO history of up to 50 recently copied text entries, shared across all windows. Copying text anywhere in the app makes it reappear here; entries can be reused with one click, individually removed, or cleared entirely.
- **Language switcher** — toggles the UI language between Italian and English at runtime (full i18n support via `vue-i18n`).
- **AI Companion (placeholder)** — a reserved panel in the UI for a future integrated AI assistant, currently marked "Coming soon."
---
 
## Copyist (Image)
 
*"OCR on images, filters, straightening, drawing and annotation. The starting point for digitizing a text from a paper scan."*
 
Copyist is where a physical/scanned source becomes a digital resource, and the first step toward a text in Scriptor. Its features include:
 
- **Image loading and management** — load one or multiple page images into a session, insert blank placeholder pages, remove pages, and set page orientation (portrait/landscape).
- **Image viewer** — zoomable canvas with reset-zoom control, dedicated to inspecting scanned pages closely.
- **Image filters** — a filter panel (including a negative/invert option) applied non-destructively for cleaning up scans before OCR.
- **Straightening tool** — a dedicated panel to correct page tilt by degrees, useful for imperfectly scanned or photographed pages.
- **Drawing/annotation tools** — freehand drawing over the image with adjustable color and thickness, plus an eraser and a "clear all" action, for marking up regions of interest directly on the page.
- **OCR (optical character recognition)** — powered by **Tesseract.js**, bundled with trained language data for English, Italian, French, Spanish, Portuguese, German, Latin, Greek, Russian, Arabic, Japanese, and Chinese (Simplified). Recognized text can be copied or sent directly into Scriptor for encoding.
- **OCR Automation** — a batch mode that runs OCR across a configurable range of pages (e.g. "1; 4-6"), with support for uneven/defective bindings (different tilt correction for odd vs. even pages) and the same filter set applied uniformly across the whole batch. Progress is reported per page, including recognition percentage and explicit handling of blank placeholder pages (skipped, but still reviewable).
- **PDF export** — pages (with filters/annotations) can be exported as a PDF via `pdfkit`.
---
 
## Scriptor (Coder)
 
*"XML-TEI editor with poetic autotagging, schema validation, search/replace and advanced encoding tools."*
 
Scriptor is the encoding heart of Scriptorium: a full-featured XML/TEI source editor built on the **Monaco Editor** (the same engine behind VS Code). It holds the "current document" that most other tools (Viewer, Vocabulary, Speculum, HeaderBuilder, Export) read from and write back to. Its features include:
 
- **XML editing** — syntax highlighting, load XML from disk, format/pretty-print the document (via `xml-formatter`), undo/redo, comment toggling, and code folding (fold/unfold all sections).
- **Schema validation** — validate the current document against a TEI XSD schema; supports loading a custom XSD schema (by file upload or by URL) in addition to the bundled TEI-All schema.
- **Search & Replace** — an in-editor search panel plus a dedicated search-and-replace tool.
- **Go to line** — quick navigation to a specific line number.
- **TEI tag insertion ("TEI Tag" magic box)** — a helper for inserting well-formed TEI elements without hand-typing markup.
- **Unicode character picker** — search and insert Unicode characters either by codepoint (e.g. `1F4A9`) or by browsing categories, paginated for large character sets — useful for diacritics, special symbols, and non-Latin scripts.
- **Poetic autotag** — an automated encoder for structured poetic/prose forms. Text can be pasted or typed, a metrical form selected, and the tool generates valid TEI-XML markup automatically, which can then be inserted straight into the Scriptor editor. Supported forms include:
  - English Sonnet
  - Italian Sonnet
  - *Divina Commedia* (terzina structure)
  - Terza rima
  - Sestina
  - Ottava (rima)
  - Rima sciolta (blank/unrhymed verse)
  - Prose chapter
  - Generic page structure
- **Spellchecker language switching** — per-document spellchecking language can be set (mapped to the OS-level Electron spellchecker), covering Italian, Latin, English, French, Spanish, Portuguese, German, Japanese, Russian, and Arabic (with graceful fallbacks where native support is limited).
- **Clipboard integration** — "Copy all content" and standard copy actions feed into the shared Clipboard Companion on Home.
---
 
## Librarius (Viewer)
 
*"Reads the XML document and turns it into HTML for reading. Supports user notes, text search and navigation."*
 
Librarius is the reading-room counterpart to Scriptor: it transforms the encoded TEI-XML into a clean, navigable HTML reading view. Its features include:
 
- **XML → HTML rendering** — processes the TEI document (via dedicated `teiProcessor` and `teiHeaderProcessor` modules) into readable, styled HTML, including a distinct rendering/stylesheet for the `teiHeader` metadata block.
- **Document Information panel** — a modal summarizing the document's header metadata (title, authorship, structure).
- **Full-text search** — search within the rendered text, with previous/next navigation between results and a result counter, and clear feedback when no results are found.
- **Sidebar navigation** — a page index and TEI list browser (e.g. lists of persons, places, or other TEI list structures extracted from the document) for quick jumps within long documents, with previous/next group navigation.
- **User notes/annotations** — a note toolbar and note display panel allow attaching typed notes (with a custom "type" label and free-text content) to specific points in the reading view; notes can be added, edited, or deleted, and are listed for later review.
---
 
## Compilator (Assembler)
 
*"Imports multiple XML files and allows reordering via drag&drop. The documents can be assembled into a single TEI document, or it can perform a collation of serialized documents."*
 
Compilator handles multi-document workflows — building a single edition out of many source files, or comparing textual witnesses. Its features include:
 
- **Multi-file import** — import several XML files at once into a working list.
- **Drag-and-drop reordering** — reorder imported files freely (via `vuedraggable`) since document order affects the assembly result.
- **Per-file editing** — select any imported file to open and edit it in an inline Monaco-based editor, with unsaved-change tracking and a confirmation prompt before discarding edits or switching files.
- **Two assembly modes**:
  - **Simple assembly** — merges the imported XML files into a single TEI document, using the first file in the list as the structural/header base.
  - **Collation mode** — produces a critical-apparatus style collation of the documents using TEI's `<app>`/`<rdg>` (apparatus/reading) mechanism, requiring at least two source documents.
- **Live preview** — a preview pane for the assembled/collated document.
- **Validation** — validate the resulting document against the TEI schema, with detailed error reporting.
- **Copy & Export** — copy the result to the clipboard or export it directly to a file.
---
 
## Exemplator (HeaderBuilder)
 
*"Generates the `<teiHeader>` (titles, authors, lists of people/places) from the terms extracted from the text."*
 
Exemplator automates the tedious task of compiling a TEI header from the actual content of a text. Its features include:
 
- **Term extraction** — scans the current Scriptor document (via a dedicated SAX parser, `saxParserLists.js`) to extract structured term lists — e.g. named persons, places, and other taggable entities — supporting both verse (`lg`/`l`) and prose (`div`/`p`) document structures, with intelligent grouping by `ref`/`xml:id` and sentence-initial capitalization normalization.
- **Editable extracted-terms list** — review and refine the automatically extracted terms before generating the header.
- **`teiHeader` generation** — builds a complete, valid `<teiHeader>` element (titles, authorship, `listPerson`/`listPlace`-style structures) from the extracted term lists.
- **Editable header preview** — the generated header can be reviewed and edited directly before use.
- **Apply to Scriptor** — inserts/replaces the `<teiHeader>` directly inside the document currently open in Scriptor, keeping the two tools in sync.
- **Export** — export the generated header as a standalone XML file.
---
 
## Glossographus (Vocabulary)
 
*"Extracts, edits and exports the vocabulary of words found in the current XML document in the Coder."*
 
Glossographus builds and manages a structured lexical index of the document currently open in Scriptor. Its features include:
 
- **Configurable extraction** — extraction options include tokenization language mode (Romance languages with split apostrophes, vs. Saxon/English-style joined apostrophes), minimum word length, case sensitivity, exclusion of numbers and punctuation, and sort order (alphabetical or by frequency).
- **Vocabulary statistics** — total words, unique words, total occurrences, and average occurrences at a glance.
- **Word list with occurrence tracking** — each extracted word shows its occurrence count and can be clicked to jump to that occurrence directly in the source document.
- **Editable JSON vocabulary** — the vocabulary is represented as structured, human-editable JSON, with a read-only mode while other work is in progress.
- **Import / Export / Validate** — vocabularies can be imported from or exported to file, and validated for structural correctness, with detailed error feedback.
---
 
## Speculum
 
*"Philological statistics and wordcloud on the current XML document in the Coder: tokens, types, TTR, hapax, frequent tags, named entities and distributions."*
 
Speculum ("the mirror") is the quantitative/stylometric analysis dashboard for the document in Scriptor, built on **ECharts**. Its features include:
 
- **Configurable tokenization** — the same Romance/Saxon apostrophe-handling modes as Glossographus, plus stopword filtering (built-in or a custom comma/space-separated list), minimum word length, case sensitivity, and exclusion of numbers/punctuation, and a configurable "Top N" for ranked results.
- **Core lexical statistics** — token count, type count (unique words), type-token ratio (TTR), hapax legomena count and their share of the lexicon, and average word length.
- **Structural statistics** — counts of verses, stanzas, paragraphs, estimated sentences, XML elements, attributes, and a content-vs-markup character breakdown.
- **Word cloud** — an interactive ECharts word cloud (via `echarts-wordcloud`) of the most frequent full words, with click-to-select feedback.
- **Charts and distributions**, including:
  - Most frequent words and most frequent XML tags
  - Content vs. markup character ratio
  - Full words vs. empty (function) words
  - Words per verse and (estimated) syllables per verse
  - Word length distribution
  - Frequent bigrams and trigrams
  - Named entities (people, places, terms…) shown as a weighted treemap, zoomable and broken down by entity type
- **On-demand recalculation** — statistics are computed on request ("Update"), showing the timestamp and token count of the last analysis, so the tool does not need to reprocess the document on every keystroke.
---
 
## Export
 
*"Exports the document to PDF or HTML, ready for publication or sharing."*
 
Export is the publication-ready output stage of the pipeline. Its features include:
 
- **Project naming** — set a project name used to build output filenames.
- **Standard export mode** — export the current document as PDF, XML, and/or HTML individually.
- **Pulpitum export mode** — a structured bulk-export mode that produces the XML, HTML, PDF, and a metadata JSON file together, following a fixed naming/foldering convention (with an auto-generatable UUID, a title, and a language code as metadata), intended to be dropped directly into a larger publishing pipeline ("Pulpitum").
- **Live filename preview** — shows exactly how output files will be named before exporting.
- **Progress reporting** — step-by-step status during export (reading local data, writing XML/HTML/JSON, generating the PDF), with explicit handling of missing images (skipped with a note rather than failing the whole export) and clear error messages if no XML/HTML content is available yet.
---
 
## Cross-cutting Systems
 
A few systems are not tied to a single tool but support the whole application:
 
- **Unified local workspace** — a `Scriptorium` folder under the user's Documents directory acts as the default file-system workspace for the app (managed in `src/main/filemanager.js`).
- **Persistent app state** (`electron-store`) — centrally stores the current project's XML/HTML content, loaded images, window bounds, and TEI-specific settings (schema paths, extraction configs, etc.), so state survives window open/close cycles.
- **Clipboard Companion** — a lightweight OS clipboard watcher (polling every 800ms, since Electron has no native clipboard-change event) maintains a shared, persisted FIFO history of up to 50 copied text snippets across the entire app.
- **Internationalization (i18n)** — the full UI is translated into Italian and English (`vue-i18n`), switchable live from Home.
- **Spellchecking** — per-language spellchecker configuration mapped onto Electron's native spellchecking engine.
- **Brand link** — a fixed, non-configurable external link (opened via the OS default browser, never inside an app window) to the Delta2Studio portfolio, reachable from a button in Home.
- **TEI schema support** — the app ships the full TEI-All XSD schema (plus a lighter TEI-All-TEIX variant) for validation across Scriptor, Assembler, and HeaderBuilder.
---
 
## Tech Stack
 
- **Application shell:** Electron, `electron-vite`, `electron-builder` (Windows/macOS/Linux builds), `electron-updater`, `electron-store`
- **UI framework:** Vue 3 (Composition API), Vue Router (hash history, multi-window routing), Pinia (state management), `vue-i18n`
- **Editing:** Monaco Editor
- **XML/TEI processing:** `fast-xml-parser` (validation), `sax` (streaming term/vocabulary extraction), `xml-formatter`
- **OCR:** `tesseract.js` with bundled trained data for 12 languages
- **Charts & visualization:** ECharts, `vue-echarts`, `echarts-wordcloud`
- **PDF generation:** `pdfkit`
- **Utilities:** `uuid`, `image-size`, `mime-types`, `unicode-json`, `vuedraggable`
## Project Structure
 
```
Scriptorium/
├── src/
│   ├── main/                  # Electron main process
│   │   ├── index.js           # App entry, window orchestration
│   │   ├── filemanager.js     # Workspace, file I/O, PDF generation
│   │   ├── ocrHandler.js      # OCR window & Tesseract orchestration
│   │   ├── ocrAutomationHandler.js  # Batch/automated OCR
│   │   ├── teiHandlers.js     # TEI-related IPC (extraction, validation)
│   │   ├── saxParserLists.js  # Term/list extraction (Exemplator)
│   │   ├── saxParserVocabulary.js  # Vocabulary extraction (Glossographus)
│   │   ├── clipboardHandler.js
│   │   ├── electronStore.js   # Persistent app/session state
│   │   ├── handleSpellchecker.js
│   │   └── brandLinkHandler.js
│   ├── preload/                # IPC bridge (window.electronAPI)
│   └── renderer/src/
│       ├── components/
│       │   ├── Home.vue        # Companion / launcher window
│       │   ├── Image/          # Copyist
│       │   ├── Coder/          # Scriptor
│       │   ├── Viewer/         # Librarius
│       │   ├── Assembler/      # Compilator
│       │   ├── HeaderBuilder/  # Exemplator
│       │   ├── Vocabulary/     # Glossographus
│       │   ├── Speculum/       # Speculum
│       │   └── Export.vue      # Export
│       ├── shared/
│       │   ├── tei/            # Metrical form processors, TEI tag definitions
│       │   ├── editor/         # Monaco editor helpers
│       │   ├── brand/          # BrandButton component
│       │   └── notify/         # Toast/notification system
│       ├── stores/              # Pinia stores (project, XML, HTML, images)
│       ├── i18n/                 # Italian & English locale files
│       ├── assets/               # TEI XSD schemas, Unicode data
│       └── public/tesseract/     # Bundled OCR engine & language data
├── electron.vite.config.mjs
└── package.json
```
 
