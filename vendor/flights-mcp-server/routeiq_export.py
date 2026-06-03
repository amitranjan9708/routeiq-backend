"""JSON export for RouteIQ — mirrors flights.py MCP tools (get_cheapest_flights, etc.)."""
import json
import sys
from dataclasses import asdict

from fast_flights import FlightData, Passengers

from google_flights_fetch import fetch_flights

TOOL_ALIASES = {
    "cheapest": "get_cheapest_flights",
    "best": "get_best_flights",
    "balanced": "get_best_flights",
    "general": "get_general_flights_info",
    "fastest": "get_general_flights_info",
}


def price_value(flight: dict) -> float:
    price_str = str(flight.get("price", ""))
    for ch in ("$", ",", "₹", " "):
        price_str = price_str.replace(ch, "")
    try:
        return float(price_str)
    except ValueError:
        return 1e12


def apply_tool(flights: list, tool: str) -> list:
    if tool == "get_cheapest_flights":
        return sorted(flights, key=price_value)[:30]
    if tool == "get_best_flights":
        best = [f for f in flights if f.get("is_best")]
        return best[:30]
    if tool == "get_general_flights_info":
        return flights[:40]
    # legacy
    if tool == "cheapest":
        return sorted(flights, key=price_value)[:30]
    if tool == "best":
        return [f for f in flights if f.get("is_best")][:30]
    return flights[:15]


def main() -> None:
    if len(sys.argv) < 4:
        print(json.dumps({"error": "usage: routeiq_export.py ORIGIN DEST YYYY-MM-DD [tool]"}))
        sys.exit(1)

    origin = sys.argv[1].upper()
    destination = sys.argv[2].upper()
    departure_date = sys.argv[3]
    raw_tool = (sys.argv[4] if len(sys.argv) > 4 else "get_cheapest_flights").lower()
    tool = TOOL_ALIASES.get(raw_tool, raw_tool)

    try:
        result = fetch_flights(
            flight_data=[FlightData(date=departure_date, from_airport=origin, to_airport=destination)],
            trip="one-way",
            seat="economy",
            passengers=Passengers(adults=1),
        )
        data = asdict(result)
        all_flights = data.get("flights") or []
        flights = apply_tool(all_flights, tool)

        out = {
            "origin": origin,
            "destination": destination,
            "departureDate": departure_date,
            "currentPrice": data.get("current_price"),
            "tool": tool,
            "flights": flights[:15],
        }
        print(json.dumps(out))
    except Exception as e:
        print(json.dumps({"error": str(e), "flights": [], "tool": tool}))
        sys.exit(1)


if __name__ == "__main__":
    main()
