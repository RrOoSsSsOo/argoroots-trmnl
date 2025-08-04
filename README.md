# TRMNL Plugins Collection

This repository contains two plugins for [TRMNL](https://usetrmnl.com) e-paper screens.

## Plugins

### 1. Börsihind - Estonian Electricity Prices

Displays Estonian electricity prices from [Börsihind.ee](https://börsihind.ee) with current pricing, component breakdown, and price trend visualization.

**Features:**
- **Current Price Display**: Shows the current electricity price with breakdown of components
- **Price Components**: Displays electricity price, transmission cost, renewable energy fee, and electricity excise
- **Cheapest Periods**: Highlights the cheapest 1h, 2h, 3h, and 4h periods for optimal energy usage
- **Visual Chart**: Stacked column chart showing hourly price breakdown for the day
- **Multiple Layout Options**: Supports full, half horizontal, half vertical, and quadrant layouts

**Location:** `/borsihind/`

### 2. Family Calendar - iCal Parser

A comprehensive iCal (.ics) calendar parser that displays upcoming events from any calendar source with full RFC 5545 compliance.

**Features:**
- **iCal Format Support**: Full RFC 5545 compliant parser for standard .ics calendar files
- **Recurring Events**: Complete support for RRULE with DAILY, WEEKLY, MONTHLY, and YEARLY frequencies
- **Exception Handling**: Proper handling of EXDATE (exception dates) and RECURRENCE-ID (modified instances)
- **Timezone Support**: Converts between different timezones including Europe/Tallinn and UTC
- **Event Filtering**: Shows only upcoming events from yesterday onwards (first 25 events)
- **Multiple Layouts**: Full, half horizontal, half vertical, and quadrant layout options
- **Clean Output**: Displays event title, start/end times, and location if available

**Location:** `/calendar/`

**Backend Function:** `/functions/calendar.js` - A comprehensive iCal parser with modular function architecture for robust event processing and RFC 5545 compliance. Uses DigitalOcean App Platform Functions to fetch and parse remote calendar URLs that cannot be accessed directly from TRMNL due to CORS restrictions.

## Usage

Each plugin directory contains:
- `settings.yml` - Plugin configuration and custom fields
- Layout templates: `full.liquid`, `half_horizontal.liquid`, `half_vertical.liquid`, `quadrant.liquid`
- `shared.liquid` - Common styling and JavaScript (borsihind only)

## Installation

1. Upload the desired plugin directory to your TRMNL plugin marketplace or development environment
2. Configure the required settings (electricity plan for Börsihind, calendar URL for Family Calendar)
3. Choose your preferred layout size

## License

MIT License - see LICENSE file for details.
