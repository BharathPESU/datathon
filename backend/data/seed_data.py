import random
from datetime import datetime, timedelta
from app.db import catalyst_db as db
from app.core.security import hash_password

KARNATAKA_DISTRICTS = [
    "Bengaluru Urban", "Bengaluru Rural", "Mysuru", "Mangaluru", "Hubballi-Dharwad",
    "Belagavi", "Kalaburagi", "Ballari", "Davangere", "Shivamogga", "Tumakuru"
]

POLICE_STATIONS = {
    "Bengaluru Urban": ["Yelahanka", "Whitefield", "Koramangala", "Jayanagar", "HSR Layout"],
    "Mysuru": ["Devaraja", "Kuvempunagar", "Lashkar Mohalla"],
    "Mangaluru": ["Barke", "Kadri", "Pandeshwar"],
    "Hubballi-Dharwad": ["Gokul Road", "Vidyanagar", "Dharwad"],
    "Belagavi": ["Camp", "Udyambag", "Shahpur"],
}

CRIME_HEADS = [
    "Crimes Against Body", "Crimes Against Property", "Economic Offences",
    "Crimes Against Women", "Cyber Crimes", "Drug Related Offences"
]

CRIME_SUB_HEADS = {
    "Crimes Against Body": ["Murder", "Attempt to Murder", "Assault", "Kidnapping"],
    "Crimes Against Property": ["Burglary", "Theft", "Vehicle Theft", "House Breaking"],
    "Economic Offences": ["Cheating", "Forgery", "Land Scam"],
    "Crimes Against Women": ["Dowry Harassment", "Molestation", "Domestic Violence"],
    "Cyber Crimes": ["Phishing", "Identity Theft", "Online Fraud"],
    "Drug Related Offences": ["NDPS Consumption", "Drug Peddling", "Smuggling"]
}

FACTS_TEMPLATES = {
    "Murder": "The complainant stated that on {date}, the accused individuals assaulted the victim with lethal weapons over an ancestral property dispute, causing instantaneous death. Offence registered at {station} Station.",
    "Theft": "Complainant reported that some unknown culprits entered their house on the night of {date} and stole gold ornaments weighing 80 grams and cash worth Rs 50,000.",
    "Cheating": "The accused collected a sum of Rs 10 Lakhs from the complainant promising a government job in KPSC but failed to deliver and refused to refund the amount.",
    "Dowry Harassment": "The victim alleged that her husband and in-laws harassed her physically and mentally, demanding additional dowry of Rs 5 Lakhs and a car.",
    "Phishing": "The complainant received a fraudulent link on SMS pretending to be a bank KYC update, and upon clicking, Rs 1.5 Lakhs was debited from their account.",
    "NDPS Consumption": "During patrolling near {station}, police apprehended the accused found in possession of illegal narcotics (ganja) and suspected of consumption."
}

def generate_all_data():
    """Seeds lookup tables, generates 2000 cases with accused/victims, and sets up app users."""
    print("Generating synthetic Karnataka Police FIR dataset...")
    
    # 1. State
    state = db.insert_row("State", {"state_name": "Karnataka"})
    state_id = state["ROWID"]
    
    # 2. Districts & Stations
    district_ids = {}
    station_ids = {}
    for dist in KARNATAKA_DISTRICTS:
        d = db.insert_row("District", {"district_name": dist, "state_id": state_id})
        d_id = d["ROWID"]
        district_ids[dist] = d_id
        
        stations = POLICE_STATIONS.get(dist, [f"{dist} Central", f"{dist} Rural"])
        station_ids[d_id] = []
        for st in stations:
            s = db.insert_row("Unit", {"unit_name": st, "unit_type_id": 1, "district_id": d_id})
            station_ids[d_id].append(s["ROWID"])
            
    # 3. Crime Heads & Sub-heads
    head_ids = {}
    sub_head_ids = {}
    for head in CRIME_HEADS:
        h = db.insert_row("CrimeHead", {"crime_head_name": head})
        h_id = h["ROWID"]
        head_ids[head] = h_id
        
        sub_head_ids[h_id] = []
        for sub in CRIME_SUB_HEADS[head]:
            sh = db.insert_row("CrimeSubHead", {"crime_sub_head_name": sub, "crime_head_id": h_id})
            sub_head_ids[h_id].append(sh["ROWID"])
            
    # 4. Other lookups
    categories = [db.insert_row("CaseCategory", {"category_name": name}) for name in ["FIR", "NCR", "UDR"]]
    gravities = [db.insert_row("GravityOffence", {"gravity_name": name}) for name in ["Heinous", "Non-Heinous"]]
    statuses = [db.insert_row("CaseStatus", {"status_name": name}) for name in ["Under Investigation", "Chargesheeted", "Closed", "Convicted"]]
    occupations = [db.insert_row("OccupationMaster", {"occupation_name": name}) for name in ["Business", "Agriculture", "Government Employee", "Unemployed", "Student"]]
    
    ranks = [db.insert_row("Rank", {"rank_name": r}) for r in ["PSI", "PI", "DYSP"]]
    designations = [db.insert_row("Designation", {"designation_name": d}) for d in ["Investigating Officer", "Station House Officer"]]
    
    # 5. Employees (IOs)
    ios = []
    first_dist_id = list(station_ids.keys())[0]
    first_station_id = station_ids[first_dist_id][0]
    for i in range(20):
        emp = db.insert_row("Employee", {
            "emp_name": f"Officer {i+1}",
            "rank_id": random.choice(ranks)["ROWID"],
            "designation_id": random.choice(designations)["ROWID"],
            "unit_id": first_station_id
        })
        ios.append(emp["ROWID"])
        
    # 6. Courts
    courts = []
    for d_name, d_id in district_ids.items():
        court = db.insert_row("Court", {"court_name": f"District & Sessions Court, {d_name}", "district_id": d_id})
        courts.append(court["ROWID"])
        
    # 7. Acts & Sections
    act = db.insert_row("Act", {"act_name": "Indian Penal Code"})
    act_id = act["ROWID"]
    sections = [
        db.insert_row("Section", {"section_name": sec, "act_id": act_id})
        for sec in ["302", "307", "379", "420", "498A", "354"]
    ]
    
    # 8. Demo App Users
    app_users = [
        ("admin", "admin", "admin"),
        ("inspector_ravi", "ravi123", "investigator"),
        ("analyst_priya", "priya123", "analyst"),
        ("sp_kumar", "kumar123", "supervisor"),
    ]
    for username, password, role in app_users:
        db.insert_row("AppUser", {
            "username": username,
            "hashed_password": hash_password(password),
            "role": role,
            "employee_id": random.choice(ios)
        })
        
    # 9. Cases Generation (2,000 cases)
    accused_names_pool = ["Ramesh", "Suresh", "Kumar", "Vijay", "Anand", "Harish", "Santosh", "Manjunath", "Basavaraj", "Prakash"]
    victim_names_pool = ["Sunita", "Lakshmi", "Girish", "Kiran", "Nagaraj", "Shanthi", "Geetha", "Sandeep"]
    
    for c_idx in range(2000):
        # District & Station selection
        dist_name = random.choice(KARNATAKA_DISTRICTS)
        dist_id = district_ids[dist_name]
        station_id = random.choice(station_ids[dist_id])
        station_name = next(s["unit_name"] for s in db.get_all_rows("Unit") if s["ROWID"] == station_id)
        
        # Crime Classification
        head = random.choice(CRIME_HEADS)
        h_id = head_ids[head]
        sub = random.choice(CRIME_SUB_HEADS[head])
        sub_id = next(sh["ROWID"] for sh in db.get_all_rows("CrimeSubHead") if sh["crime_sub_head_name"] == sub)
        
        # Registration Date (within last 3 years)
        days_ago = random.randint(1, 1000)
        reg_date = (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        
        # Coordinates in Karnataka bounding box
        lat = random.uniform(12.5, 17.5)
        lng = random.uniform(74.0, 78.5)
        
        # Template narration
        tpl = FACTS_TEMPLATES.get(sub, FACTS_TEMPLATES["Theft"])
        facts = tpl.format(date=reg_date, station=station_name)
        
        case_master = db.insert_row("CaseMaster", {
            "crime_no": f"FIR/KAR/{dist_name.replace(' ', '')[:4].upper()}/{datetime.now().year}/{1000 + c_idx}",
            "case_no": f"CC-{random.randint(100, 9999)}/{datetime.now().year}",
            "crime_registered_date": reg_date,
            "police_person_id": random.choice(ios),
            "police_station_id": station_id,
            "case_category_id": random.choice(categories)["ROWID"],
            "gravity_offence_id": random.choice(gravities)["ROWID"],
            "crime_head_id": h_id,
            "crime_sub_head_id": sub_id,
            "case_status_id": random.choice(statuses)["ROWID"],
            "court_id": random.choice(courts),
            "incident_from_date": reg_date,
            "incident_to_date": reg_date,
            "latitude": lat,
            "longitude": lng,
            "brief_facts": facts,
            "district_id": dist_id
        })
        case_id = case_master["ROWID"]
        
        # Entities (Accused)
        num_accused = random.randint(1, 3)
        accused_rows = []
        for a_idx in range(num_accused):
            a_name = random.choice(accused_names_pool)
            # 15% chance to make it a repeat offender (same name, distinct cases)
            if random.random() < 0.15:
                a_name = "Basavaraj (Repeat)"
            acc_row = db.insert_row("Accused", {
                "case_master_id": case_id,
                "accused_name": a_name,
                "age_year": random.randint(18, 65),
                "gender": random.choice(["Male", "Female"]),
                "person_id": f"A{a_idx + 1}"
            })
            accused_rows.append(acc_row)
            
        # Victims
        num_victims = random.randint(1, 2)
        for _ in range(num_victims):
            db.insert_row("Victim", {
                "case_master_id": case_id,
                "victim_name": random.choice(victim_names_pool),
                "age_year": random.randint(10, 70),
                "gender": random.choice(["Male", "Female"])
            })
            
        # Complainant
        db.insert_row("ComplainantDetails", {
            "case_master_id": case_id,
            "complainant_name": f"Complainant {c_idx+1}",
            "age_year": random.randint(25, 60),
            "gender": random.choice(["Male", "Female"]),
            "occupation_id": random.choice(occupations)["ROWID"]
        })
        
        # Arrests
        if random.random() < 0.6 and accused_rows:
            target_acc = random.choice(accused_rows)
            db.insert_row("ArrestSurrender", {
                "case_master_id": case_id,
                "type_id": 1,
                "arrest_date": reg_date,
                "state_id": state_id,
                "district_id": dist_id,
                "police_station_id": station_id,
                "io_id": random.choice(ios),
                "court_id": random.choice(courts),
                "accused_master_id": target_acc["ROWID"],
                "is_accused": 1,
                "is_complainant_accused": 0
            })

    # 10. Generate Hotspots & Networks
    for dist_id in station_ids.keys():
        for category in categories:
            db.insert_row("CrimeHotspot", {
                "geohash": f"tdr{random.randint(100, 999)}",
                "window_start": "2026-01-01",
                "window_end": "2026-01-31",
                "category_id": category["ROWID"],
                "predicted_count": random.randint(5, 50),
                "confidence": random.uniform(0.7, 0.95)
            })

    print(f"Dataset generation complete! Loaded all lookup and core tables.")
    print(f" - Cases seeded: {len(db.get_all_rows('CaseMaster'))}")
    print(f" - Accused seeded: {len(db.get_all_rows('Accused'))}")
    print(f" - Demo accounts ready.")