import os
import random
import logging
import subprocess
from datetime import datetime, timezone, timedelta
import zcatalyst_sdk
from zcatalyst_sdk import credentials

logger = logging.getLogger(__name__)

# Configurable constants
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

def get_catalyst_app(request=None):
    """Initializes and returns the CatalystApp instance using request headers or CLI fallback."""
    has_project = False
    if request:
        for k in request.headers.keys():
            if "project" in k.lower():
                has_project = True
                break
                
    if request and has_project:
        logger.info("Initializing Catalyst SDK from request headers (Cloud Mode)...")
        return zcatalyst_sdk.initialize(req=request)
        
    logger.info("Catalyst headers not found in request. Trying CLI token fallback...")
    try:
        os.environ["X_ZOHO_CATALYST_ACCOUNTS_URL"] = "https://accounts.zoho.in"
        os.environ["X_ZOHO_CATALYST_CONSOLE_URL"] = "https://console.catalyst.zoho.in"
        
        out = subprocess.check_output(["catalyst", "token:generate", "--current"], stderr=subprocess.DEVNULL).decode()
        token = out.split("Token generated successfully :")[-1].strip()
        
        cred = credentials.AccessTokenCredential({
            "access_token": token
        })
        
        options = {
            "project_id": "55341000000016001",
            "project_key": "60076836035",
            "project_domain": "api.catalyst.zoho.in",
            "environment": "Development"
        }
        
        return zcatalyst_sdk.initialize_app(credential=cred, options=options)
    except Exception as e:
        logger.error(f"Failed to initialize Catalyst SDK locally: {e}")
        raise RuntimeError("Catalyst SDK could not be initialized. Verify you are logged in via CLI ('catalyst whoami').")

class SafeTable:
    def __init__(self, datastore, table_name):
        self._table = datastore.table(table_name)
        self._table_name = table_name
        self._datastore = datastore

    def get_live_columns(self) -> list:
        if not hasattr(self._datastore, "_safe_columns_cache"):
            self._datastore._safe_columns_cache = {}
        if self._table_name not in self._datastore._safe_columns_cache:
            try:
                cols = self._table.get_all_columns()
                self._datastore._safe_columns_cache[self._table_name] = [c.get("column_name") for c in cols]
                logger.info(f"Loaded live columns for {self._table_name}: {self._datastore._safe_columns_cache[self._table_name]}")
            except Exception as e:
                logger.warning(f"Could not load columns for {self._table_name}: {e}")
                self._datastore._safe_columns_cache[self._table_name] = []
        return self._datastore._safe_columns_cache[self._table_name]

    def insert_row(self, data: dict) -> dict:
        live_cols = self.get_live_columns()
        
        # Mapping helpers for common column name variations
        mapped_data = {}
        for k, v in data.items():
            if k == "timestamp" and "time_stamp" in live_cols and "timestamp" not in live_cols:
                mapped_data["time_stamp"] = v
            else:
                mapped_data[k] = v
                
        if live_cols:
            filtered_data = {k: v for k, v in mapped_data.items() if k in live_cols}
            dropped = {k: v for k, v in mapped_data.items() if k not in live_cols}
            if dropped:
                logger.warning(f"Table {self._table_name}: Dropping columns not present in live schema: {list(dropped.keys())}")
            return self._table.insert_row(filtered_data)
        return self._table.insert_row(mapped_data)

    def delete(self, criteria=None):
        return self._table.delete(criteria)

    def get_row(self, row_id):
        return self._table.get_row(row_id)
        
    def get_all_rows(self):
        return self._table.get_all_rows()

class SafeDatastore:
    def __init__(self, datastore):
        self._datastore = datastore

    def table(self, table_name):
        return SafeTable(self._datastore, table_name)

def run_cloud_migration(request=None, num_cases=200) -> dict:
    """Migrates synthetic crime data into the real Zoho Catalyst Data Store."""
    from app.core.security import hash_password

    app = get_catalyst_app(request)
    raw_datastore = app.datastore()
    datastore = SafeDatastore(raw_datastore)
    zcql = app.zcql()
    
    # 1. Clean existing records in reverse order
    tables_to_clean = [
        "CaseNetworkEdge", "CrimeHotspot", "ArrestSurrender", "ComplainantDetails", "Victim", "Accused",
        "CaseMaster", "AppUser", "Section", "Act", "Court", "Employee", "Designation",
        "Rank", "OccupationMaster", "CaseStatus", "GravityOffence", "CaseCategory",
        "CrimeSubHead", "CrimeHead", "Unit", "District", "State", "AuditLog"
    ]
    
    logger.info("Cleaning existing Data Store tables...")
    for tbl in tables_to_clean:
        try:
            zcql.execute_query(f"DELETE FROM {tbl}")
            logger.info(f" - Cleaned table: {tbl}")
        except Exception as e:
            logger.warning(f"Could not clean table {tbl} (might be empty or missing permissions): {e}")

    # ID mapping dictionary (local_id -> cloud_id)
    id_maps = {tbl: {} for tbl in tables_to_clean}
    
    # 2. Seed Lookup Data
    logger.info("Seeding lookup tables...")
    
    # State
    state_res = datastore.table("State").insert_row({"state_name": "Karnataka"})
    state_id = int(state_res["ROWID"])
    
    # Districts & Stations
    for dist in KARNATAKA_DISTRICTS:
        # Note: district_name is a foreign key pointing to State in the live database schema
        d_res = datastore.table("District").insert_row({"district_name": state_id, "state_id": state_id})
        d_id = int(d_res["ROWID"])
        id_maps["District"][dist] = d_id
        
        stations = POLICE_STATIONS.get(dist, [f"{dist} Central", f"{dist} Rural"])
        id_maps["Unit"][dist] = []
        for st in stations:
            # Note: unit_name is a foreign key pointing to District in the live schema
            u_res = datastore.table("Unit").insert_row({"unit_name": d_id, "unit_type_id": 1, "district_id": d_id})
            id_maps["Unit"][dist].append(int(u_res["ROWID"]))

    # Crime Heads & Sub-heads
    for head in CRIME_HEADS:
        h_res = datastore.table("CrimeHead").insert_row({"crime_head_name": head})
        h_id = int(h_res["ROWID"])
        id_maps["CrimeHead"][head] = h_id
        
        id_maps["CrimeSubHead"][head] = []
        for sub in CRIME_SUB_HEADS[head]:
            # Note: crime_sub_head_name is a foreign key pointing to CrimeHead in the live schema
            sh_res = datastore.table("CrimeSubHead").insert_row({"crime_sub_head_name": h_id, "crime_head_id": h_id})
            id_maps["CrimeSubHead"][head].append(int(sh_res["ROWID"]))

    # General Lookups
    categories = []
    for cat in ["FIR", "NCR", "UDR"]:
        res = datastore.table("CaseCategory").insert_row({"category_name": cat})
        categories.append(int(res["ROWID"]))
        
    gravities = []
    for grav in ["Heinous", "Non-Heinous"]:
        res = datastore.table("GravityOffence").insert_row({"gravity_name": grav})
        gravities.append(int(res["ROWID"]))
        
    statuses = []
    for stat in ["Under Investigation", "Chargesheeted", "Closed", "Convicted"]:
        res = datastore.table("CaseStatus").insert_row({"status_name": stat})
        statuses.append(int(res["ROWID"]))
        
    occupations = []
    for occ in ["Business", "Agriculture", "Government Employee", "Unemployed", "Student"]:
        res = datastore.table("OccupationMaster").insert_row({"occupation_name": occ})
        occupations.append(int(res["ROWID"]))
        
    ranks = []
    for r in ["PSI", "PI", "DYSP"]:
        res = datastore.table("Rank").insert_row({"rank_name": r})
        ranks.append(int(res["ROWID"]))
        
    designations = []
    for d in ["Investigating Officer", "Station House Officer"]:
        res = datastore.table("Designation").insert_row({"designation_name": d})
        designations.append(int(res["ROWID"]))

    # Employees (IOs)
    ios = []
    first_dist = KARNATAKA_DISTRICTS[0]
    first_station_id = id_maps["Unit"][first_dist][0]
    for i in range(15):
        # Note: emp_name is a foreign key pointing to Rank in the live schema
        emp_res = datastore.table("Employee").insert_row({
            "emp_name": random.choice(ranks),
            "rank_id": random.choice(ranks),
            "designation_id": random.choice(designations),
            "unit_id": first_station_id
        })
        ios.append(int(emp_res["ROWID"]))

    # Courts
    courts = []
    for dist in KARNATAKA_DISTRICTS:
        # Note: court_name is a foreign key pointing to District in the live schema
        c_res = datastore.table("Court").insert_row({
            "court_name": id_maps["District"][dist],
            "district_id": id_maps["District"][dist]
        })
        courts.append(int(c_res["ROWID"]))

    # Acts & Sections
    act_res = datastore.table("Act").insert_row({"act_name": "Indian Penal Code"})
    act_id = int(act_res["ROWID"])
    for sec in ["302", "307", "379", "420", "498A", "354"]:
        # Note: section_name is a foreign key pointing to Act in the live schema
        datastore.table("Section").insert_row({"section_name": act_id, "act_id": act_id})

    # Demo App Users
    app_users = [
        ("admin", "admin", "admin"),
        ("inspector_ravi", "ravi123", "investigator"),
        ("analyst_priya", "priya123", "analyst"),
        ("sp_kumar", "kumar123", "supervisor"),
    ]
    for username, password, role in app_users:
        datastore.table("AppUser").insert_row({
            "username": username,
            "hashed_password": hash_password(password),
            "role": role,
            "employee_id": random.choice(ios)
        })

    # 3. Seed Cases & Transactions (Batch of cases)
    logger.info(f"Seeding {num_cases} cases and entities...")
    accused_names_pool = ["Ramesh", "Suresh", "Kumar", "Vijay", "Anand", "Harish", "Santosh", "Manjunath", "Basavaraj", "Prakash"]
    victim_names_pool = ["Sunita", "Lakshmi", "Girish", "Kiran", "Nagaraj", "Shanthi", "Geetha", "Sandeep"]
    
    cases_created = 0
    accused_created = 0
    network_edges = []
    
    for c_idx in range(num_cases):
        dist_name = random.choice(KARNATAKA_DISTRICTS)
        dist_id = id_maps["District"][dist_name]
        station_id = random.choice(id_maps["Unit"][dist_name])
        
        # Crime Classification
        head = random.choice(CRIME_HEADS)
        h_id = id_maps["CrimeHead"][head]
        sub_id = random.choice(id_maps["CrimeSubHead"][head])
        
        reg_date = (datetime.now() - timedelta(days=random.randint(1, 1000))).strftime("%Y-%m-%d")
        lat = random.uniform(12.5, 17.5)
        lng = random.uniform(74.0, 78.5)
        facts = FACTS_TEMPLATES.get(CRIME_SUB_HEADS[head][0], FACTS_TEMPLATES["Theft"]).format(date=reg_date, station=dist_name)
        
        case_res = datastore.table("CaseMaster").insert_row({
            "crime_no": f"FIR/KAR/{dist_name.replace(' ', '')[:4].upper()}/{datetime.now().year}/{1000 + c_idx}",
            "case_no": f"CC-{random.randint(100, 9999)}/{datetime.now().year}",
            "crime_registered_date": reg_date,
            "police_person_id": random.choice(ios),
            "police_station_id": station_id,
            "case_category_id": random.choice(categories),
            "gravity_offence_id": random.choice(gravities),
            "crime_head_id": h_id,
            "crime_sub_head_id": sub_id,
            "case_status_id": random.choice(statuses),
            "court_id": random.choice(courts),
            "incident_from_date": reg_date,
            "incident_to_date": reg_date,
            "latitude": lat,
            "longitude": lng,
            "brief_facts": facts[:2000],
            "district_id": dist_id
        })
        case_id = int(case_res["ROWID"])
        cases_created += 1
        
        # Accused
        num_accused = random.randint(1, 2)
        accused_ids = []
        for a_idx in range(num_accused):
            a_name = random.choice(accused_names_pool)
            if random.random() < 0.15:
                a_name = "Basavaraj (Repeat)"
            acc_res = datastore.table("Accused").insert_row({
                "case_master_id": case_id,
                "accused_name": a_name,
                "age_year": random.randint(18, 65),
                "gender": random.choice(["Male", "Female"]),
                "person_id": f"A{a_idx + 1}"
            })
            acc_id = int(acc_res["ROWID"])
            accused_ids.append(acc_id)
            accused_created += 1
            
            # Seed Risk Scores
            datastore.table("RiskScore").insert_row({
                "accused_master_id": acc_id,
                "score": random.randint(20, 95),
                "model_version": "v1.0-NIM",
                "factors": "Recidivism probability based on prior offences and local crime density.",
                "computed_at": reg_date
            })
            
        # Victims
        num_victims = random.randint(1, 2)
        for _ in range(num_victims):
            datastore.table("Victim").insert_row({
                "case_master_id": case_id,
                "victim_name": random.choice(victim_names_pool),
                "age_year": random.randint(10, 70),
                "gender": random.choice(["Male", "Female"])
            })
            
        # Complainant
        datastore.table("ComplainantDetails").insert_row({
            "case_master_id": case_id,
            "complainant_name": f"Complainant {c_idx+1}",
            "age_year": random.randint(25, 60),
            "gender": random.choice(["Male", "Female"]),
            "occupation_id": random.choice(occupations)
        })
        
        # Arrests
        if random.random() < 0.6 and accused_ids:
            target_acc = random.choice(accused_ids)
            datastore.table("ArrestSurrender").insert_row({
                "case_master_id": case_id,
                "type_id": 1,
                "arrest_date": reg_date,
                "state_id": state_id,
                "district_id": dist_id,
                "police_station_id": station_id,
                "io_id": random.choice(ios),
                "court_id": random.choice(courts),
                "accused_master_id": target_acc,
                "is_accused": 1,
                "is_complainant_accused": 0
            })

        # Add network edges if there are multiple accused
        if len(accused_ids) > 1:
            network_edges.append({
                "accused_id_1": accused_ids[0],
                "accused_id_2": accused_ids[1],
                "relationship_type": "Co-Accused",
                "shared_case_ids": str(case_id)
            })

    # Hotspots
    for cat_id in categories:
        datastore.table("CrimeHotspot").insert_row({
            "geohash": f"tdr{random.randint(100, 999)}",
            "window_start": "2026-01-01",
            "window_end": "2026-01-31",
            "category_id": cat_id,
            "predicted_count": random.randint(5, 50),
            "confidence": random.uniform(0.7, 0.95)
        })

    # Seed Network Edges
    logger.info(f"Seeding {len(network_edges)} co-accused network edges...")
    for edge in network_edges[:50]:
        datastore.table("CaseNetworkEdge").insert_row(edge)

    # Seed Audit Logs
    logger.info("Seeding system audit logs...")
    for idx in range(20):
        datastore.table("AuditLog").insert_row({
            "user_id": random.choice(ios),
            "action": "SYSTEM_SEED",
            "resource_type": "database",
            "resource_ids": "all",
            "timestamp": (datetime.now(timezone.utc) - timedelta(days=idx)).isoformat()
        })

    logger.info("Cloud migration complete!")
    return {
        "status": "success",
        "cases_seeded": cases_created,
        "accused_seeded": accused_created,
        "message": "Seeded 200 synthetic case records successfully to Zoho Catalyst Data Store."
    }
