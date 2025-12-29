# Presets & Stations

This plugin uses **radio presets**, not direct station URLs.

## Important
- Presets must be saved on the radio itself first
- Preset numbers in Homebridge are **1-based**
- Internally mapped to FSAPI preset keys (0-based)

## Behavior
- Preset switches are exclusive
- Selecting one station deselects the others
