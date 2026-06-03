"""JSON export for RouteIQ — Skyscanner API only (no fastmcp required)."""
import datetime
import json
import os
import sys
from pathlib import Path
from typing import Optional

SCRIPT_DIR = Path(__file__).parent
VENDOR_SKYSCANNER = SCRIPT_DIR / "vendor" / "skyscanner"
if VENDOR_SKYSCANNER.exists() and str(VENDOR_SKYSCANNER) not in sys.path:
    sys.path.insert(0, str(VENDOR_SKYSCANNER))

from skyscanner import SkyScanner  # noqa: E402
from skyscanner.types import CabinClass  # noqa: E402
from skyscanner.errors import BannedWithCaptcha  # noqa: E402

BUCKET_BY_MODE = {
    "cheapest": "Cheapest",
    "balanced": "Best",
    "fastest": "Fastest",
    "get_cheapest_flights": "Cheapest",
    "get_best_flights": "Best",
    "get_general_flights_info": "Fastest",
}


def parse_iso_date(date_str: Optional[str]) -> Optional[datetime.datetime]:
    if not date_str:
        return None
    try:
        date_str_clean = date_str.replace("Z", "+00:00")
        dt = datetime.datetime.fromisoformat(date_str_clean)
        if "T" not in date_str and " " not in date_str:
            dt = dt.replace(hour=10, minute=0, second=0, microsecond=0)
        return dt
    except ValueError as e:
        raise ValueError(
            f"Invalid date format: {date_str}. Expected YYYY-MM-DD. Error: {e}"
        ) from e


def scanner_client() -> SkyScanner:
    proxy = os.getenv("SKYSCANNER_PROXY", "").strip()
    return SkyScanner(
        locale=os.getenv("SKYSCANNER_LOCALE", "en-IN"),
        currency=os.getenv("SKYSCANNER_CURRENCY", "INR"),
        market=os.getenv("SKYSCANNER_MARKET", "IN"),
        proxy=proxy,
        max_retries=20,
        retry_delay=2,
    )


def search_airports_workaround(sc: SkyScanner, query: str, depart_date=None, return_date=None):
    if not depart_date:
        depart_date = datetime.datetime.now() + datetime.timedelta(days=60)
    if not return_date:
        return_date = datetime.datetime.now() + datetime.timedelta(days=67)
    return sc.search_airports(query, depart_date=depart_date, return_date=return_date)


def carrier_name(item: dict, carriers_index: dict) -> str:
    names = item.get("carrierNames") or item.get("carriers")
    if isinstance(names, list) and names:
        return ", ".join(str(n) for n in names[:2])
    if isinstance(names, dict):
        marketing = names.get("marketing") or names.get("marketingCarrierIds") or []
        if isinstance(marketing, list):
            out = []
            for cid in marketing[:2]:
                c = carriers_index.get(str(cid)) or carriers_index.get(cid)
                if isinstance(c, dict):
                    out.append(c.get("name") or c.get("alternateId") or str(cid))
                elif isinstance(c, str):
                    out.append(c)
            if out:
                return ", ".join(out)
    leg = (item.get("legs") or [None])[0] or {}
    leg_carriers = leg.get("carriers") or {}
    if isinstance(leg_carriers, dict):
        marketing = leg_carriers.get("marketing") or []
        if isinstance(marketing, list) and marketing:
            return ", ".join(str(m) for m in marketing[:2])
    return "Flight"


def iso_time(value) -> str | None:
    if not value:
        return None
    if isinstance(value, str):
        if "T" in value:
            try:
                dt = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
                return dt.strftime("%I:%M %p").lstrip("0")
            except ValueError:
                pass
        return value
    if isinstance(value, dict):
        h = value.get("hour") or value.get("hours")
        m = value.get("minute") or value.get("minutes") or 0
        if h is not None:
            dt = datetime.datetime(2000, 1, 1, int(h), int(m))
            return dt.strftime("%I:%M %p").lstrip("0")
    return None


def normalize_item(item: dict, carriers_index: dict, fly_from: str, fly_to: str) -> dict | None:
    price_obj = item.get("price") or {}
    raw = price_obj.get("raw") if isinstance(price_obj, dict) else None
    if raw is None and isinstance(price_obj, dict):
        raw = price_obj.get("amount")
    if raw is None:
        return None
    try:
        cost = int(round(float(raw)))
    except (TypeError, ValueError):
        return None

    legs = item.get("legs") or []
    leg = legs[0] if legs else {}
    duration = (
        leg.get("durationInMinutes")
        or leg.get("duration")
        or item.get("durationInMinutes")
        or 0
    )
    try:
        duration_mins = int(duration)
    except (TypeError, ValueError):
        duration_mins = 0
    if duration_mins <= 0:
        duration_mins = 120

    stop_count = leg.get("stopCount")
    if stop_count is None:
        stop_count = leg.get("stops", 0)
    try:
        stop_count = int(stop_count)
    except (TypeError, ValueError):
        stop_count = 0

    dep = leg.get("departure") or leg.get("dep")
    arr = leg.get("arrival") or leg.get("arr")

    return {
        "name": carrier_name(item, carriers_index),
        "price": cost,
        "priceFormatted": price_obj.get("formatted") if isinstance(price_obj, dict) else None,
        "duration": duration_mins,
        "stops": stop_count,
        "departure": iso_time(dep),
        "arrival": iso_time(arr),
        "flyFrom": fly_from,
        "flyTo": fly_to,
        "itineraryId": item.get("id"),
        "is_best": (item.get("score") or 0) >= 0.9,
    }


def pick_bucket_items(buckets: list, mode: str) -> list:
    bucket_id = BUCKET_BY_MODE.get(mode.lower(), "Cheapest")
    for bucket in buckets:
        bid = bucket.get("id") or bucket.get("name") or ""
        if str(bid).lower() == bucket_id.lower():
            return bucket.get("items") or []
    if buckets:
        return buckets[0].get("items") or []
    return []


def main() -> None:
    if len(sys.argv) < 4:
        print(json.dumps({"error": "usage: routeiq_export.py ORIGIN DEST YYYY-MM-DD [mode]"}))
        sys.exit(1)

    origin = sys.argv[1].upper()
    destination = sys.argv[2].upper()
    depart_date = sys.argv[3]
    mode = sys.argv[4] if len(sys.argv) > 4 else "cheapest"

    try:
        depart_dt = parse_iso_date(depart_date)
        if not depart_dt:
            print(json.dumps({"error": "Invalid date", "flights": []}))
            sys.exit(1)

        last_err = None
        sc = None
        for attempt in range(2):
            try:
                sc = scanner_client()
                origin_airports = search_airports_workaround(sc, origin, depart_date=depart_dt)
                break
            except BannedWithCaptcha as e:
                last_err = str(e)
                if attempt == 0:
                    continue
                print(
                    json.dumps(
                        {
                            "error": last_err,
                            "errorCode": "BannedWithCaptcha",
                            "flights": [],
                        }
                    )
                )
                sys.exit(1)
        if sc is None:
            print(json.dumps({"error": last_err or "Skyscanner init failed", "flights": []}))
            sys.exit(1)

        origin_a = next((a for a in origin_airports if a.skyId == origin), None)
        if not origin_a:
            print(json.dumps({"error": f"Origin {origin} not found", "flights": []}))
            sys.exit(1)

        dest_airports = search_airports_workaround(sc, destination, depart_date=depart_dt)
        dest_a = next((a for a in dest_airports if a.skyId == destination), None)
        if not dest_a:
            print(json.dumps({"error": f"Destination {destination} not found", "flights": []}))
            sys.exit(1)

        response = sc.get_flight_prices(
            origin=origin_a,
            destination=dest_a,
            depart_date=depart_dt,
            return_date=None,
            cabinClass=CabinClass.ECONOMY,
            adults=1,
        )

        buckets = []
        carriers_index = {}
        data = response.json or {}
        itin = data.get("itineraries") or data
        if isinstance(itin, dict):
            buckets = itin.get("buckets") or []
            carriers_raw = itin.get("carriers") or data.get("carriers") or {}
            if isinstance(carriers_raw, dict):
                carriers_index = carriers_raw
            elif isinstance(carriers_raw, list):
                for c in carriers_raw:
                    if isinstance(c, dict) and c.get("id") is not None:
                        carriers_index[str(c["id"])] = c

        items = pick_bucket_items(buckets, mode)
        flights = []
        for item in items[:15]:
            if not isinstance(item, dict):
                continue
            row = normalize_item(item, carriers_index, origin, destination)
            if row:
                flights.append(row)

        print(
            json.dumps(
                {
                    "origin": origin,
                    "destination": destination,
                    "departureDate": depart_date,
                    "tool": f"search_flights/{BUCKET_BY_MODE.get(mode.lower(), 'Cheapest')}",
                    "sessionId": response.session_id,
                    "currency": os.getenv("SKYSCANNER_CURRENCY", "INR"),
                    "flights": flights,
                }
            )
        )
    except BannedWithCaptcha as e:
        print(json.dumps({"error": str(e), "errorCode": "BannedWithCaptcha", "flights": []}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e), "flights": [], "type": type(e).__name__}))
        sys.exit(1)


if __name__ == "__main__":
    main()
