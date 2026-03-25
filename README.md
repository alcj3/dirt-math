# dirt-math

A browser-based tool for measuring landscaping blueprint PDFs — calibrate scale, draw zones, and compute real-world area.

Deployed Link: https://dirt-math.vercel.app

## What it does

1. **Upload a blueprint (PDF)** — renders in the browser, no server needed
2. **Calibrate scale** — draw a line over a known distance, enter the real-world length in ft / in / yd / m
3. **Draw zones** — click points to create polygons over areas you want to measure
4. **Get area per zone** — each zone shows its area in your chosen unit once calibrated

<img width="1503" height="846" alt="Screenshot 2026-03-25 at 3 05 07 PM" src="https://github.com/user-attachments/assets/b2cd21ac-209b-4af4-a564-96cd1050b3de" />



## Stack

- React + Vite
- PDF.js for blueprint rendering
- Plain CSS

## Why I built this

Built for my dad's landscaping business to replace manual ruler measurements on blueprint printouts. 
## What's next

- Save/load projects
- Multi-page blueprint support
- Materials calculator (mulch, sod, gravel quantities)
- AI-powered automatic zone detection
