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
    print(f"Initializing Academic database at: {DB_FILE}")
    if os.path.exists(DB_FILE):
        print(f"Removing existing database file: {DB_FILE}")
        os.remove(DB_FILE)
        
    conn = sqlite3.connect(DB_FILE)
    create_schema(conn)
    
    # 10 World-Class Universities
    universities = [
        {
            "id": "eth_zurich", "name": "ETH Zurich", "city": "Zurich", "country": "Switzerland", "rank": 20,
            "summary": "Europe's leading technical university, famous for Nobel laureates and high-budget labs.",
            "overview": "ETH Zurich consistently ranks among the top universities in the world. It offers unparalleled resources for research and engineering.",
            "visa": "Swiss student/scholar visas are fast-tracked, though local living permits require bank guarantees.",
            "metrics": {
                "academic_reputation": 9.5, "research_funding": 9.8, "undergrad_experience": 8.0,
                "phd_stipend_ppp": 9.6, "research_freedom": 8.8, "work_life_balance": 7.5,
                "publication_output": 9.4, "industry_collaboration": 9.2, "local_infrastructure": 9.7,
                "visa_ease_academic": 7.0
            }
        },
        {
            "id": "stanford", "name": "Stanford University", "city": "Stanford", "country": "USA", "rank": 3,
            "summary": "The academic engine of Silicon Valley, leading in AI, computing, and venture transfers.",
            "overview": "Located in California, Stanford combines extreme funding, entrepreneurial spirit, and academic excellence.",
            "visa": "US J-1/F-1 visas have moderate processing times; H-1B transition is highly competitive.",
            "metrics": {
                "academic_reputation": 9.9, "research_funding": 10.0, "undergrad_experience": 9.2,
                "phd_stipend_ppp": 6.8, "research_freedom": 9.0, "work_life_balance": 6.0,
                "publication_output": 9.9, "industry_collaboration": 10.0, "local_infrastructure": 9.8,
                "visa_ease_academic": 5.0
            }
        },
        {
            "id": "mit", "name": "MIT", "city": "Cambridge", "country": "USA", "rank": 4,
            "summary": "World-class epicenter of scientific computing, robotics, and fundamental physics.",
            "overview": "The Massachusetts Institute of Technology is globally renowned for physical sciences, engineering, and computational disciplines.",
            "visa": "US visas require early planning and interview scheduling.",
            "metrics": {
                "academic_reputation": 10.0, "research_funding": 10.0, "undergrad_experience": 8.5,
                "phd_stipend_ppp": 7.2, "research_freedom": 9.2, "work_life_balance": 5.5,
                "publication_output": 10.0, "industry_collaboration": 9.8, "local_infrastructure": 9.9,
                "visa_ease_academic": 5.0
            }
        },
        {
            "id": "u_warsaw", "name": "University of Warsaw", "city": "Warsaw", "country": "Poland", "rank": 350,
            "summary": "Poland's research powerhouse, boasting world-class mathematical and algorithmic groups.",
            "overview": "The University of Warsaw is the country's flagship institution, with the Faculty of Mathematics, Informatics and Mechanics (MIMUW) achieving elite status in logic, math, and algorithms.",
            "visa": "Polish study/research visas are easily obtained for international researchers, with fast Schengen entry.",
            "metrics": {
                "academic_reputation": 6.5, "research_funding": 6.0, "undergrad_experience": 8.5,
                "phd_stipend_ppp": 8.2, "research_freedom": 9.0, "work_life_balance": 8.0,
                "publication_output": 7.5, "industry_collaboration": 6.0, "local_infrastructure": 7.2,
                "visa_ease_academic": 9.0
            }
        },
        {
            "id": "u_cambridge", "name": "University of Cambridge", "city": "Cambridge", "country": "UK", "rank": 5,
            "summary": "Historic elite university with outstanding records in cosmology, math, and physics.",
            "overview": "Cambridge is a collegiate research university with a rich history of scientific breakthrough, from Isaac Newton to Stephen Hawking.",
            "visa": "UK Global Talent and Student visas have streamlined pathways for recognized researchers.",
            "metrics": {
                "academic_reputation": 9.9, "research_funding": 9.5, "undergrad_experience": 9.0,
                "phd_stipend_ppp": 6.5, "research_freedom": 8.8, "work_life_balance": 6.5,
                "publication_output": 9.8, "industry_collaboration": 8.8, "local_infrastructure": 9.5,
                "visa_ease_academic": 7.0
            }
        },
        {
            "id": "tum", "name": "Technical University of Munich", "city": "Munich", "country": "Germany", "rank": 56,
            "summary": "Germany's top technical university, leading in engineering, applied science, and computer vision.",
            "overview": "TUM is a European research hub, closely integrated with major industrial laboratories in Bavaria.",
            "visa": "German national visas for PhD and researchers are straightforward, with no tuition fees.",
            "metrics": {
                "academic_reputation": 8.8, "research_funding": 9.0, "undergrad_experience": 8.2,
                "phd_stipend_ppp": 8.8, "research_freedom": 8.5, "work_life_balance": 8.0,
                "publication_output": 8.9, "industry_collaboration": 9.5, "local_infrastructure": 9.0,
                "visa_ease_academic": 8.0
            }
        },
        {
            "id": "sorbonne", "name": "Sorbonne University", "city": "Paris", "country": "France", "rank": 40,
            "summary": "Prestigious French institution renowned for mathematics, quantum optics, and humanities.",
            "overview": "Sorbonne University combines historical heritage with high-caliber modern research, particularly in the Latin Quarter of Paris.",
            "visa": "French Talent Passport visas offer multi-year residency for doctoral students and postdocs.",
            "metrics": {
                "academic_reputation": 9.0, "research_funding": 7.8, "undergrad_experience": 7.8,
                "phd_stipend_ppp": 7.5, "research_freedom": 9.2, "work_life_balance": 7.8,
                "publication_output": 8.8, "industry_collaboration": 7.2, "local_infrastructure": 8.2,
                "visa_ease_academic": 8.0
            }
        },
        {
            "id": "nus", "name": "National University of Singapore", "city": "Singapore", "country": "Singapore", "rank": 70,
            "summary": "Asia's premier research university, offering massive funding and high-tech lab equipment.",
            "overview": "NUS is a leading global university centered in Asia, known for strong computational research, materials science, and medical groups.",
            "visa": "Singapore offers quick visa processing and student passes, but long-term settlement has high thresholds.",
            "metrics": {
                "academic_reputation": 9.2, "research_funding": 9.8, "undergrad_experience": 8.5,
                "phd_stipend_ppp": 8.5, "research_freedom": 7.5, "work_life_balance": 5.5,
                "publication_output": 9.2, "industry_collaboration": 9.0, "local_infrastructure": 9.8,
                "visa_ease_academic": 7.5
            }
        },
        {
            "id": "u_oxford", "name": "University of Oxford", "city": "Oxford", "country": "UK", "rank": 6,
            "summary": "Historic academic giant leading in classical mathematics, physics, and fine arts.",
            "overview": "Oxford has taught for over nine centuries. It features a world-renowned tutorial system for undergraduates and elite laboratory groups.",
            "visa": "UK Academic visa sponsorship is streamlined for postdocs and fellowship winners.",
            "metrics": {
                "academic_reputation": 10.0, "research_funding": 9.4, "undergrad_experience": 9.5,
                "phd_stipend_ppp": 6.8, "research_freedom": 9.0, "work_life_balance": 6.8,
                "publication_output": 9.9, "industry_collaboration": 8.5, "local_infrastructure": 9.4,
                "visa_ease_academic": 7.0
            }
        },
        {
            "id": "tu_delft", "name": "TU Delft", "city": "Delft", "country": "Netherlands", "rank": 100,
            "summary": "State-of-the-art Dutch technological university, leading in quantum computing (QuTech) and design.",
            "overview": "TU Delft combines design engineering, robotics, and applied physics, working closely with European research alliances.",
            "visa": "Highly skilled migrant visa schemes in the Netherlands offer fast-track processing and a 30% tax ruling.",
            "metrics": {
                "academic_reputation": 8.2, "research_funding": 9.0, "undergrad_experience": 8.8,
                "phd_stipend_ppp": 8.8, "research_freedom": 8.6, "work_life_balance": 8.5,
                "publication_output": 8.5, "industry_collaboration": 9.0, "local_infrastructure": 9.2,
                "visa_ease_academic": 8.5
            }
        }
    ,
        {
            "id": "caltech",
            "name": "California Institute of Technology",
            "city": "Pasadena",
            "country": "USA",
            "rank": 6,
            "summary": "Top US institute focusing on science and engineering research.",
            "overview": "Caltech is renowned for its strong emphasis on physics, chemistry, and aerospace engineering.",
            "visa": "US J-1/F-1 visas required, competitive with strong funding support.",
            "metrics": {
                "academic_reputation": 9.7,
                "research_funding": 9.5,
                "undergrad_experience": 9.0,
                "phd_stipend_ppp": 7.5,
                "research_freedom": 9.2,
                "work_life_balance": 6.5,
                "publication_output": 9.6,
                "industry_collaboration": 8.0,
                "local_infrastructure": 9.3,
                "visa_ease_academic": 5.5
            }
        },
        {
            "id": "tokyo_univ",
            "name": "University of Tokyo",
            "city": "Tokyo",
            "country": "Japan",
            "rank": 23,
            "summary": "Japan's premier research university with strong programs in physics and engineering.",
            "overview": "UTokyo offers extensive research facilities and a vibrant international community.",
            "visa": "Japanese student visas are straightforward for accepted applicants.",
            "metrics": {
                "academic_reputation": 9.2,
                "research_funding": 9.0,
                "undergrad_experience": 8.5,
                "phd_stipend_ppp": 7.0,
                "research_freedom": 8.8,
                "work_life_balance": 7.0,
                "publication_output": 9.1,
                "industry_collaboration": 8.5,
                "local_infrastructure": 9.0,
                "visa_ease_academic": 7.5
            }
        },
        {
            "id": "cuhk",
            "name": "Chinese University of Hong Kong",
            "city": "Hong Kong",
            "country": "China",
            "rank": 39,
            "summary": "Leading Asian university with strong life sciences and computer science departments.",
            "overview": "CUHK combines strong academic tradition with modern research facilities.",
            "visa": "Hong Kong student visas are processed quickly for qualified students.",
            "metrics": {
                "academic_reputation": 9.0,
                "research_funding": 8.5,
                "undergrad_experience": 8.2,
                "phd_stipend_ppp": 7.8,
                "research_freedom": 8.5,
                "work_life_balance": 7.5,
                "publication_output": 8.7,
                "industry_collaboration": 8.2,
                "local_infrastructure": 8.8,
                "visa_ease_academic": 8.0
            }
        },
        {
            "id": "sydney_uni",
            "name": "University of Sydney",
            "city": "Sydney",
            "country": "Australia",
            "rank": 41,
            "summary": "Top Australian university known for its research in medicine and environmental science.",
            "overview": "The University of Sydney offers a diverse research ecosystem with strong industry links.",
            "visa": "Australian student visas are widely available with post‑study work rights.",
            "metrics": {
                "academic_reputation": 8.8,
                "research_funding": 8.7,
                "undergrad_experience": 8.4,
                "phd_stipend_ppp": 7.9,
                "research_freedom": 8.6,
                "work_life_balance": 8.0,
                "publication_output": 8.5,
                "industry_collaboration": 8.4,
                "local_infrastructure": 8.9,
                "visa_ease_academic": 8.5
            }
        },
        {
            "id": "seoul_nat_uni",
            "name": "Seoul National University",
            "city": "Seoul",
            "country": "South Korea",
            "rank": 45,
            "summary": "Korea's flagship university with strengths in engineering and natural sciences.",
            "overview": "SNU drives much of Korean research output and maintains extensive global collaborations.",
            "visa": "Korean student visas are standard for international scholars.",
            "metrics": {
                "academic_reputation": 9.0,
                "research_funding": 8.9,
                "undergrad_experience": 8.3,
                "phd_stipend_ppp": 7.4,
                "research_freedom": 8.7,
                "work_life_balance": 7.2,
                "publication_output": 8.9,
                "industry_collaboration": 8.6,
                "local_infrastructure": 8.7,
                "visa_ease_academic": 7.8
            }
        }
    ]
    
    for u in universities:
        insert_university(conn, u["id"], u["name"], u["city"], u["country"], u["rank"], u["summary"], u["overview"], u["visa"], u["metrics"])
        
    # Specific Research Groups inside these Universities
    groups = [
        # ETH Zurich Groups
        {
            "id": "eth_zurich_quantum", "parent_id": "eth_zurich", "name": "Quantum Device Lab",
            "discipline": "Physics", "subdomain": "Quantum Computing", "city": "Zurich", "country": "Switzerland",
            "u_name": "ETH Zurich",
            "summary": "Leading experimental research group focusing on superconducting quantum bits and quantum processors.",
            "overview": "The Quantum Device Lab at ETH Zurich works at the forefront of quantum information science, building actual hardware chips and hosting cutting-edge cryogenic equipment.",
            "metrics": {
                "academic_reputation": 9.8, "research_funding": 9.9, "undergrad_experience": 7.2,
                "phd_stipend_ppp": 9.5, "research_freedom": 8.2, "work_life_balance": 6.8,
                "publication_output": 9.9, "industry_collaboration": 8.8, "local_infrastructure": 9.9,
                "visa_ease_academic": 7.0
            }
        },
        {
            "id": "eth_zurich_math", "parent_id": "eth_zurich", "name": "Institute for Mathematical Research",
            "discipline": "Mathematics", "subdomain": "Tensor Networks", "city": "Zurich", "country": "Switzerland",
            "u_name": "ETH Zurich",
            "summary": "World-class group in applied mathematics, numerical analysis, and tensor decomposition.",
            "overview": "This group explores multi-linear algebra, tensor trains, and high-dimensional PDEs for quantum systems and machine learning models.",
            "metrics": {
                "academic_reputation": 9.6, "research_funding": 8.8, "undergrad_experience": 8.0,
                "phd_stipend_ppp": 9.6, "research_freedom": 9.5, "work_life_balance": 7.8,
                "publication_output": 9.2, "industry_collaboration": 7.5, "local_infrastructure": 9.2,
                "visa_ease_academic": 7.0
            }
        },
        
        # Stanford Groups
        {
            "id": "stanford_sail", "parent_id": "stanford", "name": "Stanford AI Lab (SAIL)",
            "discipline": "Computer Science", "subdomain": "Machine Learning", "city": "Stanford", "country": "USA",
            "u_name": "Stanford University",
            "summary": "Historic epicenter of artificial intelligence, computer vision, and foundation models.",
            "overview": "SAIL is one of the world's most cited machine learning groups, driving advances in computer vision, robotics, NLP, and reinforcement learning.",
            "metrics": {
                "academic_reputation": 10.0, "research_funding": 10.0, "undergrad_experience": 9.0,
                "phd_stipend_ppp": 6.8, "research_freedom": 8.5, "work_life_balance": 5.5,
                "publication_output": 10.0, "industry_collaboration": 10.0, "local_infrastructure": 9.8,
                "visa_ease_academic": 5.0
            }
        },
        {
            "id": "stanford_quantum", "parent_id": "stanford", "name": "Quantum Computing Lab",
            "discipline": "Physics", "subdomain": "Quantum Computing", "city": "Stanford", "country": "USA",
            "u_name": "Stanford University",
            "summary": "Interdisciplinary group developing quantum algorithms and topological quantum software.",
            "overview": "Collaborates with Silicon Valley tech giants to test algorithms on active quantum computing backends.",
            "metrics": {
                "academic_reputation": 9.8, "research_funding": 9.8, "undergrad_experience": 8.8,
                "phd_stipend_ppp": 6.8, "research_freedom": 8.8, "work_life_balance": 6.0,
                "publication_output": 9.7, "industry_collaboration": 9.5, "local_infrastructure": 9.6,
                "visa_ease_academic": 5.0
            }
        },

        # MIT Groups
        {
            "id": "mit_csail", "parent_id": "mit", "name": "CSAIL",
            "discipline": "Computer Science", "subdomain": "Machine Learning", "city": "Cambridge", "country": "USA",
            "u_name": "MIT",
            "summary": "MIT's massive Computer Science and AI laboratory, pioneering robotics, AI, and graphics.",
            "overview": "CSAIL is MIT's largest interdepartmental lab, housing over 60 research groups spanning theory, systems, AI, and robotics.",
            "metrics": {
                "academic_reputation": 10.0, "research_funding": 10.0, "undergrad_experience": 8.2,
                "phd_stipend_ppp": 7.2, "research_freedom": 9.0, "work_life_balance": 5.0,
                "publication_output": 10.0, "industry_collaboration": 9.9, "local_infrastructure": 9.9,
                "visa_ease_academic": 5.0
            }
        },

        # University of Warsaw Groups
        {
            "id": "u_warsaw_mimuw_alg", "parent_id": "u_warsaw", "name": "MIMUW Algorithms Group",
            "discipline": "Computer Science", "subdomain": "Tensor Networks", "city": "Warsaw", "country": "Poland",
            "u_name": "University of Warsaw",
            "summary": "Elite Polish algorithms research team, dominant in competitive programming and graph theory.",
            "overview": "Known for outstanding theoretical contributions in approximation algorithms, parameterized complexity, and network optimization.",
            "metrics": {
                "academic_reputation": 8.5, "research_funding": 6.8, "undergrad_experience": 8.8,
                "phd_stipend_ppp": 8.5, "research_freedom": 9.5, "work_life_balance": 8.2,
                "publication_output": 8.8, "industry_collaboration": 5.5, "local_infrastructure": 7.5,
                "visa_ease_academic": 9.0
            }
        },
        {
            "id": "u_warsaw_mimuw_geom", "parent_id": "u_warsaw", "name": "Algebraic Geometry Seminar Group",
            "discipline": "Mathematics", "subdomain": "Algebraic Geometry", "city": "Warsaw", "country": "Poland",
            "u_name": "University of Warsaw",
            "summary": "Leading European school of algebraic geometry, singular spaces, and moduli theories.",
            "overview": "A highly collaborative group focused on pure algebraic geometry, topology, and classical algebraic structures.",
            "metrics": {
                "academic_reputation": 8.2, "research_funding": 6.2, "undergrad_experience": 8.5,
                "phd_stipend_ppp": 8.2, "research_freedom": 9.8, "work_life_balance": 8.5,
                "publication_output": 8.0, "industry_collaboration": 4.0, "local_infrastructure": 7.0,
                "visa_ease_academic": 9.0
            }
        },

        # TU Delft Groups
        {
            "id": "tu_delft_qutech", "parent_id": "tu_delft", "name": "QuTech Institute",
            "discipline": "Physics", "subdomain": "Quantum Computing", "city": "Delft", "country": "Netherlands",
            "u_name": "TU Delft",
            "summary": "A collaborative research center for quantum computing and quantum internet.",
            "overview": "QuTech is a joint institute of TU Delft and TNO, building topological qubits, silicon spin qubits, and multi-node quantum network links.",
            "metrics": {
                "academic_reputation": 9.5, "research_funding": 9.8, "undergrad_experience": 8.0,
                "phd_stipend_ppp": 8.8, "research_freedom": 8.4, "work_life_balance": 8.2,
                "publication_output": 9.5, "industry_collaboration": 9.2, "local_infrastructure": 9.5,
                "visa_ease_academic": 8.5
            }
        },

        # Oxford Groups
        {
            "id": "oxford_math_inst", "parent_id": "u_oxford", "name": "Mathematical Institute",
            "discipline": "Mathematics", "subdomain": "Algebraic Geometry", "city": "Oxford", "country": "UK",
            "u_name": "University of Oxford",
            "summary": "Prestigious institute housing world-renowned algebraists, topologists, and geometry scholars.",
            "overview": "Oxford's Moduli Spaces and Arithmetic Geometry teams work inside the Andrew Wiles Building, providing an elite environment for pure mathematical research.",
            "metrics": {
                "academic_reputation": 10.0, "research_funding": 9.2, "undergrad_experience": 9.6,
                "phd_stipend_ppp": 6.8, "research_freedom": 9.5, "work_life_balance": 7.0,
                "publication_output": 9.8, "industry_collaboration": 7.0, "local_infrastructure": 9.5,
                "visa_ease_academic": 7.0
            }
        },
        {
            "id": "oxford_ruskin", "parent_id": "u_oxford", "name": "Ruskin School of Art",
            "discipline": "Arts", "subdomain": "Arts", "city": "Oxford", "country": "UK",
            "u_name": "University of Oxford",
            "summary": "Elite contemporary art school embedded inside Oxford, focusing on fine arts and visual domains.",
            "overview": "The Ruskin offers a tight-knit studio environment for art history, sculpture, and digital print mediums, combining practice with theory.",
            "metrics": {
                "academic_reputation": 9.4, "research_funding": 8.0, "undergrad_experience": 9.2,
                "phd_stipend_ppp": 6.8, "research_freedom": 9.2, "work_life_balance": 7.5,
                "publication_output": 8.5, "industry_collaboration": 6.5, "local_infrastructure": 9.0,
                "visa_ease_academic": 7.0
            }
        }
        ,
        {
            "id": "caltech_ai_lab",
            "parent_id": "caltech",
            "name": "Caltech AI Research Lab",
            "discipline": "Computer Science",
            "subdomain": "Artificial Intelligence",
            "city": "Pasadena",
            "country": "USA",
            "u_name": "California Institute of Technology",
            "summary": "Cutting‑edge AI lab focusing on deep learning and robotics.",
            "overview": "The lab integrates theory and hardware for real‑world AI applications.",
            "metrics": {
                "academic_reputation": 9.6,
                "research_funding": 9.4,
                "undergrad_experience": 8.8,
                "phd_stipend_ppp": 7.2,
                "research_freedom": 9.1,
                "work_life_balance": 6.5,
                "publication_output": 9.5,
                "industry_collaboration": 8.5,
                "local_infrastructure": 9.2,
                "visa_ease_academic": 5.5
            }
        },
        {
            "id": "tokyo_quantum_group",
            "parent_id": "tokyo_univ",
            "name": "Quantum Science Group",
            "discipline": "Physics",
            "subdomain": "Quantum Computing",
            "city": "Tokyo",
            "country": "Japan",
            "u_name": "University of Tokyo",
            "summary": "Leading research on quantum algorithms and superconducting qubits.",
            "overview": "Group collaborates with national labs and industry partners across Japan.",
            "metrics": {
                "academic_reputation": 9.3,
                "research_funding": 9.1,
                "undergrad_experience": 8.2,
                "phd_stipend_ppp": 7.0,
                "research_freedom": 9.0,
                "work_life_balance": 7.0,
                "publication_output": 9.2,
                "industry_collaboration": 8.8,
                "local_infrastructure": 9.0,
                "visa_ease_academic": 7.5
            }
        },
        {
            "id": "cuhk_bioinformatics",
            "parent_id": "cuhk",
            "name": "Bioinformatics and Genomics Centre",
            "discipline": "Biology",
            "subdomain": "Genomics",
            "city": "Hong Kong",
            "country": "China",
            "u_name": "Chinese University of Hong Kong",
            "summary": "Focuses on large‑scale genomic data analysis and personalized medicine.",
            "overview": "Integrates computational methods with wet‑lab genomics to advance health research.",
            "metrics": {
                "academic_reputation": 8.9,
                "research_funding": 8.6,
                "undergrad_experience": 8.0,
                "phd_stipend_ppp": 7.5,
                "research_freedom": 8.7,
                "work_life_balance": 7.8,
                "publication_output": 8.8,
                "industry_collaboration": 8.3,
                "local_infrastructure": 8.9,
                "visa_ease_academic": 8.0
            }
        },
        {
            "id": "sydney_climate_group",
            "parent_id": "sydney_uni",
            "name": "Climate Change and Sustainability Institute",
            "discipline": "Earth Sciences",
            "subdomain": "Climatology",
            "city": "Sydney",
            "country": "Australia",
            "u_name": "University of Sydney",
            "summary": "Researches climate modelling, impacts, and mitigation strategies.",
            "overview": "Works with governmental agencies to inform policy and adaptation planning.",
            "metrics": {
                "academic_reputation": 8.7,
                "research_funding": 8.5,
                "undergrad_experience": 8.2,
                "phd_stipend_ppp": 7.6,
                "research_freedom": 8.6,
                "work_life_balance": 8.1,
                "publication_output": 8.4,
                "industry_collaboration": 8.0,
                "local_infrastructure": 8.8,
                "visa_ease_academic": 8.5
            }
        },
        {
            "id": "seoul_neural_networks",
            "parent_id": "seoul_nat_uni",
            "name": "Neural Networks and Deep Learning Lab",
            "discipline": "Computer Science",
            "subdomain": "Deep Learning",
            "city": "Seoul",
            "country": "South Korea",
            "u_name": "Seoul National University",
            "summary": "Advances in neural architecture search and large‑scale training.",
            "overview": "Partners with Korean tech giants to translate research into products.",
            "metrics": {
                "academic_reputation": 9.0,
                "research_funding": 8.8,
                "undergrad_experience": 8.4,
                "phd_stipend_ppp": 7.3,
                "research_freedom": 8.9,
                "work_life_balance": 7.2,
                "publication_output": 9.1,
                "industry_collaboration": 8.9,
                "local_infrastructure": 8.7,
                "visa_ease_academic": 7.8
            }
        }
    ]
    
    for g in groups:
        insert_group(conn, g["id"], g["parent_id"], g["name"], g["discipline"], g["subdomain"], g["city"], g["country"], g["summary"], g["overview"], g["metrics"], g["u_name"])
        
    conn.commit()
    conn.close()
    print("PASS: Academic database created and populated successfully with 10 universities and 10 world-class groups!")

if __name__ == "__main__":
    main()
