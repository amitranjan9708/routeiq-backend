# Skyscanner MCP Server

An MCP (Model Context Protocol) server that exposes Skyscanner flight and airport search functionality to AI assistants like Claude Desktop and Cursor.

## ⚠️ Disclaimer

**This project is experimental and intended for educational purposes only.**

- This software is provided "as is" without any warranties
- **Not intended for commercial use** - Do not use this software in any commercial or production environment
- The Skyscanner API client library used here is reverse-engineered and may violate Skyscanner's Terms of Service
- Use at your own risk - The authors are not responsible for any consequences of using this software
- This project is for learning and experimentation with MCP servers and API integration

## Features

- ✈️ **Flight Search** - Search for flights between airports with flexible date options
- 🛫 **Airport Search** - Find airports by name, city, or IATA code

## Installation

### Prerequisites

- Python 3.8 or higher
- Git (for submodule support)

### Step 1: Clone the Repository

```bash
# Clone with submodules (recommended)
git clone --recursive https://github.com/shadyvb/mcp-skyscanner.git
cd mcp-skyscanner
```

**If you already cloned without submodules:**
```bash
git submodule update --init --recursive
```

### Step 2: Install Dependencies

```bash
pip install -r requirements.txt
```

**What gets installed:**
- `fastmcp` - MCP server framework
- `curl_cffi`, `typeguard`, `orjson` - Skyscanner API dependencies
- `skyscanner-api` - Included as git submodule (automatically loaded by `mcp_server.py`)

The `mcp_server.py` automatically adds the `vendor/skyscanner` submodule to the Python path, so no additional installation steps are needed.

## Usage

### Setting Up Claude Desktop

1. **Locate your Claude Desktop configuration file:**
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. **Add the MCP server configuration:**

   Open the config file and add the following (or merge with existing `mcpServers`):

```json
{
  "mcpServers": {
    "skyscanner": {
      "command": "python3",
      "args": ["/absolute/path/to/mcp-skyscanner/mcp_server.py"],
      "env": {
        "SKYSCANNER_LOCALE": "en-US",
        "SKYSCANNER_CURRENCY": "USD",
        "SKYSCANNER_MARKET": "US"
      }
    }
  }
}
```

   **Important notes:**
   - Replace `/absolute/path/to/mcp-skyscanner/mcp_server.py` with the **absolute path** to your `mcp_server.py` file
   - Use `python3` instead of `python` on macOS/Linux
   - If using a virtual environment, use the full path to Python (e.g., `/path/to/venv/bin/python3`)

3. **Restart Claude Desktop** completely (quit and reopen the application)

4. **Verify installation:** After restarting, you should see the Skyscanner tools available in Claude Desktop. Try asking: "Search for flights from LHR to JFK on December 22nd"

### Environment Variables

- `SKYSCANNER_LOCALE`: Locale code (default: "en-US")
- `SKYSCANNER_CURRENCY`: Currency code (default: "USD")
- `SKYSCANNER_MARKET`: Market region code (default: "US")

## Available Tools

Once configured, the following tools are available in Claude Desktop:

### `search_airports`

Search for airports by name, city, or IATA code.

**Example usage in Claude:**
- "Search for airports in London"
- "Find airports with code LHR"
- "What airports are in Cairo?"

**Parameters:**
- `query` (string, required): Airport name, city, or IATA code (e.g., "London", "LHR", "Cairo")
- `depart_date` (string, optional): Departure date in ISO format (e.g., "2025-12-22")
- `return_date` (string, optional): Return date in ISO format

**Returns:** List of airport objects with `title`, `skyId` (IATA code), and `entity_id`

### `search_flights`

Search for flights between two airports.

**Example usage in Claude:**
- "Search for flights from London Heathrow to New York JFK on December 22nd"
- "Find flights from CAI to OPO on 2025-12-22"
- "Show me round-trip flights from LHR to JFK departing December 22, returning December 29"

**Parameters:**
- `origin_airport_code` (string, required): IATA code (e.g., "LHR", "CAI", "JFK")
- `destination_airport_code` (string, required): IATA code (e.g., "JFK", "OPO", "LHR")
- `depart_date` (string, required): Departure date in ISO format (e.g., "2025-12-22" or "2025-12-22T10:00:00")
- `return_date` (string, optional): Return date for round-trip flights
- `cabin_class` (string, optional): "economy", "premium_economy", "business", or "first" (default: "economy")
- `adults` (integer, optional): Number of adult passengers, 1-8 (default: 1)

**Returns:** Dictionary with `session_id` and `buckets` containing flight options:
- `Best` - Best overall options
- `Cheapest` - Lowest price options
- `Fastest` - Shortest duration options
- `Direct` - Non-stop flights (if available)

## Example Usage

After setting up the MCP server in Claude Desktop, you can use natural language queries:

```
User: Search for flights from London Heathrow to New York JFK on December 22nd

Claude: I'll search for flights from London Heathrow (LHR) to New York JFK on December 22nd, 2025.

[Uses search_flights tool]

I found several flight options:
- Best: 8 options available
- Cheapest: 8 options available
- Fastest: 8 options available
- Direct: 3 non-stop options available

Would you like me to search for return flights as well?
```

## Troubleshooting

### Server Not Appearing

1. **Check Python path**: Use `python3` instead of `python` on macOS, or use full path to Python executable
2. **Verify dependencies**: Run `pip install -r requirements.txt` to ensure all packages are installed
3. **Initialize submodules**: Run `git submodule update --init --recursive` if the `vendor/skyscanner` directory is empty
4. **Check logs**: Look for errors in `~/Library/Logs/Claude/mcp-server-skyscanner.log` (macOS)
5. **Test manually**: Run `python3 /path/to/mcp_server.py` to check for import errors

### Common Errors

- **`spawn python ENOENT`**: Use `python3` instead of `python` in config
- **`ModuleNotFoundError: No module named 'fastmcp'`**: Run `pip install -r requirements.txt`
- **Date format errors**: Ensure dates are in `YYYY-MM-DD` format and in the future

### Error Responses

The server returns structured error responses:
- `BannedWithCaptcha`: Rate limited by Skyscanner
- `Timeout`: Search exceeded maximum retries
- `InvalidDate`: Date format or validation error
- `AirportNotFound`: Airport code not found

## Notes

- Flight searches may take 10-30 seconds (API polls for results)
- Dates must be in ISO 8601 format (`YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SS`)
- Dates must be in the future
- Airport codes are case-insensitive

## License

GPL-3.0

**Important:** This license applies to the MCP server code only. The Skyscanner API client library (`vendor/skyscanner`) has its own license terms. Please review the license of the upstream repository before use.

## Credits

- Skyscanner API client: [irrisolto/skyscanner](https://github.com/irrisolto/skyscanner)

## Disclaimer (Reminder)

This project is experimental and for educational purposes only. It is not intended for commercial use. Use at your own risk.
