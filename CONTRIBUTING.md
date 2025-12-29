# Contributing to homebridge-frontier-silicon

First of all, thanks for taking the time to contribute! 🙌  
Contributions, testing, and feedback help keep this plugin reliable across many different Frontier Silicon radios.

---

## How to contribute

You can contribute in several ways:

- Reporting bugs
- Testing the plugin with different radio models
- Improving documentation
- Submitting pull requests with fixes or new features

---

## Bug reports

When opening a bug report, please include as much of the following information as possible:

- Radio brand and model
- Firmware version (if known)
- Homebridge version
- Plugin version
- Operating system (e.g. Raspberry Pi OS, Docker, macOS)
- Relevant Homebridge log output

If possible, also test whether your radio responds to:

```
http://<radio-ip>/fsapi/GET/netRemote.sys.info.friendlyName
```

This helps determine FSAPI compatibility quickly.

---

## Device compatibility reports

If you successfully use this plugin with a radio that is not listed in the README, please open an issue and include:

- Brand and model
- Which features work (power, volume, presets)
- Which features do not work (if any)

This helps extend the supported device list.

---

## Pull requests

Pull requests are welcome!

Please follow these guidelines:
- Keep changes focused and small
- Follow the existing coding style
- Avoid introducing new dependencies unless strictly necessary
- Test changes locally with a real device if possible

If your change introduces new user-facing behavior, please update the README and/or CHANGELOG accordingly.

---

## Feature requests

Feature requests are welcome, but please keep in mind:
- Not all Frontier Silicon radios expose the same FSAPI nodes
- HomeKit has limitations on media-related UI and controls

When suggesting a feature, explain:
- The use case
- Which FSAPI node(s) are involved, if known

---

## Code of conduct

Be respectful and constructive.  
This is an open-source project maintained in free time.

---

Thank you for contributing ❤️
