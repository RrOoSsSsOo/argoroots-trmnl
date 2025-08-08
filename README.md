# TRMNL Plugins Collection

This repository contains three plugins for [TRMNL](https://usetrmnl.com) e-paper screens.

## 1. Börsihind - Estonian Electricity Prices

Displays Estonian electricity prices from [Börsihind.ee](https://börsihind.ee) with current pricing, component breakdown, and price trend visualization.

**Features:**
- **Current Price Display**: Shows the current electricity price with breakdown of components
- **Price Components**: Displays electricity price, transmission cost, renewable energy fee, and electricity excise
- **Cheapest Periods**: Highlights the cheapest 1h, 2h, 3h, and 4h periods for optimal energy usage
- **Visual Chart**: Stacked column chart showing hourly price breakdown for the day
- **Multiple Layout Options**: Supports full, half horizontal, half vertical, and quadrant layouts

**Location:** `/borsihind/`

## 2. Family Calendar - iCal Parser

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

**Function Setup:**
1. Deploy `/functions/calendar.js` to DigitalOcean App Platform as a serverless function
2. Configure the function URL in your TRMNL plugin settings as the data source
3. The function accepts a `url` parameter pointing to your iCal (.ics) calendar feed
4. Returns parsed events in JSON format for display on TRMNL screens

## 3. Met.no Weather Forecast

A weather forecast plugin that displays current and upcoming weather conditions using data from The Norwegian Meteorological Institute (met.no).

**Features:**
- **Current Weather**: Shows today's hourly weather forecast with temperature, wind speed, and precipitation
- **Multi-day Forecast**: Displays weather for today, tomorrow, and upcoming days
- **Weather Icons**: Visual weather symbols based on met.no weather codes
- **Configurable Location**: Set custom latitude and longitude coordinates for any location
- **Multi-language Support**: Available in Estonian, English, Norwegian, Finnish, and Swedish
- **Multiple Layouts**: Full, half horizontal, half vertical, and quadrant layout options
- **Detailed Metrics**: Temperature, wind speed, and precipitation amount for each forecast period

**Location:** `/met-no/`
