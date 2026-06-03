#!/usr/bin/env python3
"""
Test script to verify the MCP server is working correctly.
Tests flight search from CAI (Cairo) to LHR (Heathrow).
"""
import sys
import os

# Add skyscanner repo to path if not installed
try:
    from skyscanner import SkyScanner
except ImportError:
    # Try to find skyscanner repo
    skyscanner_paths = [
        "/tmp/skyscanner-repo",
        os.path.expanduser("~/skyscanner"),
        os.path.join(os.path.dirname(__file__), "..", "skyscanner"),
    ]
    for path in skyscanner_paths:
        if os.path.exists(path) and os.path.exists(os.path.join(path, "skyscanner")):
            sys.path.insert(0, path)
            break
    else:
        print("ERROR: skyscanner package not found.")
        print("Please install it by cloning: git clone https://github.com/irrisolto/skyscanner.git /tmp/skyscanner-repo")
        sys.exit(1)

# Import the underlying functions and scanner
from mcp_server import mcp, scanner, parse_iso_date, airport_to_dict, search_airports_workaround
from skyscanner.types import CabinClass

def test_airport_search():
    """Test searching for airports"""
    print("=" * 60)
    print("TEST 1: Airport Search")
    print("=" * 60)

    try:
        print("\nSearching for CAI (Cairo)...")
        # Use workaround function to avoid upstream bug
        import datetime
        depart_dt = datetime.datetime(2025, 12, 22)
        airports = search_airports_workaround("CAI", depart_date=depart_dt)
        cai_results = [airport_to_dict(airport) for airport in airports]

        if isinstance(cai_results, dict) and "error" in cai_results:
            print(f"✗ Error: {cai_results['error']}")
            print(f"  Message: {cai_results.get('message', 'No message')}")
            return None

        if not cai_results:
            print("✗ No airports found")
            return None

        cai = next((a for a in cai_results if a.get("skyId") == "CAI"), None)
        if not cai:
            print(f"✗ CAI not found in results: {[a.get('skyId') for a in cai_results[:3]]}")
            return None

        print(f"✓ Found: {cai['title']} ({cai['skyId']})")

        print("\nSearching for LHR (Heathrow)...")
        # Use workaround function to avoid upstream bug
        import datetime
        depart_dt = datetime.datetime(2025, 12, 22)
        airports = search_airports_workaround("LHR", depart_date=depart_dt)
        lhr_results = [airport_to_dict(airport) for airport in airports]

        if isinstance(lhr_results, dict) and "error" in lhr_results:
            print(f"✗ Error: {lhr_results['error']}")
            print(f"  Message: {lhr_results.get('message', 'No message')}")
            return None, None

        lhr = next((a for a in lhr_results if a.get("skyId") == "LHR"), None)
        if not lhr:
            print(f"✗ LHR not found in results: {[a.get('skyId') for a in lhr_results[:3]]}")
            return cai, None

        print(f"✓ Found: {lhr['title']} ({lhr['skyId']})")

        return cai, lhr

    except Exception as e:
        print(f"✗ Exception: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None, None

def test_flight_search(origin_code, dest_code):
    """Test flight search"""
    print("\n" + "=" * 60)
    print("TEST 2: Flight Search")
    print("=" * 60)

    try:
        print(f"\nSearching flights: {origin_code} → {dest_code}")
        print("Departure date: 2025-12-22")
        print("This may take 10-30 seconds...")

        # Resolve airports using workaround function
        import datetime
        depart_dt = datetime.datetime(2025, 12, 22)
        origin_airports = search_airports_workaround(origin_code, depart_date=depart_dt)
        origin = next((a for a in origin_airports if a.skyId == origin_code.upper()), None)
        if not origin:
            return {"error": "AirportNotFound", "message": f"Origin airport '{origin_code}' not found"}

        dest_airports = search_airports_workaround(dest_code, depart_date=depart_dt)
        destination = next((a for a in dest_airports if a.skyId == dest_code.upper()), None)
        if not destination:
            return {"error": "AirportNotFound", "message": f"Destination airport '{dest_code}' not found"}

        # Parse date for flight search
        depart_dt = parse_iso_date("2025-12-22")

        # Search flights
        response = scanner.get_flight_prices(
            origin=origin,
            destination=destination,
            depart_date=depart_dt,
            return_date=None,
            cabinClass=CabinClass.ECONOMY,
            adults=1
        )

        # Convert to result format
        result = {
            "session_id": response.session_id,
            "buckets": []
        }

        if response.json and "itineraries" in response.json:
            itineraries = response.json["itineraries"]
            if "buckets" in itineraries:
                result["buckets"] = itineraries["buckets"]

        if isinstance(result, dict) and "error" in result:
            print(f"\n✗ Error: {result['error']}")
            print(f"  Message: {result.get('message', 'No message')}")
            if "suggestion" in result:
                print(f"  Suggestion: {result['suggestion']}")
            return False

        if "session_id" in result:
            print(f"\n✓ Flight search successful!")
            print(f"  Session ID: {result['session_id']}")

            if "buckets" in result:
                buckets = result["buckets"]
                print(f"  Found {len(buckets)} price buckets:")
                for bucket in buckets:
                    bucket_id = bucket.get("id", "unknown")
                    items_count = len(bucket.get("items", []))
                    print(f"    - {bucket_id}: {items_count} options")

            return True
        else:
            print(f"\n✗ Unexpected response format: {list(result.keys())}")
            return False

    except Exception as e:
        print(f"\n✗ Exception: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("SKYSCANNER MCP SERVER TEST")
    print("=" * 60)
    print("\nTesting flight search: CAI (Cairo) → LHR (Heathrow)")
    print("=" * 60)

    # Test 1: Airport search
    cai, lhr = test_airport_search()

    if not cai or not lhr:
        print("\n" + "=" * 60)
        print("TEST FAILED: Could not find airports")
        print("=" * 60)
        sys.exit(1)

    # Test 2: Flight search
    success = test_flight_search("CAI", "LHR")

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    if success:
        print("✓ All tests passed! MCP server is working correctly.")
        sys.exit(0)
    else:
        print("✗ Flight search test failed.")
        sys.exit(1)

if __name__ == "__main__":
    main()

