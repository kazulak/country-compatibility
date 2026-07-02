# -*- coding: utf-8 -*-
"""
Country Compatibility Explorer - Python Validation Tests (SQLite Edition with Cities)
"""

import sys
from db_sqlite import get_locations
from engine import rank_locations

def run_tests():
    print("Starting Country Compatibility Explorer Python SQLite validation...")

    locations = get_locations()

    # Filter by type
    countries = [l for l in locations if l["type"] == "country"]
    cities = [l for l in locations if l["type"] == "city"]

    # Validate database counts
    if len(countries) != 120:
        print(f"FAIL: Expected 120 countries, found {len(countries)}")
        sys.exit(1)
    else:
        print(f"PASS: Verified 120 countries in SQLite db.")

    if len(cities) != 2400:
        print(f"FAIL: Expected 2400 cities, found {len(cities)}")
        sys.exit(1)
    else:
        print(f"PASS: Verified 2400 cities in SQLite db.")

    # Validate schemas and fields
    required_fields = ["id", "type", "name", "fullName", "summary", "description", "metrics"]
    required_description_fields = ["overview", "pros", "cons", "visaInfo"]
    
    # Fully expanded 31 metrics (including 5 specialized persona metrics)
    required_metrics = [
        "warm_weather", "seasonal_variety", "nature_mountains", "nature_lakes_rivers",
        "nature_sea_beaches", "nature_forests_greenery", "cost_of_living", "housing_affordability",
        "tax_burden", "visa_difficulty", "pace_of_life", "social_tolerance", "safety",
        "healthcare_quality", "english_barrier", "walkability_transit", "internet_speed", "work_culture",
        "humidity_level", "air_quality", "sunshine_hours", "childcare_education_cost", "dining_food_cost",
        "bureaucracy_difficulty", "foreigner_friendliness", "road_quality", "local_job_market",
        "phd_stipend_ppp", "academic_satisfaction", "happiness_index", "ease_of_doing_business", "childcare_quality"
    ]

    for loc in locations:
        # Check root fields
        for field in required_fields:
            if field not in loc or not loc[field]:
                print(f"FAIL: Location '{loc.get('id', 'unknown')}' is missing root field '{field}'")
                sys.exit(1)
        
        # Check description fields
        for field in required_description_fields:
            if field not in loc["description"] or not loc["description"][field]:
                print(f"FAIL: Location '{loc['id']}' is missing description field '{field}'")
                sys.exit(1)

        # Check metrics values
        for metric in required_metrics:
            if metric not in loc["metrics"]:
                print(f"FAIL: Location '{loc['id']}' is missing metric '{metric}'")
                sys.exit(1)
            val = loc["metrics"][metric]
            if not isinstance(val, (int, float)) or val < 0 or val > 10:
                print(f"FAIL: Location '{loc['id']}' metric '{metric}' value is invalid: {val} (must be 0-10)")
                sys.exit(1)
                
        # Check persona fields
        for p in ["phd", "family", "entrepreneur", "nomad"]:
            if p not in loc["personaData"]:
                print(f"FAIL: Location '{loc['id']}' is missing personaData override for '{p}'")
                sys.exit(1)
            if p not in loc["personaPros"] or len(loc["personaPros"][p]) == 0:
                print(f"FAIL: Location '{loc['id']}' is missing personaPros override for '{p}'")
                sys.exit(1)
            if p not in loc["personaCons"] or len(loc["personaCons"][p]) == 0:
                print(f"FAIL: Location '{loc['id']}' is missing personaCons override for '{p}'")
                sys.exit(1)
                
    print(f"PASS: All {len(locations)} locations strictly conform to schema & metric bounds and have persona data.")

    # Mock preferences containing all 26 metrics
    mock_prefs = {
        "warm_weather": {"value": 8, "importance": 6},
        "seasonal_variety": {"value": 4, "importance": 0},
        "nature_mountains": {"value": 10, "importance": 3},
        "nature_lakes_rivers": {"value": 10, "importance": 0},
        "nature_sea_beaches": {"value": 10, "importance": 10},
        "nature_forests_greenery": {"value": 10, "importance": 0},
        "cost_of_living": {"value": 3, "importance": 6},
        "housing_affordability": {"value": 10, "importance": 0},
        "tax_burden": {"value": 5, "importance": 0},
        "visa_difficulty": {"value": 10, "importance": 3},
        "pace_of_life": {"value": 3, "importance": 3},
        "social_tolerance": {"value": 10, "importance": 0},
        "safety": {"value": 10, "importance": 10},
        "healthcare_quality": {"value": 10, "importance": 6},
        "english_barrier": {"value": 10, "importance": 3},
        "walkability_transit": {"value": 10, "importance": 0},
        "internet_speed": {"value": 10, "importance": 6},
        "work_culture": {"value": 3, "importance": 0},
        "humidity_level": {"value": 4, "importance": 3},
        "air_quality": {"value": 10, "importance": 6},
        "sunshine_hours": {"value": 10, "importance": 3},
        "childcare_education_cost": {"value": 10, "importance": 0},
        "dining_food_cost": {"value": 10, "importance": 0},
        "bureaucracy_difficulty": {"value": 10, "importance": 3},
        "foreigner_friendliness": {"value": 10, "importance": 6},
        "road_quality": {"value": 10, "importance": 0},
        "local_job_market": {"value": 10, "importance": 0}
    }

    # Verify rankings for countries
    country_rankings = rank_locations(countries, mock_prefs)
    for i in range(len(country_rankings) - 1):
        if country_rankings[i]["score"] < country_rankings[i+1]["score"]:
            print("FAIL: Country rankings are not correctly sorted")
            sys.exit(1)
            
    # Verify rankings for cities
    city_rankings = rank_locations(cities, mock_prefs)
    for i in range(len(city_rankings) - 1):
        if city_rankings[i]["score"] < city_rankings[i+1]["score"]:
            print("FAIL: City rankings are not correctly sorted")
            sys.exit(1)

    print("PASS: Compatibility engine ranked and sorted countries and cities correctly in Python.")
    print(f"Top Country Match: {country_rankings[0]['location']['name']} ({country_rankings[0]['score']}% compatibility)")
    print(f"Top City Match: {city_rankings[0]['location']['name']} ({city_rankings[0]['score']}% compatibility)")

    print("All Python SQLite validation tests passed successfully!")

if __name__ == "__main__":
    run_tests()
