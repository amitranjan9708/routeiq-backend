#!/usr/bin/env python3
"""
Skyscanner MCP Server
Exposes Skyscanner flight and airport search functionality via MCP protocol.
"""
import datetime
import os
import sys
from pathlib import Path
from typing import Optional

# Add vendor/skyscanner to Python path if submodule exists
SCRIPT_DIR = Path(__file__).parent
VENDOR_SKYSCANNER = SCRIPT_DIR / "vendor" / "skyscanner"
if VENDOR_SKYSCANNER.exists() and str(VENDOR_SKYSCANNER) not in sys.path:
    sys.path.insert(0, str(VENDOR_SKYSCANNER))

from fastmcp import FastMCP
from skyscanner import SkyScanner
from skyscanner.types import CabinClass
from skyscanner.errors import BannedWithCaptcha, AttemptsExhaustedIncompleteResponse, GenericError

# Initialize FastMCP server
mcp = FastMCP("Skyscanner MCP Server")

# Initialize Skyscanner client with configurable parameters
scanner = SkyScanner(
    locale=os.getenv("SKYSCANNER_LOCALE", "en-US"),
    currency=os.getenv("SKYSCANNER_CURRENCY", "USD"),
    market=os.getenv("SKYSCANNER_MARKET", "US"),
)


def parse_iso_date(date_str: Optional[str]) -> Optional[datetime.datetime]:
    """Parse ISO format date string to datetime object.

    Supports:
    - Date-only: "2025-12-22"
    - ISO with time: "2025-12-22T10:00:00"
    - ISO with timezone: "2025-12-22T10:00:00Z"
    """
    if not date_str:
        return None
    try:
        # Remove timezone Z and replace with +00:00 for parsing
        date_str_clean = date_str.replace('Z', '+00:00')
        # Try parsing with time first
        dt = datetime.datetime.fromisoformat(date_str_clean)
        # If it's a date-only string, set default time to 10:00 AM
        if 'T' not in date_str and ' ' not in date_str:
            dt = dt.replace(hour=10, minute=0, second=0, microsecond=0)
        return dt
    except ValueError as e:
        raise ValueError(f"Invalid date format: {date_str}. Expected YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS format. Error: {str(e)}")


def airport_to_dict(airport):
    """Convert Airport object to dictionary."""
    return {
        "title": airport.title,
        "skyId": airport.skyId,
        "entity_id": airport.entity_id
    }


def search_airports_workaround(query: str, depart_date=None, return_date=None):
    """
    Wrapper around scanner.search_airports() to work around upstream bug.

    The upstream library has a bug where it sends empty strings for dates when None,
    which the API rejects. This wrapper always provides dates (defaults to future date).
    """
    # Workaround: Always provide dates to avoid upstream bug
    # If no dates provided, use a default future date (60 days from now)
    if not depart_date:
        depart_date = datetime.datetime.now() + datetime.timedelta(days=60)
    if not return_date:
        return_date = datetime.datetime.now() + datetime.timedelta(days=67)

    return scanner.search_airports(query, depart_date=depart_date, return_date=return_date)


@mcp.tool
def search_airports(
    query: str,
    depart_date: Optional[str] = None,
    return_date: Optional[str] = None
) -> list[dict]:
    """
    Search for airports by name, city, or IATA code.

    Args:
        query: Search text (airport name, city, or IATA code)
        depart_date: Optional departure date in ISO format (e.g., "2025-12-22" or "2025-12-22T10:00:00")
        return_date: Optional return date in ISO format (e.g., "2025-12-29" or "2025-12-29T10:00:00")

    Returns:
        List of airport dictionaries with title, skyId (IATA code), and entity_id
    """
    try:
        # Parse dates - only pass if provided (not None/empty)
        depart_dt = parse_iso_date(depart_date) if depart_date else None
        return_dt = parse_iso_date(return_date) if return_date else None

        # Use workaround wrapper to handle upstream bug
        airports = search_airports_workaround(
            query,
            depart_date=depart_dt,
            return_date=return_dt
        )

        return [airport_to_dict(airport) for airport in airports]

    except ValueError as e:
        return {
            "error": "InvalidDate",
            "message": str(e)
        }
    except BannedWithCaptcha as e:
        return {
            "error": "BannedWithCaptcha",
            "message": f"Skyscanner blocked the request with CAPTCHA: {str(e)}",
            "suggestion": "Try again later or use a proxy"
        }
    except GenericError as e:
        return {
            "error": "GenericError",
            "message": str(e),
            "details": "This might be due to invalid date format or API restrictions. Check that dates are in YYYY-MM-DD format and in the future."
        }
    except Exception as e:
        return {
            "error": "UnknownError",
            "message": f"Unexpected error: {str(e)}",
            "type": type(e).__name__
        }


@mcp.tool
def search_flights(
    origin_airport_code: str,
    destination_airport_code: str,
    depart_date: str,
    return_date: Optional[str] = None,
    cabin_class: str = "economy",
    adults: int = 1
) -> dict:
    """
    Search for flights between two airports.

    Args:
        origin_airport_code: IATA code of origin airport (e.g., "LHR", "JFK", "CAI")
        destination_airport_code: IATA code of destination airport (e.g., "JFK", "LHR", "OPO")
        depart_date: Departure date in ISO format (e.g., "2025-12-22" or "2025-12-22T10:00:00")
        return_date: Optional return date in ISO format for round-trip flights
        cabin_class: Cabin class - "economy", "premium_economy", "business", or "first"
        adults: Number of adult passengers (1-8, default: 1)

    Returns:
        Dictionary with session_id and buckets containing flight options
    """
    try:
        # Resolve airport codes to Airport objects
        # Use workaround wrapper to handle upstream bug (always provides dates)
        origin_airports = search_airports_workaround(origin_airport_code)
        origin = next(
            (a for a in origin_airports if a.skyId == origin_airport_code.upper()),
            None
        )
        if not origin:
            return {
                "error": "AirportNotFound",
                "message": f"Origin airport '{origin_airport_code}' not found"
            }

        destination_airports = search_airports_workaround(destination_airport_code)
        destination = next(
            (a for a in destination_airports if a.skyId == destination_airport_code.upper()),
            None
        )
        if not destination:
            return {
                "error": "AirportNotFound",
                "message": f"Destination airport '{destination_airport_code}' not found"
            }

        # Parse dates with better error handling
        try:
            depart_dt = parse_iso_date(depart_date)
            if not depart_dt:
                return {
                    "error": "InvalidDate",
                    "message": f"Invalid depart_date format: {depart_date}. Expected YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS"
                }
        except ValueError as e:
            return {
                "error": "InvalidDate",
                "message": str(e)
            }

        return_dt = None
        if return_date:
            try:
                return_dt = parse_iso_date(return_date)
            except ValueError as e:
                return {
                    "error": "InvalidDate",
                    "message": f"Invalid return_date format: {str(e)}"
                }

        # Convert cabin class string to enum
        cabin_map = {
            "economy": CabinClass.ECONOMY,
            "premium_economy": CabinClass.PREMIUM_ECONOMY,
            "business": CabinClass.BUSINESS,
            "first": CabinClass.FIRST
        }
        cabin_enum = cabin_map.get(cabin_class.lower(), CabinClass.ECONOMY)

        # Perform flight search
        response = scanner.get_flight_prices(
            origin=origin,
            destination=destination,
            depart_date=depart_dt,
            return_date=return_dt,
            cabinClass=cabin_enum,
            adults=adults
        )

        # Convert response to dictionary
        result = {
            "session_id": response.session_id,
            "buckets": []
        }

        if response.json and "itineraries" in response.json:
            itineraries = response.json["itineraries"]
            if "buckets" in itineraries:
                result["buckets"] = itineraries["buckets"]

        return result

    except ValueError as e:
        # This catches date parsing errors and validation errors from Skyscanner
        error_msg = str(e)
        if "date" in error_msg.lower() or "past" in error_msg.lower():
            return {
                "error": "InvalidDate",
                "message": error_msg,
                "suggestion": "Ensure dates are in YYYY-MM-DD format and in the future"
            }
        return {
            "error": "ValidationError",
            "message": error_msg
        }
    except BannedWithCaptcha as e:
        return {
            "error": "BannedWithCaptcha",
            "message": f"Skyscanner blocked the request with CAPTCHA: {str(e)}",
            "suggestion": "Try again later or use a proxy"
        }
    except AttemptsExhaustedIncompleteResponse:
        return {
            "error": "Timeout",
            "message": "Flight search timed out after maximum retries",
            "suggestion": "Try again later"
        }
    except GenericError as e:
        error_msg = str(e)
        # Check if it's a date format error from the API
        if "date" in error_msg.lower() or "format" in error_msg.lower():
            return {
                "error": "InvalidDate",
                "message": error_msg,
                "suggestion": "Ensure dates are in YYYY-MM-DD format (e.g., 2025-12-22) and in the future"
            }
        return {
            "error": "GenericError",
            "message": error_msg,
            "details": "This might be due to API restrictions or invalid parameters"
        }
    except Exception as e:
        return {
            "error": "UnknownError",
            "message": f"Unexpected error: {str(e)}",
            "type": type(e).__name__
        }


if __name__ == "__main__":
    mcp.run()

