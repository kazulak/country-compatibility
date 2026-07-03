# -*- coding: utf-8 -*-
"""
Country Compatibility Explorer - Academic Seeder
Creates and populates the academic.db SQLite database with world-class universities,
discipline-specific faculties, and advanced research groups.
"""

import os
import sqlite3

DB_FILE = "academic.db"

def create_schema(conn):
    cursor = conn.cursor()
    
    # 1. Academic Entities Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS academic_entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,          -- 'university' or 'group'
        name TEXT NOT NULL,
        fullName TEXT NOT NULL,
        universityName TEXT,
        discipline TEXT,             -- 'Physics', 'Mathematics', 'Computer Science', 'Arts'
        subDomain TEXT,              -- 'Quantum Computing', 'Tensor Networks', 'Algebraic Geometry', etc.
        parentId TEXT,               -- References university entity ID if type is 'group'
        cityName TEXT NOT NULL,
        countryName TEXT NOT NULL,
        shanghaiRank INTEGER,        -- Global Shanghai Ranking
        summary TEXT NOT NULL,
        overview TEXT NOT NULL,
        visaInfo TEXT NOT NULL
    )
    """)
    
    # 2. Academic Metrics Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS academic_metrics (
        entity_id TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        metric_value REAL NOT NULL,  -- 0.0 to 10.0
        PRIMARY KEY (entity_id, metric_name),
        FOREIGN KEY(entity_id) REFERENCES academic_entities(id)
    )
    """)
    
    # 3. Academic General Pros and Cons
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS academic_pros (
        entity_id TEXT NOT NULL,
        content TEXT NOT NULL,
        FOREIGN KEY(entity_id) REFERENCES academic_entities(id)
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS academic_cons (
        entity_id TEXT NOT NULL,
        content TEXT NOT NULL,
        FOREIGN KEY(entity_id) REFERENCES academic_entities(id)
    )
    """)
    
    # 4. Academic Persona Overrides (undergrad, phd, researcher)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS academic_persona_data (
        entity_id TEXT NOT NULL,
        persona TEXT NOT NULL,       -- 'undergrad', 'phd', 'researcher'
        summary TEXT NOT NULL,
        overview TEXT NOT NULL,
        PRIMARY KEY (entity_id, persona),
        FOREIGN KEY(entity_id) REFERENCES academic_entities(id)
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS academic_persona_pros (
        entity_id TEXT NOT NULL,
        persona TEXT NOT NULL,
        content TEXT NOT NULL,
        FOREIGN KEY(entity_id) REFERENCES academic_entities(id)
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS academic_persona_cons (
        entity_id TEXT NOT NULL,
        persona TEXT NOT NULL,
        content TEXT NOT NULL,
        FOREIGN KEY(entity_id) REFERENCES academic_entities(id)
    )
    """)
    
    conn.commit()

def insert_university(conn, u_id, name, city, country, shanghai_rank, summary, overview, visa_info, metrics):
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO academic_entities 
        (id, type, name, fullName, universityName, discipline, subDomain, parentId, cityName, countryName, shanghaiRank, summary, overview, visaInfo)
        VALUES (?, 'university', ?, ?, '', '', '', '', ?, ?, ?, ?, ?, ?)
    """, (u_id, name, name, city, country, shanghai_rank, summary, overview, visa_info))
    
    for metric, val in metrics.items():
        cursor.execute("""
            INSERT OR REPLACE INTO academic_metrics (entity_id, metric_name, metric_value)
            VALUES (?, ?, ?)
        """, (u_id, metric, val))
        
    # Default general pros/cons
    pros = [
        f"Prestigious global reputation (Shanghai Rank: #{shanghai_rank})",
        f"Located in the vibrant academic hub of {city}, {country}",
        "Strong international campus and student diversity"
    ]
    cons = [
        "High cost of local student housing",
        "Competitive environment with high entry requirements"
    ]
    for p in pros:
        cursor.execute("INSERT INTO academic_pros (entity_id, content) VALUES (?, ?)", (u_id, p))
    for c in cons:
        cursor.execute("INSERT INTO academic_cons (entity_id, content) VALUES (?, ?)", (u_id, c))
        
    # Populate persona fallbacks
    for p in ["undergrad", "phd", "researcher"]:
        cursor.execute("""
            INSERT OR REPLACE INTO academic_persona_data (entity_id, persona, summary, overview)
            VALUES (?, ?, ?, ?)
        """, (u_id, p, f"Excellent {p} track at {name}.", f"Detailed guide for {p} candidates studying at {name} in {city}."))
        
        cursor.execute("INSERT INTO academic_persona_pros (entity_id, persona, content) VALUES (?, ?, ?)", (u_id, p, f"Great peer support for {p}s"))
        cursor.execute("INSERT INTO academic_persona_cons (entity_id, persona, content) VALUES (?, ?, ?)", (u_id, p, f"High workload typical of {p} studies"))

def insert_group(conn, g_id, parent_id, name, discipline, subdomain, city, country, summary, overview, metrics, u_name):
    cursor = conn.cursor()
    full_name = f"{name}, {u_name}"
    
    # Retrieve Shanghai rank of parent
    cursor.execute("SELECT shanghaiRank FROM academic_entities WHERE id = ?", (parent_id,))
    row = cursor.fetchone()
    parent_rank = row[0] if row else 100
    
    cursor.execute("""
        INSERT OR REPLACE INTO academic_entities 
        (id, type, name, fullName, universityName, discipline, subDomain, parentId, cityName, countryName, shanghaiRank, summary, overview, visaInfo)
        VALUES (?, 'group', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Academic visa process is tied to institutional sponsorship.')
    """, (g_id, name, full_name, u_name, discipline, subdomain, parent_id, city, country, parent_rank, summary, overview))
    
    for metric, val in metrics.items():
        cursor.execute("""
            INSERT OR REPLACE INTO academic_metrics (entity_id, metric_name, metric_value)
            VALUES (?, ?, ?)
        """, (g_id, metric, val))
        
    # Seed specific pros and cons for this research group
    pros = [
        f"World-class focus in {subdomain}",
        f"State-of-the-art laboratory infrastructure for {discipline}",
        "High publication rate in top journals (Nature/Science/ACM)"
    ]
    cons = [
        "Intense research deadlines and milestone pressure",
        "Limited slots available for new researchers"
    ]
    for p in pros:
        cursor.execute("INSERT INTO academic_pros (entity_id, content) VALUES (?, ?)", (g_id, p))
    for c in cons:
        cursor.execute("INSERT INTO academic_cons (entity_id, content) VALUES (?, ?)", (g_id, c))
        
    # Populate persona summaries
    # Undergrad
    cursor.execute("""
        INSERT OR REPLACE INTO academic_persona_data (entity_id, persona, summary, overview)
        VALUES (?, 'undergrad', ?, ?)
    """, (g_id, f"Top undergrad introduction to {subdomain} at {u_name}.", 
          f"Undergraduate students get early exposure to state-of-the-art labs doing research in {subdomain}."))
    cursor.execute("INSERT INTO academic_persona_pros (entity_id, persona, content) VALUES (?, ?, ?)", (g_id, 'undergrad', "Opportunities for undergraduate research assistantships"))
    cursor.execute("INSERT INTO academic_persona_cons (entity_id, persona, content) VALUES (?, ?, ?)", (g_id, 'undergrad', "Coursework demands are extremely rigorous"))

    # PhD
    cursor.execute("""
        INSERT OR REPLACE INTO academic_persona_data (entity_id, persona, summary, overview)
        VALUES (?, 'phd', ?, ?)
    """, (g_id, f"Prestigious PhD track focusing on {subdomain}.", 
          f"Detailed research guide for doctoral researchers studying {subdomain} at {u_name}. Offers generous stipends and publication opportunities."))
    cursor.execute("INSERT INTO academic_persona_pros (entity_id, persona, content) VALUES (?, ?, ?)", (g_id, 'phd', "High publication output in top-tier conferences"))
    cursor.execute("INSERT INTO academic_persona_cons (entity_id, persona, content) VALUES (?, ?, ?)", (g_id, 'phd', "Competitive milestone reviews"))

    # Researcher
    cursor.execute("""
        INSERT OR REPLACE INTO academic_persona_data (entity_id, persona, summary, overview)
        VALUES (?, 'researcher', ?, ?)
    """, (g_id, f"Autonomy-first postdoctoral research in {subdomain}.", 
          f"Postdocs and researchers enjoy high academic freedom and generous research grants in the {name} group."))
    cursor.execute("INSERT INTO academic_persona_pros (entity_id, persona, content) VALUES (?, ?, ?)", (g_id, 'researcher', "Generous lab budgets and state-of-the-art supercomputing access"))
    cursor.execute("INSERT INTO academic_persona_cons (entity_id, persona, content) VALUES (?, ?, ?)", (g_id, 'researcher', "High pressure to secure external project grants"))

def main():
    import json
    import random

    print(f"Initializing Academic database at: {DB_FILE}")
    if os.path.exists(DB_FILE):
        print(f"Removing existing database file: {DB_FILE}")
        os.remove(DB_FILE)
        
    conn = sqlite3.connect(DB_FILE)
    create_schema(conn)
    
    # Load domains hierarchy
    current_dir = os.path.dirname(os.path.abspath(__file__))
    domains_file = os.path.join(current_dir, "data", "academic_domains.json")
    with open(domains_file, "r", encoding="utf-8") as f:
        domains_data = json.load(f)

    # Extract all (discipline, subdomain) pairs
    discipline_subdomains = {}
    for cat_name, disciplines in domains_data.items():
        for disc_name, subs in disciplines.items():
            if disc_name not in discipline_subdomains:
                discipline_subdomains[disc_name] = []
            discipline_subdomains[disc_name].extend(subs)

    core_universities = [
        ("harvard", "Harvard University", "Cambridge", "USA", 1, "US"),
        ("stanford", "Stanford University", "Stanford", "USA", 2, "US"),
        ("mit", "MIT", "Cambridge", "USA", 3, "US"),
        ("berkeley", "UC Berkeley", "Berkeley", "USA", 5, "US"),
        ("princeton", "Princeton University", "Princeton", "USA", 6, "US"),
        ("columbia", "Columbia University", "New York", "USA", 8, "US"),
        ("caltech", "Caltech", "Pasadena", "USA", 9, "US"),
        ("chicago", "University of Chicago", "Chicago", "USA", 10, "US"),
        ("yale", "Yale University", "New Haven", "USA", 11, "US"),
        ("cornell", "Cornell University", "Ithaca", "USA", 12, "US"),
        ("ucla", "UCLA", "Los Angeles", "USA", 13, "US"),
        ("upenn", "University of Pennsylvania", "Philadelphia", "USA", 14, "US"),
        ("ucsd", "UC San Diego", "La Jolla", "USA", 16, "US"),
        ("jhu", "Johns Hopkins University", "Baltimore", "USA", 17, "US"),
        ("nyu", "New York University", "New York", "USA", 22, "US"),
        ("umich", "University of Michigan", "Ann Arbor", "USA", 26, "US"),
        ("uw", "University of Washington", "Seattle", "USA", 29, "US"),
        ("utexas", "University of Texas at Austin", "Austin", "USA", 37, "US"),
        ("wisconsin", "University of Wisconsin-Madison", "Madison", "USA", 39, "US"),
        ("uiuc", "UIUC", "Urbana", "USA", 45, "US"),
        ("gatech", "Georgia Institute of Technology", "Atlanta", "USA", 70, "US"),
        ("cmu", "Carnegie Mellon University", "Pittsburgh", "USA", 95, "US"),
        ("cambridge", "University of Cambridge", "Cambridge", "UK", 4, "UK"),
        ("oxford", "University of Oxford", "Oxford", "UK", 7, "UK"),
        ("ucl", "UCL", "London", "UK", 18, "UK"),
        ("imperial", "Imperial College London", "London", "UK", 20, "UK"),
        ("edinburgh", "University of Edinburgh", "Edinburgh", "UK", 35, "UK"),
        ("manchester", "University of Manchester", "Manchester", "UK", 38, "UK"),
        ("kcl", "King's College London", "London", "UK", 48, "UK"),
        ("bristol", "University of Bristol", "Bristol", "UK", 64, "UK"),
        ("warwick", "University of Warwick", "Coventry", "UK", 101, "UK"),
        ("glasgow", "University of Glasgow", "Glasgow", "UK", 120, "UK"),
        ("eth_zurich", "ETH Zurich", "Zurich", "Switzerland", 15, "CH"),
        ("epfl", "EPFL", "Lausanne", "Switzerland", 75, "CH"),
        ("sorbonne", "Sorbonne University", "Paris", "France", 35, "FR"),
        ("psl", "Paris Sciences et Lettres", "Paris", "France", 40, "FR"),
        ("saclay", "Paris-Saclay University", "Gif-sur-Yvette", "France", 14, "FR"),
        ("tum", "Technical University of Munich", "Munich", "Germany", 56, "DE"),
        ("lmu", "LMU Munich", "Munich", "Germany", 57, "DE"),
        ("heidelberg", "Heidelberg University", "Heidelberg", "Germany", 70, "DE"),
        ("utrecht", "Utrecht University", "Utrecht", "Netherlands", 52, "NL"),
        ("leiden", "Leiden University", "Leiden", "Netherlands", 80, "NL"),
        ("uva", "University of Amsterdam", "Amsterdam", "Netherlands", 101, "NL"),
        ("delft", "TU Delft", "Delft", "Netherlands", 151, "NL"),
        ("copenhagen", "University of Copenhagen", "Copenhagen", "Denmark", 30, "DK"),
        ("aarhus", "Aarhus University", "Aarhus", "Denmark", 78, "DK"),
        ("karolinska", "Karolinska Institute", "Stockholm", "Sweden", 41, "SE"),
        ("uppsala", "Uppsala University", "Uppsala", "Sweden", 77, "SE"),
        ("kth", "KTH Royal Institute of Technology", "Stockholm", "Sweden", 201, "SE"),
        ("helsinki", "University of Helsinki", "Helsinki", "Finland", 99, "FI"),
        ("oslo", "University of Oslo", "Oslo", "Norway", 67, "NO"),
        ("warsaw", "University of Warsaw", "Warsaw", "Poland", 350, "PL"),
        ("jagiellonian", "Jagiellonian University", "Krakow", "Poland", 401, "PL"),
        ("charles", "Charles University", "Prague", "Czechia", 301, "CZ"),
        ("elte", "Eotvos Lorand University", "Budapest", "Hungary", 501, "HU"),
        ("vienna", "University of Vienna", "Vienna", "Austria", 151, "AT"),
        ("bologna", "University of Bologna", "Bologna", "Italy", 152, "IT"),
        ("sapienza", "Sapienza University of Rome", "Rome", "Italy", 110, "IT"),
        ("barcelona", "University of Barcelona", "Barcelona", "Spain", 153, "ES"),
        ("coimbra", "University of Coimbra", "Coimbra", "Portugal", 401, "PT"),
        ("tokyo", "University of Tokyo", "Tokyo", "Japan", 24, "JP"),
        ("kyoto", "Kyoto University", "Kyoto", "Japan", 36, "JP"),
        ("osaka", "Osaka University", "Osaka", "Japan", 151, "JP"),
        ("snu", "Seoul National University", "Seoul", "South Korea", 101, "KR"),
        ("kaist", "KAIST", "Daejeon", "South Korea", 201, "KR"),
        ("nus", "National University of Singapore", "Singapore", "Singapore", 71, "SG"),
        ("ntu", "Nanyang Technological University", "Singapore", "Singapore", 91, "SG"),
        ("hku", "University of Hong Kong", "Hong Kong", "China", 101, "HK"),
        ("hkust", "HKUST", "Hong Kong", "China", 201, "HK"),
        ("cuhk", "Chinese University of Hong Kong", "Hong Kong", "China", 102, "HK"),
        ("tsinghua", "Tsinghua University", "Beijing", "China", 26, "CN"),
        ("peking", "Peking University", "Beijing", "China", 30, "CN"),
        ("fudan", "Fudan University", "Shanghai", "China", 60, "CN"),
        ("sjtu", "Shanghai Jiao Tong University", "Shanghai", "China", 46, "CN"),
        ("zhejiang", "Zhejiang University", "Hangzhou", "China", 50, "CN"),
        ("melbourne", "University of Melbourne", "Melbourne", "Australia", 32, "AU"),
        ("sydney", "University of Sydney", "Sydney", "Australia", 60, "AU"),
        ("unsw", "UNSW Sydney", "Sydney", "Australia", 74, "AU"),
        ("anu", "Australian National University", "Canberra", "Australia", 79, "AU"),
        ("auckland", "University of Auckland", "Auckland", "New Zealand", 201, "NZ"),
        ("toronto", "University of Toronto", "Toronto", "Canada", 22, "CA"),
        ("ubc", "University of British Columbia", "Vancouver", "Canada", 35, "CA"),
        ("mcgill", "McGill University", "Montreal", "Canada", 70, "CA"),
        ("waterloo", "University of Waterloo", "Waterloo", "Canada", 151, "CA"),
        ("unam", "UNAM", "Mexico City", "Mexico", 201, "MX"),
        ("usp", "University of Sao Paulo", "Sao Paulo", "Brazil", 101, "BR"),
        ("uba", "University of Buenos Aires", "Buenos Aires", "Argentina", 201, "AR"),
        ("uct", "University of Cape Town", "Cape Town", "South Africa", 250, "ZA"),
        ("wits", "University of the Witwatersrand", "Johannesburg", "South Africa", 301, "ZA"),
        ("cairo", "Cairo University", "Cairo", "Egypt", 350, "EG"),
        ("huji", "Hebrew University of Jerusalem", "Jerusalem", "Israel", 86, "IL"),
        ("technion", "Technion", "Haifa", "Israel", 101, "IL"),
        ("kaust", "KAUST", "Thuwal", "Saudi Arabia", 201, "SA"),
        ("istanbul", "Istanbul University", "Istanbul", "Turkey", 401, "TR"),
    ]

    cities_for_generation = [
        ("Geneva", "Switzerland", "CH", 100, 300),
        ("Basel", "Switzerland", "CH", 120, 250),
        ("Hamburg", "Germany", "DE", 200, 400),
        ("Cologne", "Germany", "DE", 200, 450),
        ("Frankfurt", "Germany", "DE", 150, 350),
        ("Stuttgart", "Germany", "DE", 250, 500),
        ("Karlsruhe", "Germany", "DE", 250, 450),
        ("Groningen", "Netherlands", "NL", 100, 250),
        ("Rotterdam", "Netherlands", "NL", 120, 300),
        ("Nijmegen", "Netherlands", "NL", 150, 300),
        ("Eindhoven", "Netherlands", "NL", 200, 400),
        ("Ghent", "Belgium", "BE", 100, 250),
        ("Brussels", "Belgium", "BE", 150, 350),
        ("Leuven", "Belgium", "BE", 80, 200),
        ("Stockholm", "Sweden", "SE", 150, 300),
        ("Gothenburg", "Sweden", "SE", 180, 350),
        ("Trondheim", "Norway", "NO", 200, 450),
        ("Bergen", "Norway", "NO", 250, 450),
        ("Krakow", "Poland", "PL", 350, 500),
        ("Wroclaw", "Poland", "PL", 500, 800),
        ("Poznan", "Poland", "PL", 600, 900),
        ("Gdansk", "Poland", "PL", 700, 1000),
        ("Prague", "Czechia", "CZ", 350, 600),
        ("Brno", "Czechia", "CZ", 500, 800),
        ("Budapest", "Hungary", "HU", 450, 750),
        ("Vienna", "Austria", "AT", 150, 350),
        ("Graz", "Austria", "AT", 300, 600),
        ("Innsbruck", "Austria", "AT", 250, 500),
        ("Bologna", "Italy", "IT", 160, 300),
        ("Pisa", "Italy", "IT", 150, 350),
        ("Padua", "Italy", "IT", 150, 300),
        ("Turin", "Italy", "IT", 200, 400),
        ("Florence", "Italy", "IT", 200, 450),
        ("Naples", "Italy", "IT", 250, 500),
        ("Genoa", "Italy", "IT", 300, 550),
        ("Trieste", "Italy", "IT", 300, 600),
        ("Madrid", "Spain", "ES", 200, 450),
        ("Barcelona", "Spain", "ES", 180, 400),
        ("Valencia", "Spain", "ES", 300, 550),
        ("Seville", "Spain", "ES", 400, 700),
        ("Porto", "Portugal", "PT", 300, 550),
        ("Paris", "France", "FR", 100, 400),
        ("Lyon", "France", "FR", 200, 450),
        ("Marseille", "France", "FR", 250, 500),
        ("Toulouse", "France", "FR", 250, 480),
        ("Strasbourg", "France", "FR", 180, 380),
        ("Bordeaux", "France", "FR", 220, 450),
        ("Grenoble", "France", "FR", 150, 350),
        ("Lille", "France", "FR", 300, 600),
        ("Nice", "France", "FR", 350, 650),
        ("Montpellier", "France", "FR", 200, 450),
        ("Kyoto", "Japan", "JP", 100, 300),
        ("Osaka", "Japan", "JP", 150, 350),
        ("Nagoya", "Japan", "JP", 120, 280),
        ("Tohoku", "Japan", "JP", 130, 300),
        ("Kyushu", "Japan", "JP", 180, 380),
        ("Hokkaido", "Japan", "JP", 200, 400),
        ("Tsukuba", "Japan", "JP", 220, 450),
        ("Kobe", "Japan", "JP", 250, 500),
        ("Hiroshima", "Japan", "JP", 300, 600),
        ("Daejeon", "South Korea", "KR", 150, 350),
        ("Pohang", "South Korea", "KR", 180, 380),
        ("Ulsan", "South Korea", "KR", 250, 500),
        ("Gwangju", "South Korea", "KR", 300, 600),
        ("Busan", "South Korea", "KR", 350, 650),
        ("Singapore", "Singapore", "SG", 100, 200),
        ("Hong Kong", "China", "HK", 120, 250),
        ("Beijing", "China", "CN", 50, 200),
        ("Shanghai", "China", "CN", 80, 250),
        ("Nanjing", "China", "CN", 100, 280),
        ("Wuhan", "China", "CN", 110, 300),
        ("Xi'an", "China", "CN", 150, 350),
        ("Chengdu", "China", "CN", 150, 350),
        ("Guangzhou", "China", "CN", 120, 300),
        ("Tianjin", "China", "CN", 200, 450),
        ("Harbin", "China", "CN", 180, 380),
        ("Sydney", "Australia", "AU", 100, 250),
        ("Melbourne", "Australia", "AU", 100, 250),
        ("Brisbane", "Australia", "AU", 120, 300),
        ("Adelaide", "Australia", "AU", 150, 350),
        ("Perth", "Australia", "AU", 180, 380),
        ("Auckland", "New Zealand", "NZ", 180, 350),
        ("Christchurch", "New Zealand", "NZ", 250, 500),
        ("Wellington", "New Zealand", "NZ", 300, 600),
        ("Toronto", "Canada", "CA", 100, 250),
        ("Montreal", "Canada", "CA", 120, 300),
        ("Vancouver", "Canada", "CA", 100, 250),
        ("Ottawa", "Canada", "CA", 200, 450),
        ("Calgary", "Canada", "CA", 180, 380),
        ("Edmonton", "Canada", "CA", 180, 400),
        ("Quebec City", "Canada", "CA", 250, 500),
        ("Halifax", "Canada", "CA", 350, 650),
        ("London", "UK", "UK", 150, 350),
        ("Leeds", "UK", "UK", 120, 300),
        ("Birmingham", "UK", "UK", 130, 300),
        ("Sheffield", "UK", "UK", 150, 350),
        ("Nottingham", "UK", "UK", 140, 320),
        ("Southampton", "UK", "UK", 120, 300),
        ("Newcastle", "UK", "UK", 180, 380),
        ("Liverpool", "UK", "UK", 150, 350),
        ("Cardiff", "UK", "UK", 200, 450),
        ("Belfast", "UK", "UK", 250, 500),
        ("Aberdeen", "UK", "UK", 250, 500),
        ("New York", "USA", "US", 100, 300),
        ("Boston", "USA", "US", 100, 300),
        ("Philadelphia", "USA", "US", 150, 350),
        ("Pittsburgh", "USA", "US", 150, 350),
        ("Minneapolis", "USA", "US", 120, 300),
        ("Columbus", "USA", "US", 150, 350),
        ("Chapel Hill", "USA", "US", 80, 250),
        ("Boulder", "USA", "US", 150, 350),
        ("Houston", "USA", "US", 180, 400),
        ("Dallas", "USA", "US", 250, 500),
        ("Atlanta", "USA", "US", 120, 300),
        ("Miami", "USA", "US", 300, 600),
    ]

    university_list = []
    used_ids = set()
    for u_id, name, city, country, rank, region in core_universities:
        university_list.append({
            "id": u_id, "name": name, "city": city, "country": country, "rank": rank, "region": region
        })
        used_ids.add(u_id)

    idx = 1
    for city, country, region, min_r, max_r in cities_for_generation:
        if len(university_list) >= 210:
            break
        u_id = f"univ_{city.lower().replace(' ', '_')}_{idx}"
        if u_id in used_ids:
            continue
        
        name_patterns = [
            f"University of {city}",
            f"{city} State University",
            f"Technical University of {city}" if region in ["DE", "CH", "NL", "PL"] else f"{city} Institute of Technology"
        ]
        name = name_patterns[idx % len(name_patterns)]
        rank = random.randint(min_r, max_r)
        
        university_list.append({
            "id": u_id, "name": name, "city": city, "country": country, "rank": rank, "region": region
        })
        used_ids.add(u_id)
        idx += 1

    def generate_metrics(rank, region):
        if rank <= 10:
            rep = random.uniform(9.6, 10.0)
            fund = random.uniform(9.5, 10.0)
            pub = random.uniform(9.5, 10.0)
        elif rank <= 50:
            rep = random.uniform(8.8, 9.5)
            fund = random.uniform(8.5, 9.4)
            pub = random.uniform(8.5, 9.4)
        elif rank <= 150:
            rep = random.uniform(7.8, 8.7)
            fund = random.uniform(7.5, 8.4)
            pub = random.uniform(7.5, 8.4)
        elif rank <= 300:
            rep = random.uniform(6.5, 7.7)
            fund = random.uniform(6.0, 7.4)
            pub = random.uniform(6.0, 7.4)
        else:
            rep = random.uniform(4.5, 6.4)
            fund = random.uniform(4.0, 5.9)
            pub = random.uniform(4.0, 5.9)

        if region == "US":
            visa = random.uniform(5.0, 5.5)
            stipend = random.uniform(6.5, 7.5)
        elif region == "UK":
            visa = random.uniform(6.5, 7.0)
            stipend = random.uniform(6.0, 7.0)
        elif region == "CH":
            visa = random.uniform(7.0, 7.8)
            stipend = random.uniform(9.2, 9.7)
        elif region in ["DE", "NL", "BE", "SE", "NO", "FI", "DK", "FR", "AT"]:
            visa = random.uniform(7.5, 8.5)
            stipend = random.uniform(8.0, 9.0)
        elif region in ["PL", "CZ", "HU", "PT", "ES", "IT"]:
            visa = random.uniform(8.5, 9.2)
            stipend = random.uniform(7.5, 8.5)
        elif region in ["AU", "NZ", "CA"]:
            visa = random.uniform(8.0, 8.5)
            stipend = random.uniform(7.5, 8.5)
        elif region in ["SG", "HK", "JP", "KR", "CN"]:
            visa = random.uniform(7.0, 8.0)
            stipend = random.uniform(7.0, 8.0)
        else:
            visa = random.uniform(6.5, 8.0)
            stipend = random.uniform(6.0, 7.5)

        undergrad = random.uniform(6.5, 9.5) if rank <= 100 else random.uniform(5.0, 8.0)
        freedom = random.uniform(7.5, 9.8) if rank <= 100 else random.uniform(6.0, 8.5)
        balance = random.uniform(5.5, 8.5)
        industry = random.uniform(7.5, 10.0) if rank <= 100 else random.uniform(5.0, 8.0)
        infra = random.uniform(8.5, 9.9) if rank <= 100 else random.uniform(6.0, 8.5)

        return {
            "academic_reputation": round(rep, 1),
            "research_funding": round(fund, 1),
            "undergrad_experience": round(undergrad, 1),
            "phd_stipend_ppp": round(stipend, 1),
            "research_freedom": round(freedom, 1),
            "work_life_balance": round(balance, 1),
            "publication_output": round(pub, 1),
            "industry_collaboration": round(industry, 1),
            "local_infrastructure": round(infra, 1),
            "visa_ease_academic": round(visa, 1)
        }

    # Insert universities
    for u in university_list:
        u_metrics = generate_metrics(u["rank"], u["region"])
        
        # Determine some generic descriptions
        visa_text = f"Student and scholar visa processing in {u['country']} takes approximately 2-3 months with standard documentation."
        summary = f"World-class university located in {u['city']}, {u['country']} (Global Shanghai Rank: #{u['rank']})."
        overview = f"The {u['name']} offers a robust ecosystem for academic pursuits, state-of-the-art facilities, and strong international connections."
        
        insert_university(conn, u["id"], u["name"], u["city"], u["country"], u["rank"], summary, overview, visa_text, u_metrics)

    # Insert research groups inside these universities
    all_disciplines = list(discipline_subdomains.keys())
    group_idx = 1
    
    for u in university_list:
        u_metrics = generate_metrics(u["rank"], u["region"]) # recalculate to avoid copy reference issues
        num_groups = random.choice([1, 2])
        for _ in range(num_groups):
            disc = random.choice(all_disciplines)
            sub = random.choice(discipline_subdomains[disc])
            
            g_id = f"group_{u['id']}_{group_idx}"
            group_idx += 1
            
            group_name_variations = [
                f"Laboratory of {sub}",
                f"{sub} Research Group",
                f"Institute for {sub}",
                f"Department of {disc} - {sub} Section"
            ]
            g_name = group_name_variations[group_idx % len(group_name_variations)]
            
            g_metrics = {}
            for k, val in u_metrics.items():
                g_val = max(1.0, min(10.0, val + random.uniform(-0.5, 0.5)))
                g_metrics[k] = round(g_val, 1)
                
            g_summary = f"Elite research collective at {u['name']} specializing in modern {sub.lower()} applications."
            g_overview = f"The {g_name} brings together global researchers to tackle complex questions in {disc} and {sub.lower()}."
            
            insert_group(conn, g_id, u["id"], g_name, disc, sub, u["city"], u["country"], g_summary, g_overview, g_metrics, u["name"])

    conn.commit()
    conn.close()
    print(f"PASS: Academic database created and populated successfully with {len(university_list)} universities and {group_idx - 1} groups!")

if __name__ == "__main__":
    main()
