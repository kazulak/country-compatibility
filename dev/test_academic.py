# -*- coding: utf-8 -*-
"""
Country Compatibility Explorer - Academic Validation Tests
"""

import sys
from db_sqlite_academic import get_academic_entities
from engine_academic import rank_entities

def run_tests():
    print("Starting Country Compatibility Explorer Academic validation...")

    entities = get_academic_entities()

    # Filter by type
    unis = [e for e in entities if e["type"] == "university"]
    groups = [e for e in entities if e["type"] == "group"]

    # Validate database counts
    if len(unis) < 10:
        print(f"FAIL: Expected at least 10 universities, found {len(unis)}")
        sys.exit(1)
    else:
        print(f"PASS: Verified {len(unis)} universities in academic db.")

    if len(groups) < 10:
        print(f"FAIL: Expected at least 10 groups, found {len(groups)}")
        sys.exit(1)
    else:
        print(f"PASS: Verified {len(groups)} research groups in academic db.")

    required_fields = ["id", "type", "name", "fullName", "summary", "description", "metrics"]
    required_description_fields = ["overview", "pros", "cons", "visaInfo"]
    
    required_metrics = [
        "academic_reputation", "research_funding", "undergrad_experience", "phd_stipend_ppp",
        "research_freedom", "work_life_balance", "publication_output", "industry_collaboration",
        "local_infrastructure", "visa_ease_academic"
    ]

    for ent in entities:
        # Check root fields
        for field in required_fields:
            if field not in ent or ent[field] is None:
                print(f"FAIL: Entity '{ent.get('id', 'unknown')}' is missing root field '{field}'")
                sys.exit(1)
        
        # Check description fields
        for field in required_description_fields:
            if field not in ent["description"] or ent["description"][field] is None:
                print(f"FAIL: Entity '{ent['id']}' is missing description field '{field}'")
                sys.exit(1)

        # Check metrics values
        for metric in required_metrics:
            if metric not in ent["metrics"]:
                print(f"FAIL: Entity '{ent['id']}' is missing metric '{metric}'")
                sys.exit(1)
            val = ent["metrics"][metric]
            if not isinstance(val, (int, float)) or val < 0 or val > 10:
                print(f"FAIL: Entity '{ent['id']}' metric '{metric}' value is invalid: {val}")
                sys.exit(1)
                
        # Check persona fields
        for p in ["undergrad", "phd", "researcher"]:
            if p not in ent["personaData"]:
                print(f"FAIL: Entity '{ent['id']}' is missing personaData for '{p}'")
                sys.exit(1)
            if p not in ent["personaPros"]:
                print(f"FAIL: Entity '{ent['id']}' is missing personaPros for '{p}'")
                sys.exit(1)
            if p not in ent["personaCons"]:
                print(f"FAIL: Entity '{ent['id']}' is missing personaCons for '{p}'")
                sys.exit(1)

    print(f"PASS: All {len(entities)} academic entities strictly conform to schema & metric bounds.")

    # Mock academic preferences
    mock_prefs = {
        "academic_reputation": {"importance": 10},
        "research_funding": {"importance": 10},
        "undergrad_experience": {"importance": 6},
        "phd_stipend_ppp": {"importance": 6},
        "research_freedom": {"importance": 6},
        "work_life_balance": {"importance": 6},
        "publication_output": {"importance": 10},
        "industry_collaboration": {"importance": 0},
        "local_infrastructure": {"importance": 10},
        "visa_ease_academic": {"importance": 0}
    }

    # Verify rankings for universities
    uni_rankings = rank_entities(unis, mock_prefs)
    for i in range(len(uni_rankings) - 1):
        if uni_rankings[i]["score"] < uni_rankings[i+1]["score"]:
            print("FAIL: University rankings are not correctly sorted")
            sys.exit(1)
            
    # Verify rankings for groups
    group_rankings = rank_entities(groups, mock_prefs)
    for i in range(len(group_rankings) - 1):
        if group_rankings[i]["score"] < group_rankings[i+1]["score"]:
            print("FAIL: Group rankings are not correctly sorted")
            sys.exit(1)

    print("PASS: Compatibility engine ranked and sorted universities and groups correctly.")
    print(f"Top University Match: {uni_rankings[0]['location']['name']} ({uni_rankings[0]['score']}% compatibility)")
    print(f"Top Group Match: {group_rankings[0]['location']['name']} ({group_rankings[0]['score']}% compatibility)")

    print("All Academic validation tests passed successfully!")

if __name__ == "__main__":
    run_tests()
