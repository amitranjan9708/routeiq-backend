"""Fetch Google Flights with explicit currency (Render US IPs otherwise return USD)."""
import os
from typing import List, Literal

from fast_flights import FlightData, Passengers, create_filter
from fast_flights.core import get_flights_from_filter
from fast_flights.schema import Result


def fetch_flights(
    *,
    flight_data: List[FlightData],
    trip: Literal["round-trip", "one-way", "multi-city"],
    seat: Literal["economy", "premium-economy", "business", "first"],
    passengers: Passengers,
) -> Result:
    currency = os.getenv("GOOGLE_FLIGHTS_CURRENCY", "INR")
    return get_flights_from_filter(
        create_filter(
            flight_data=flight_data,
            trip=trip,
            seat=seat,
            passengers=passengers,
        ),
        currency=currency,
        mode="fallback",
    )
