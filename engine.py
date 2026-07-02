# -*- coding: utf-8 -*-
"""
Country Compatibility Explorer - Compatibility Engine
Calculates the match score between user preferences and location metrics in Python.
"""

# Define the metrics and their types
METRIC_TYPES = {
    # Climate & Nature (Core)
    "warm_weather": {"type": "preference", "label": "Warm Weather"},
    "seasonal_variety": {"type": "preference", "label": "Seasonal Variety"},
    "nature_mountains": {"type": "maximize", "label": "Mountains & Alpine hiking"},
    "nature_lakes_rivers": {"type": "maximize", "label": "Lakes & Rivers"},
    "nature_sea_beaches": {"type": "maximize", "label": "Sea & Beaches"},
    "nature_forests_greenery": {"type": "maximize", "label": "Forests & Greenery"},
    
    # Climate & Nature (Advanced Extra)
    "humidity_level": {"type": "preference", "label": "Humidity Level"},
    "air_quality": {"type": "maximize", "label": "Air Quality"},
    "sunshine_hours": {"type": "maximize", "label": "Sunshine Hours"},

    # Cost & Visas (Core)
    "cost_of_living": {"type": "preference", "label": "Cost of Living"},
    "housing_affordability": {"type": "maximize", "label": "Housing Affordability"},
    "tax_burden": {"type": "preference", "label": "Tax Burden"},
    "visa_difficulty": {"type": "maximize", "label": "Visa & Residency Ease"},
    
    # Cost & Visas (Advanced Extra)
    "childcare_education_cost": {"type": "maximize", "label": "Childcare & School Affordability"},
    "dining_food_cost": {"type": "maximize", "label": "Cheap Food & Dining Costs"},

    # Society & Culture (Core)
    "pace_of_life": {"type": "preference", "label": "Pace of Life"},
    "safety": {"type": "maximize", "label": "Safety & Low Crime"},
    "healthcare_quality": {"type": "maximize", "label": "Healthcare Quality"},
    "english_barrier": {"type": "maximize", "label": "English-Friendly (No local language needed)"},
    
    # Society & Culture (Advanced Extra)
    "social_tolerance": {"type": "maximize", "label": "Social Tolerance & Progressiveness"},
    "bureaucracy_difficulty": {"type": "maximize", "label": "Bureaucracy Ease (Digital/Simple)"},
    "foreigner_friendliness": {"type": "maximize", "label": "Friendliness to Foreigners"},

    # Infrastructure & Work (Core)
    "walkability_transit": {"type": "maximize", "label": "Walkability & Public Transit"},
    "internet_speed": {"type": "maximize", "label": "Internet Speed & Connectivity"},
    "work_culture": {"type": "preference", "label": "Work Culture"},
    
    # Infrastructure & Work (Advanced Extra)
    "road_quality": {"type": "maximize", "label": "Road & Infrastructure Quality"},
    "local_job_market": {"type": "maximize", "label": "Local Job Market Strength"},

    # Specialized Persona Metrics (Advanced / Custom)
    "phd_stipend_ppp": {"type": "maximize", "label": "PhD Stipend Value (PPP)"},
    "academic_satisfaction": {"type": "maximize", "label": "Academic & Research Satisfaction"},
    "happiness_index": {"type": "maximize", "label": "World Happiness Index"},
    "ease_of_doing_business": {"type": "maximize", "label": "Ease of Doing Business"},
    "childcare_quality": {"type": "maximize", "label": "Childcare & Schooling Quality"}
}

def calculate_location_compatibility(location, preferences):
    """
    Calculates compatibility for a single location based on user preferences.
    
    :param location: The location dictionary from db.py
    :param preferences: User preferences map, e.g.:
      {
        "warm_weather": {"value": 7, "importance": 8},
        "safety": {"importance": 9}
      }
    :returns: A dictionary containing score and metric breakdowns
    """
    total_weighted_score = 0.0
    total_weight = 0.0
    breakdown = []

    for key, config in METRIC_TYPES.items():
        pref = preferences.get(key, {"value": 5, "importance": 0})
        weight = float(pref.get("importance", 0))

        if weight == 0.0:
            continue  # Ignore this metric if user doesn't care

        # Get location's rating. Handle inverted metrics in the engine
        location_value = float(location["metrics"].get(key, 5))
        
        if key == "visa_difficulty":
            # In database, visa_difficulty 0 = easy, 10 = hard. 
            # We invert to maximize "Residency Ease":
            location_value = 10.0 - location_value
        elif key == "english_barrier":
            # In database, english_barrier 0 = easy (English spoken), 10 = hard.
            # We invert to maximize "English-Friendly":
            location_value = 10.0 - location_value

        metric_score = 0.0

        if config["type"] == "maximize":
            # Maximize metrics: match is directly proportional to location value
            metric_score = location_value / 10.0
        else:
            # Preference metrics: match is based on distance to user target value
            target_value = float(pref.get("value", 5))
            distance = abs(target_value - location_value)
            metric_score = 1.0 - (distance / 10.0)

        total_weighted_score += metric_score * weight
        total_weight += weight

        breakdown.append({
            "key": key,
            "label": config["label"],
            "type": config["type"],
            "locationValue": int(location_value) if location_value.is_integer() else location_value,
            "userTarget": int(pref.get("value", 5)) if config["type"] == "preference" else 10,
            "importance": int(weight),
            "metricScore": int(round(metric_score * 100))
        })

    # Calculate final compatibility percentage
    if total_weight > 0.0:
        compatibility_score = int(round((total_weighted_score / total_weight) * 100))
    else:
        compatibility_score = 100

    # Sort breakdown: highest matches first
    breakdown.sort(key=lambda x: x["metricScore"], reverse=True)

    return {
        "locationId": location["id"],
        "score": compatibility_score,
        "breakdown": breakdown
    }

def rank_locations(locations_list, preferences):
    """
    Calculates compatibility for all locations and ranks them.
    
    :param locations_list: List of locations
    :param preferences: User preferences map
    :returns: List of ranked results sorted by score descending
    """
    results = []
    for loc in locations_list:
        compat = calculate_location_compatibility(loc, preferences)
        results.append({
            "location": loc,
            "score": compat["score"],
            "breakdown": compat["breakdown"]
        })
    
    # Sort by score descending, then by location name ascending
    results.sort(key=lambda x: (-x["score"], x["location"]["name"]))
    return results
