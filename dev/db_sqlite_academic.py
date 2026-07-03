# -*- coding: utf-8 -*-
"""
Country Compatibility Explorer - Academic Data Access Layer
Queries the academic.db database efficiently in bulk queries.
"""

import sqlite3
import os

DB_PATH = 'academic.db'

def get_db_connection():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    db_file_path = os.path.join(current_dir, DB_PATH)
    
    conn = sqlite3.connect(db_file_path)
    conn.row_factory = sqlite3.Row
    return conn

def get_academic_entities():
    """
    Queries the academic database and structures the nested data maps.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 1. Query all entities
        cursor.execute("""
            SELECT id, type, name, fullName, universityName, discipline, subDomain, 
                   parentId, cityName, countryName, shanghaiRank, summary, overview, visaInfo 
            FROM academic_entities;
        """)
        entity_rows = cursor.fetchall()
        
        # 2. Query all pros
        cursor.execute("SELECT entity_id, content FROM academic_pros;")
        pros_rows = cursor.fetchall()
        
        pros_map = {}
        for row in pros_rows:
            ent_id = row['entity_id']
            if ent_id not in pros_map:
                pros_map[ent_id] = []
            pros_map[ent_id].append(row['content'])
            
        # 3. Query all cons
        cursor.execute("SELECT entity_id, content FROM academic_cons;")
        cons_rows = cursor.fetchall()
        
        cons_map = {}
        for row in cons_rows:
            ent_id = row['entity_id']
            if ent_id not in cons_map:
                cons_map[ent_id] = []
            cons_map[ent_id].append(row['content'])
            
        # 4. Query all metrics
        cursor.execute("SELECT entity_id, metric_name, metric_value FROM academic_metrics;")
        metrics_rows = cursor.fetchall()
        
        metrics_map = {}
        for row in metrics_rows:
            ent_id = row['entity_id']
            if ent_id not in metrics_map:
                metrics_map[ent_id] = {}
            metrics_map[ent_id][row['metric_name']] = row['metric_value']
            
        # 5. Query all persona data
        cursor.execute("SELECT entity_id, persona, summary, overview FROM academic_persona_data;")
        persona_data_rows = cursor.fetchall()
        
        persona_data_map = {}
        for row in persona_data_rows:
            ent_id = row['entity_id']
            pers = row['persona']
            if ent_id not in persona_data_map:
                persona_data_map[ent_id] = {}
            persona_data_map[ent_id][pers] = {
                "summary": row['summary'],
                "overview": row['overview']
            }
            
        # 6. Query all persona pros
        cursor.execute("SELECT entity_id, persona, content FROM academic_persona_pros;")
        persona_pros_rows = cursor.fetchall()
        
        persona_pros_map = {}
        for row in persona_pros_rows:
            ent_id = row['entity_id']
            pers = row['persona']
            if ent_id not in persona_pros_map:
                persona_pros_map[ent_id] = {}
            if pers not in persona_pros_map[ent_id]:
                persona_pros_map[ent_id][pers] = []
            persona_pros_map[ent_id][pers].append(row['content'])
            
        # 7. Query all persona cons
        cursor.execute("SELECT entity_id, persona, content FROM academic_persona_cons;")
        persona_cons_rows = cursor.fetchall()
        
        persona_cons_map = {}
        for row in persona_cons_rows:
            ent_id = row['entity_id']
            pers = row['persona']
            if ent_id not in persona_cons_map:
                persona_cons_map[ent_id] = {}
            if pers not in persona_cons_map[ent_id]:
                persona_cons_map[ent_id][pers] = []
            persona_cons_map[ent_id][pers].append(row['content'])

        # Build structured entities list
        entities_list = []
        for row in entity_rows:
            ent_id = row['id']
            
            entity_dict = {
                "id": ent_id,
                "type": row['type'],
                "parentId": row['parentId'],
                "name": row['name'],
                "fullName": row['fullName'],
                "universityName": row['universityName'],
                "discipline": row['discipline'],
                "subDomain": row['subDomain'],
                "cityName": row['cityName'],
                "countryName": row['countryName'],
                "shanghaiRank": row['shanghaiRank'],
                "summary": row['summary'],
                "description": {
                    "overview": row['overview'],
                    "pros": pros_map.get(ent_id, []),
                    "cons": cons_map.get(ent_id, []),
                    "visaInfo": row['visaInfo']
                },
                "personaData": persona_data_map.get(ent_id, {}),
                "personaPros": persona_pros_map.get(ent_id, {}),
                "personaCons": persona_cons_map.get(ent_id, {}),
                "metrics": metrics_map.get(ent_id, {})
            }
            entities_list.append(entity_dict)
            
        return entities_list
        
    except Exception as e:
        print(f"Error querying Academic SQLite database: {e}")
        return []
    finally:
        conn.close()
