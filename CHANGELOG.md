# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [1.1.0] – 2025-12-28

### Added
1. Added an optional native HomeKit Speaker service for volume control using the Volume characteristic.
2. Added configuration switches to expose the Speaker service and the Apple Home slider independently.

### Changed
1. Volume can now be controlled through either the Speaker service, the Apple Home slider service, or both.

### Improved
1. Better compatibility with third party HomeKit apps via the Speaker service.
2. Apple Home usability retained via the Brightness based slider.
3. Non linear volume mapping remains for precise low volume control.

## [1.0.2] – 2025-12-28

### Changed
- Improved volume handling using a non-linear volume curve.
- Low volume levels are now significantly softer, allowing precise control at the bottom of the HomeKit slider.
- Higher volume levels ramp up faster to maintain full output range.

### Improved
- Volume control now feels more natural and audio-appropriate.
- Better alignment between HomeKit slider behaviour and perceived loudness on Frontier Silicon radios.
- Overall usability of volume control in daily use.

## [1.0.1] – 2025-12-28

### Fixed
- Fixed FSAPI SET request formatting so power and volume changes are correctly applied to the radio.
- Resolved issue where HomeKit could read state changes but not write them back to the device.
- Improved reliability of write operations across Frontier Silicon devices.

## [1.0.0] – 2025-12-28

### Added
- Initial stable release of the Homebridge Frontier Silicon plugin.
- Power control via HomeKit using native FSAPI communication.
- Volume control with safe polling and automatic recovery when the device is unreachable.
- Configurable polling interval.
- Direct HTTP communication without external or native dependencies.

### Fixed
- Eliminated crashes when the radio becomes temporarily unreachable.
- Removed dependency on legacy wifiradio and request modules.
- Replaced legacy polling mechanisms with safe async polling.
