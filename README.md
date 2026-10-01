# Garage Stock — Two-Wheeler Spare Parts Inventory

A single-file, no-install inventory management app for tracking two-wheeler (motorcycle/scooter) spare parts.

## Features
- Add / edit / delete spare parts — name, part number, category, compatible models, quantity, reorder level, unit price, supplier, shelf location
- Stock in / stock out tracking with a full movement log
- Low-stock alerts with one-click restock
- Dashboard with a stock health gauge and inventory value
- Reports — Daily / Weekly / Monthly views with charts and per-part breakdown
- Print-friendly reports
- Data is saved automatically in the browser (localStorage) — no backend, no database required

## Usage
Just open `garage-stock.html` in any modern browser (Chrome, Edge, Firefox). No build step, no installation.

> Data is stored per-browser via `localStorage`. If you open the file in a different browser or clear site data, you'll start with an empty inventory.

## Tech
Plain HTML + React (loaded via CDN) + Babel standalone for in-browser JSX. No build tooling needed.

## License
MIT — free to use and modify.
