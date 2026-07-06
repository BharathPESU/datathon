# Zoho Catalyst Data Store — Table Creation Guide
**Project:** Crime Analytics Platform  
**Environment:** Development (limit 5,000 records/table, 25,000 records total)

Since Zoho Catalyst does not support DDL (Data Definition Language) via code or ZCQL queries, all tables and their columns must be created manually in the Zoho Catalyst Console.

Follow this guide to create the required tables in your project.

---

## Table 1: State
* **Columns:**
  * `state_name`: Var Char (255)

---

## Table 2: District
* **Columns:**
  * `district_name`: Var Char (255)
  * `state_id`: Foreign Key (Target: `State` -> `ROWID`, On Delete: Set Null)

---

## Table 3: Unit (Police Stations)
* **Columns:**
  * `unit_name`: Var Char (255)
  * `unit_type_id`: Integer
  * `district_id`: Foreign Key (Target: `District` -> `ROWID`, On Delete: Set Null)

---

## Table 4: CrimeHead
* **Columns:**
  * `crime_head_name`: Var Char (255)

---

## Table 5: CrimeSubHead
* **Columns:**
  * `crime_sub_head_name`: Var Char (255)
  * `crime_head_id`: Foreign Key (Target: `CrimeHead` -> `ROWID`, On Delete: Cascade)

---

## Table 6: CaseCategory
* **Columns:**
  * `category_name`: Var Char (255)

---

## Table 7: GravityOffence
* **Columns:**
  * `gravity_name`: Var Char (255)

---

## Table 8: CaseStatus
* **Columns:**
  * `status_name`: Var Char (255)

---

## Table 9: Court
* **Columns:**
  * `court_name`: Var Char (255)
  * `district_id`: Foreign Key (Target: `District` -> `ROWID`, On Delete: Set Null)

---

## Table 10: Rank
* **Columns:**
  * `rank_name`: Var Char (255)

---

## Table 11: Designation
* **Columns:**
  * `designation_name`: Var Char (255)

---

## Table 12: Employee
* **Columns:**
  * `emp_name`: Var Char (255)
  * `rank_id`: Foreign Key (Target: `Rank` -> `ROWID`, On Delete: Set Null)
  * `designation_id`: Foreign Key (Target: `Designation` -> `ROWID`, On Delete: Set Null)
  * `unit_id`: Foreign Key (Target: `Unit` -> `ROWID`, On Delete: Set Null)

---

## Table 13: Act
* **Columns:**
  * `act_name`: Var Char (255)

---

## Table 14: Section
* **Columns:**
  * `section_name`: Var Char (255)
  * `act_id`: Foreign Key (Target: `Act` -> `ROWID`, On Delete: Cascade)

---

## Table 15: OccupationMaster
* **Columns:**
  * `occupation_name`: Var Char (255)

---

## Table 16: CaseMaster (Main Case FIR)
* **Columns:**
  * `crime_no`: Var Char (255) (Set Unique Index)
  * `case_no`: Var Char (255)
  * `crime_registered_date`: Var Char (255)
  * `police_person_id`: Integer
  * `police_station_id`: Foreign Key (Target: `Unit` -> `ROWID`, On Delete: Set Null)
  * `case_category_id`: Foreign Key (Target: `CaseCategory` -> `ROWID`, On Delete: Set Null)
  * `gravity_offence_id`: Foreign Key (Target: `GravityOffence` -> `ROWID`, On Delete: Set Null)
  * `crime_head_id`: Foreign Key (Target: `CrimeHead` -> `ROWID`, On Delete: Set Null)
  * `crime_sub_head_id`: Foreign Key (Target: `CrimeSubHead` -> `ROWID`, On Delete: Set Null)
  * `case_status_id`: Foreign Key (Target: `CaseStatus` -> `ROWID`, On Delete: Set Null)
  * `court_id`: Foreign Key (Target: `Court` -> `ROWID`, On Delete: Set Null)
  * `incident_from_date`: Var Char (255)
  * `incident_to_date`: Var Char (255)
  * `latitude`: Double / Float / Numeric
  * `longitude`: Double / Float / Numeric
  * `brief_facts`: Text (Up to 10,000 chars)
  * `district_id`: Foreign Key (Target: `District` -> `ROWID`, On Delete: Set Null)

---

## Table 17: Accused
* **Columns:**
  * `case_master_id`: Foreign Key (Target: `CaseMaster` -> `ROWID`, On Delete: Cascade)
  * `accused_name`: Var Char (255)
  * `age_year`: Integer
  * `gender`: Var Char (255)
  * `person_id`: Var Char (255) (e.g. A1, A2)

---

## Table 18: Victim
* **Columns:**
  * `case_master_id`: Foreign Key (Target: `CaseMaster` -> `ROWID`, On Delete: Cascade)
  * `victim_name`: Var Char (255)
  * `age_year`: Integer
  * `gender`: Var Char (255)

---

## Table 19: ComplainantDetails
* **Columns:**
  * `case_master_id`: Foreign Key (Target: `CaseMaster` -> `ROWID`, On Delete: Cascade)
  * `complainant_name`: Var Char (255)
  * `age_year`: Integer
  * `gender`: Var Char (255)
  * `occupation_id`: Foreign Key (Target: `OccupationMaster` -> `ROWID`, On Delete: Set Null)
  * `religion_id`: Integer (For future use)
  * `caste_id`: Integer (For future use)

---

## Table 20: ArrestSurrender
* **Columns:**
  * `case_master_id`: Foreign Key (Target: `CaseMaster` -> `ROWID`, On Delete: Cascade)
  * `type_id`: Integer
  * `arrest_date`: Var Char (255)
  * `state_id`: Foreign Key (Target: `State` -> `ROWID`, On Delete: Set Null)
  * `district_id`: Foreign Key (Target: `District` -> `ROWID`, On Delete: Set Null)
  * `police_station_id`: Foreign Key (Target: `Unit` -> `ROWID`, On Delete: Set Null)
  * `io_id`: Integer
  * `court_id`: Foreign Key (Target: `Court` -> `ROWID`, On Delete: Set Null)
  * `accused_master_id`: Foreign Key (Target: `Accused` -> `ROWID`, On Delete: Cascade)
  * `is_accused`: Integer
  * `is_complainant_accused`: Integer

---

## Table 21: AppUser
* **Columns:**
  * `username`: Var Char (255) (Set Unique Index)
  * `hashed_password`: Var Char (255)
  * `role`: Var Char (255)
  * `employee_id`: Integer

---

## Table 22: ChatSession
* **Columns:**
  * `session_uuid`: Var Char (255) (Set Unique Index)
  * `user_id`: Integer
  * `language`: Var Char (255)
  * `started_at`: Var Char (255)
  * `ended_at`: Var Char (255)

---

## Table 23: ChatMessage
* **Columns:**
  * `message_uuid`: Var Char (255)
  * `session_id`: Var Char (255)
  * `role`: Var Char (255)
  * `content`: Text (Up to 10,000 chars)
  * `retrieved_refs`: Text (Up to 10,000 chars)
  * `created_at`: Var Char (255)

---

## Table 24: AuditLog
* **Columns:**
  * `user_id`: Integer
  * `action`: Var Char (255)
  * `resource_type`: Var Char (255)
  * `resource_ids`: Var Char (255)
  * `timestamp`: Var Char (255)

---

## Table 25: RiskScore
* **Columns:**
  * `accused_master_id`: Integer
  * `score`: Integer
  * `model_version`: Var Char (255)
  * `factors`: Text (Up to 10,000 chars)
  * `computed_at`: Var Char (255)

---

## Table 26: CaseNetworkEdge
* **Columns:**
  * `accused_id_1`: Integer
  * `accused_id_2`: Integer
  * `relationship_type`: Var Char (255)
  * `shared_case_ids`: Var Char (255)

---

## Table 27: CrimeHotspot
* **Columns:**
  * `geohash`: Var Char (255)
  * `window_start`: Var Char (255)
  * `window_end`: Var Char (255)
  * `category_id`: Integer
  * `predicted_count`: Integer
  * `confidence`: Double
