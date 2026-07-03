# -*- coding: utf-8 -*-
"""
Country Compatibility Explorer - Academic Compatibility Engine
Calculates the match score between user academic preferences and university/group metrics.
"""

# Academic metrics and their types
ACADEMIC_METRIC_TYPES = {
    "academic_reputation": {"type": "maximize", "label": "Academic Reputation (Shanghai Rank)"},
    "research_funding": {"type": "maximize", "label": "Research Lab Funding"},
    "undergrad_experience": {"type": "maximize", "label": "Undergrad Teaching Quality"},
    "phd_stipend_ppp": {"type": "maximize", "label": "PhD Stipend relative to PPP"},
    "research_freedom": {"type": "maximize", "label": "Research Freedom & Autonomy"},
    "work_life_balance": {"type": "maximize", "label": "Work-Life Balance (low stress)"},
    "publication_output": {"type": "maximize", "label": "Publication Output in Top Journals"},
    "industry_collaboration": {"type": "maximize", "label": "Industry Collaboration & Spin-offs"},
    "local_infrastructure": {"type": "maximize", "label": "Local Lab Infrastructure"},
    "visa_ease_academic": {"type": "maximize", "label": "Academic Visa & Travel Ease"}
}

def calculate_entity_compatibility(entity, preferences):
    """
    Calculates compatibility for a single academic entity (university or group) based on user preferences.
    """
    total_weighted_score = 0.0
    total_weight = 0.0
    breakdown = []

    for key, config in ACADEMIC_METRIC_TYPES.items():
        pref = preferences.get(key, {"value": 5, "importance": 0})
        weight = float(pref.get("importance", 0))

        if weight == 0.0:
            continue

        # Get entity's rating. Fallback to 5.0
        location_value = float(entity["metrics"].get(key, 5.0))
        
        # Maximize: score is value / 10.0
        metric_score = location_value / 10.0

        total_weighted_score += metric_score * weight
        total_weight += weight

        breakdown.append({
            "key": key,
            "label": config["label"],
            "type": config["type"],
            "locationValue": int(location_value) if location_value.is_integer() else location_value,
            "userTarget": 10,
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
        "entityId": entity["id"],
        "score": compatibility_score,
        "breakdown": breakdown
    }

def rank_entities(entities_list, preferences):
    """
    Calculates compatibility for all entities and ranks them.
    """
    results = []
    for ent in entities_list:
        compat = calculate_entity_compatibility(ent, preferences)
        results.append({
            "location": ent, # Maintain "location" wrapper in API response to match client keys
            "score": compat["score"],
            "breakdown": compat["breakdown"]
        })
    
    # Sort by score descending, then by entity name ascending
    results.sort(key=lambda x: (-x["score"], x["location"]["name"]))
    return results
