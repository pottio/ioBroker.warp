# ioBroker.warp

[![NPM version](https://img.shields.io/npm/v/iobroker.warp.svg)](https://www.npmjs.com/package/iobroker.warp)
[![Downloads](https://img.shields.io/npm/dm/iobroker.warp.svg)](https://www.npmjs.com/package/iobroker.warp)
![Number of Installations](https://iobroker.live/badges/warp-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/warp-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.warp.png?downloads=true)](https://nodei.co/npm/iobroker.warp/)

**Tests:** ![Test and Release](https://github.com/pottio/ioBroker.warp/workflows/Test%20and%20Release/badge.svg)

## WARP charger adapter for ioBroker

This adapter monitors and controls a wallbox [(WARP charger)](https://www.warp-charger.com/) by [Tinkerforge](https://www.tinkerforge.com/de/) via ioBroker. The connection will be established via WebSockets.

Why using this adapter - it is also possible to connect the wallbox to ioBroker via MQTT ?! 

However, no individual states are sent via MQTT, but complex JSON objects. The warp adapter resolves the complex JSON objects into single states. This makes it easier to react on value changes of a single state. In addition, each state is provided with the corresponding description, unit and further information, which can be found in the [official API documentation](https://www.warp-charger.com/api.html). To top it off, all commands such as starting/stopping a charging process are supported.

### Supported WARP chargers

- [WARP charger](https://www.warp-charger.com/index_warp1.html)
  - Smart
  - Pro
- [WARP2 charger](https://www.warp-charger.com/index.html)
  - Smart
  - Pro

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->

### 0.0.2 (2022-03-21)
* (pottio) initial release

## License
MIT License

Copyright (c) 2022 pottio

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.