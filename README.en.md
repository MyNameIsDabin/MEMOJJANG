[한국어](README.md) · **English** · [日本語](README.ja.md)

# Memojjang (메모짱)

A desktop app that runs on a classic pixel font, where **to-dos, memos, links and images** get stuck anywhere on one huge canvas.

For when Notepad is too plain and Notion is too much.
Toss things onto an endless canvas wherever you like, drag them around, and zoom with `Ctrl`+wheel.

> **This project was built with AI.**
> The code, the icons and this document were mostly written together with Anthropic's Claude.
> A human decided what to build and how it should behave; the AI did the implementing and the polishing.

![Memojjang — to-dos, a markdown memo, links and image notes laid out on one board and decorated with stickers](docs/board.png)

## Get it

**[→ Download the latest release](https://github.com/MyNameIsDabin/MEMOJJANG/releases/latest)**

Windows 10 / 11 (x64). Grab `Memojjang_x.y.z_x64-setup.exe` and run it.
An `.msi` ships alongside it for organizational deployment.

The app isn't code-signed, so SmartScreen will stop you the first time.
Click **More info → Run anyway**. All the source is here, so building it yourself gives you the same thing.

## A look around

### Text is shown the way it's written

Pick a view in the info bar under each memo: plain, markdown, code, JSON or HTML.
JSON gets indented and colored — keys, strings, numbers, `true`/`false`/`null` each their own color.
You can also let the app work it out from what you pasted.

![JSON, HTML and markdown memos each drawn in their own form](docs/views.png)

### Deadlines in three rows of buttons

Hover a to-do item and a clock button appears. Hit a minute/hour/day preset or type a date,
and the right side of the row picks up a countdown and a progress bar — `4 days left`, `20 minutes left`.
Drag the handle on the left to reorder.

![The deadline popup on a to-do item — 5/15/30 minute, 1/2/3 hour and 1/3/7 day presets](docs/due.png)

### Notes go wherever you right-click

![The canvas context menu — add to-do, add memo, add links, open an image, paste here](docs/menu.png)

### When there are dozens of notes, search

`Ctrl+F` searches titles and bodies together, and picking a result flies that note to the middle of the screen.

![The search panel with "우유" typed in, matching one to-do note and one memo](docs/search.png)

### Night · Day · Classic

![The same board in the day theme](docs/day.png)

### Fonts and colors are yours

The default font is Galmuri11, and you can switch to Galmuri9 / 14 / Mono / your system font.
Open **Edit colors** to change everything from the canvas ground to shadow opacity to the JSON palette — and put any of it back whenever you like.

| Settings | Edit colors |
| --- | --- |
| ![The settings window — font picker and themes](docs/settings.png) | ![The theme color editor — canvas, note, text and JSON colors listed one by one](docs/theme.png) |

### It works squeezed narrow, too

Shrink the window and the toolbar icons fold into `⋯` from the back, and the tab names shorten.
Whatever folded away still works from the `⋯` menu.

![The ⋯ menu opened in a narrowed window](docs/narrow.png)

## What it does

- **Several canvases** — one canvas is one file. Put them wherever you want and switch with the tabs up top. Split work from personal, or keep one per project.
- **Infinite canvas** — `Ctrl`+wheel to zoom around the cursor, drag empty space or wheel-drag to move.
  Near 100% and 200% it snaps a little so pixels stay crisp.
  **The bare wheel never touches the view** — so that scrolling a long memo to its end can't drag the canvas along or make the zoom jump. Moving the view is left to dragging alone.
- **Four kinds of note**
  - **To-do** — Enter for the next item, Backspace on an empty one to remove it. Drag the left handle to reorder;
    set a deadline with the clock button and the row gains a countdown and a progress bar.
  - **Memo** — a plain writing box. Pasted text becomes one of these. The info bar below picks the **view**
    (plain · markdown · code · JSON · HTML), or you can let the app decide from what you pasted.
    You can add and remove the rules behind that decision in the settings.
  - **Links** — collect the places you visit with your own labels. Site icons attach themselves, and clicking opens your default browser.
    With just this one note selected, pasting an address **drops straight into that list** instead of making a new note
    (several lines, several entries at once). Text that isn't an address becomes a memo as usual.
  - **Image** — from paste (`Ctrl+V`), dragging a picture out of a browser, right-click → **Open an image**,
    or **Capture a region**. Resizing keeps the original aspect ratio, so nothing gets cropped or letterboxed.
    Press `✎` below to **draw on it with a pencil** — pick a color and a width, undo one stroke or clear them all.
    Strokes are stored as coordinates, so **the original file is untouched**, and they grow with the note.
- **Paste an image** — take a screenshot, hit `Ctrl+V`, and it lands at the cursor. The picture is saved as its own file; the note keeps only the file name.
- **Capture a region** — right-click → **Capture a region**. The screen freezes at that instant, and dragging out
  the part you want turns it straight into an image note. No other capture app in between. `Esc` backs out.
  Several monitors are covered as one sheet, and the piece that lands in the note is cut from the original, so no quality is lost.
- **Decorating** — the sticker button in the toolbar puts you in decorating mode. The notes fade to gray so you
  can see at a glance that they're locked, and a line at the top tells you what to do.
  Right-click empty space to pick a sticker and it lands there; drag a corner handle to **rotate and resize** (`Shift` for size alone, `Ctrl` snaps rotation to 5°).
  Drag the ring at the lower left onto a note and the sticker **sticks to it and travels with it**; hover the link line
  and the cursor becomes scissors that cut it. `Enter` finishes placing.
  When it attaches you choose one of the note's **four corners or its middle**. That spot becomes the anchor, so
  resizing the note carries the sticker along with that corner — hang it at the bottom right and it stays bottom right however far you stretch.
  The bar at the bottom sets **layer** (behind the note · under the body · in front), **opacity** (slider or number),
  **grayscale** and **shape** (square · circle · star). "Under the body" sits inside the note like paper texture.
- **Sticker packs** — pick the ones you want from the sticker drawer and **export** them as a single file.
  The image bytes travel inside it, so the person receiving it needs nothing else (`.mjsticker.json`).
  **Import** drops someone else's pack straight into your drawer.
- **Copy a whole note** — select and `Ctrl+C`, then `Ctrl+V` where you want it.
  It duplicates **the whole note**, not the text inside, and any stickers stuck to it come along.
  It works across canvas tabs too — images move themselves into that canvas's `.assets`.
- **Fill the screen** — press `⛶` in a note's title bar and that one note takes over the canvas.
  Resize the window and the body follows; `Esc` puts it back. The note's place and size are left alone.
- **Finding things** — `Ctrl+F` searches titles and bodies together. The `🔍` at the left of the status bar (`Ctrl+Space`)
  opens the note list, which is about going somewhere by name; its search box sits at the bottom of the list.
  `↑` `↓` `Tab` to point, `Enter` to go.
  Either way the note comes to the middle of the screen, and
  **if you were looking at a full-screen note, the one you picked takes that place instead.**
- **Updates** — the top of the settings tells you when a new version is out; one press downloads it, installs it and relaunches.
  What it downloads is installed only after its signature checks out.
- **Add fonts** — call a font already installed on this computer by name, or load a font file directly.
  Loaded files are copied into the app data folder, so they survive you moving the original.
- **Tidy and snap** — line a tangled board up on the grid, or fit the zoom so everything is visible.
  With snap on, dropping a note aligns **both its place and its size** to the grid dots, and while you drag, a silhouette shows where it will land.
- **Languages** — 한국어 · English · 日本語, switched at the top of the settings. Because the font is Galmuri,
  only languages its glyphs cover are offered for now; one more dictionary file adds another ([`src/i18n/`](src/i18n/)).
- **Global shortcut** — `Ctrl+Shift+Space` by default. Summons Memojjang from any program and hides it when pressed again. Set your own combination in the settings by pressing it.
- **A classic pixel font** — [Galmuri11](https://github.com/quiple/galmuri) by default, with Galmuri9 / 14 / Mono / system font in the settings.
- **Three themes** — Night (default) · Day · Classic (that old teal desktop). **Edit colors** in the settings lets you change
  the canvas ground, note faces, shadows, window frame and so on one at a time (with opacity where it makes sense), and reset any of them.
- **Lives in the tray · always on top** — closing leaves it in the tray, and it can be pinned above other windows.
- **Clipboard collecting** — piles up everything you copy onto the board. It's handy, but it's **off by default** for privacy.

## Shortcuts

| Key | What it does |
| --- | --- |
| `Ctrl+Shift+Space` | Summon / hide Memojjang **from anywhere** (configurable) |
| `Ctrl+1` `Ctrl+2` `Ctrl+3` | Add a to-do · memo · links note |
| `Ctrl+V` | Paste at the cursor (images become image notes) |
| `Ctrl+F` | Search the board — press again to close (`Enter` in the panel does the same) |
| `F2` | Rename the selected note |
| `Ctrl+Enter` | Fill the screen with the selected note (again to shrink) |
| `Esc` | Shrink a full-screen note · leave decorating · close a panel · clear the selection |
| `Ctrl+Space` | Open the note list — `↑` `↓` `Tab` to pick, `Enter` to go |
| `Space` | Bring the selection to the middle of the screen (zoom untouched) |
| `Ctrl`+wheel | Zoom around the cursor — works over notes too |
| Wheel | Scrolls inside a note whose content overflows (`Shift` for sideways) |
| **Wheel-drag** | Move the canvas from anywhere — works over notes too |
| Drag empty space | Move the canvas |
| `Shift`+drag | Select several |
| `Ctrl+C` | Copy the selected **notes whole** (they paste into other canvases too) |
| `Ctrl+D` | Duplicate the selection |
| `Delete` | Delete the selection |
| `Ctrl+Z` / `Ctrl+Y` | Undo · redo |
| `Ctrl+0` | Zoom 100% |
| `Ctrl+Shift+0` | Fit everything on screen |
| `Ctrl+Shift+G` | Tidy onto the grid |

A note's title bar drags from anywhere you grab it — over the buttons too, and if you let go without moving, that button gets pressed.
`✎` renames, `⛶` fills the screen, `▬` collapses, and the little square on the left changes the color.
Double-click the bar to collapse it.

Zoom and "always on top" live in the status bar at the bottom; things you rarely touch, like the grid dots, live in the settings.

The top of the window turns off the OS decoration and draws itself, so the title bar, tabs and canvas run into each other without a seam.
The icons are drawn by hand on a 16×16 grid, which is what keeps the dot feel ([`src/ui/Icon.tsx`](src/ui/Icon.tsx)).

## Development

- **Node.js 20+**
- **Rust (stable, MSVC)** — <https://rustup.rs>
- **Windows**: the "Desktop development with C++" workload from Visual Studio Build Tools, and the WebView2 runtime (Windows 11 already has it)

```bash
npm install
npm run tauri dev      # run as the app
npm run tauri build    # produce installers (target/release/bundle)
```

When you're only touching the UI, there's no need to wait for a Rust build:

```bash
npm run dev            # http://localhost:1420 - straight in the browser
```

Browser mode uses `localStorage` instead of saving files, and the tray, always-on-top and clipboard collecting don't work there.

## Layout

```
src/
  types.ts              domain model (serialized into the canvas file as-is)
  i18n/                 message catalogs — ko is the source, others may be partial
  store/
    boardStore.ts       notes, viewport, selection and undo for the open canvas
    canvasStore.ts      the canvas list and switching — create/open/close/rename
    settingsStore.ts    settings and putting them on screen
    uiStore.ts          which overlapping panels are open
    effects.ts          autosave and settings propagation (side effects outside the stores)
  canvas/Board.tsx      the infinite canvas — pan/zoom/grid/marquee selection
  notes/                NoteShell (the shared frame) + four bodies, one per kind
    detect.ts           guessing a view from pasted text (built-in rules + your own)
  actions/
    paste.ts            pasting (the paste event · reading the clipboard directly)
    search.ts           searching inside the board
    layout.ts           flying to a note, fitting everything, tidying onto the grid
  platform/
    capture.ts          region capture — cutting the chosen part out of a frozen screen
    stickers.ts         the sticker drawer + pack export/import
    files.ts            file I/O at arbitrary paths + path handling
    canvasFile.ts       reading and writing a canvas set (body + .assets images)
    assets.ts           saving and loading images for the active canvas
    storage.ts          the app's own state (settings, workspace)
  theme/palette.ts      the single source of theme colors — defaults, edit list, :root
  ui/
    Toolbar.tsx         the icon toolbar + folding into ⋯ when narrow
    useOverflow.ts      the hook that measures how many fit
    CanvasTabs.tsx      the canvas tab strip
    ThemeEditor.tsx     editing colors one at a time and resetting them
    MemoRules.tsx       managing the view-detection rules
src-tauri/src/
  lib.rs                plugin registration, close behavior, commands
  files.rs              reading and writing files at arbitrary paths (outside the fs plugin's scope)
  net.rs                fetching site icons
  capture.rs            freezing the desktop and cutting out the chosen part
  tray.rs               the tray icon and its menu
  hotkey.rs             registering the global shortcut and pulling the window forward
  clipboard_watch.rs    the clipboard watching thread
```

One coordinate rule is all you need to read the canvas code:

```
screen = world × zoom + viewport{x, y}
```

Notes are all absolutely placed in world coordinates, and `transform` is applied to exactly one outer wrapper.
That's why pan and zoom cost the same no matter how many notes there are.

## Where the data lives

**Canvases are saved wherever you chose.** One canvas is one file.

```
My board.mjb.json      the notes and the view position
My board.mjb.assets/   pasted images (created only once there is an image)
```

Images stay out of the body because of autosave. Every save rewrites the whole file, and with even a few
pictures inside that would mean writing megabytes each time. The trade-off: **when you move a canvas file, move its `.assets` folder with it.**

Only the app's own state stays in `%APPDATA%\com.memojjang.app\`:

```
settings.json     settings like font, theme and shortcut
workspace.json    which canvases you had open (a list of paths)
```

Deleting that folder doesn't lose any memos — only the tab list, and you can just open the canvas files again.
**Open the canvas file's folder** in the settings takes you straight to where the current canvas lives.

## About site icons

Icons on link notes come **straight from the site**, not through a favicon proxy service.
That's so no third party learns which places you keep going back to.
It tries `/favicon.ico` and then `/apple-touch-icon.png`, and falls back to a letter tile if neither is there.

This is why `img-src` alone is opened to `https:` in the app's CSP. Images don't execute, so the risk differs from
opening up scripts; the rest (`script-src`, `connect-src`) stays locked.

## About clipboard collecting

Turned on, it piles up whatever you copy in other programs too. Convenient, but a password copied out of a
password manager would land there as well, so it's **off by default**, and what it collects never leaves this computer.

On Windows it only asks `GetClipboardSequenceNumber` whether anything changed, so watching costs practically nothing.
On other systems it collects text only.

## License

- **Code**: MIT — [`LICENSE`](LICENSE)
- **Font**: [Galmuri](https://github.com/quiple/galmuri) — SIL Open Font License 1.1.
  The full text ships alongside it in [`public/fonts/Galmuri-OFL.md`](public/fonts/Galmuri-OFL.md).
  The font follows the OFL rather than MIT, so that file must not be dropped when redistributing.

Licenses for everything bundled are collected in [`NOTICE.md`](NOTICE.md).
