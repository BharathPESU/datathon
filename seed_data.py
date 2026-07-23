import os
import psycopg2
from dotenv import load_dotenv
import random
from datetime import datetime, timedelta

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def seed_database():
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    print("Seeding Karnataka Police FIR Database with realistic Karnataka mock data...")

    # 1. State (Karnataka)
    cursor.execute("""
        INSERT INTO State (StateID, StateName, NationalityID, Active)
        VALUES (29, 'Karnataka', 1, TRUE)
        ON CONFLICT (StateID) DO NOTHING;
    """)

    # 2. Districts (Karnataka real districts)
    districts = [
        (1, 'Bengaluru City', 29),
        (2, 'Bengaluru Rural', 29),
        (3, 'Mysuru City', 29),
        (4, 'Mysuru District', 29),
        (5, 'Mangaluru City (Dakshina Kannada)', 29),
        (6, 'Hubballi-Dharwad City', 29),
        (7, 'Belagavi', 29),
        (8, 'Kalaburagi', 29),
        (9, 'Ballari', 29),
        (10, 'Shivamogga', 29),
        (11, 'Tumakuru', 29),
        (12, 'Udupi', 29),
        (13, 'Hassan', 29),
        (14, 'Davangere', 29),
        (15, 'Vijayapura', 29)
    ]
    for d_id, d_name, s_id in districts:
        cursor.execute("""
            INSERT INTO District (DistrictID, DistrictName, StateID, Active)
            VALUES (%s, %s, %s, TRUE) ON CONFLICT (DistrictID) DO NOTHING;
        """, (d_id, d_name, s_id))

    # 3. Unit Types & Units (Karnataka Police Stations & Offices)
    unit_types = [
        (1, 'Police Station', 'City', 4),
        (2, 'Circle Office', 'District', 3),
        (3, 'Sub-Division Office', 'District', 2),
        (4, 'District Police Headquarters', 'District', 1)
    ]
    for ut_id, ut_name, level, hier in unit_types:
        cursor.execute("""
            INSERT INTO UnitType (UnitTypeID, UnitTypeName, CityDistState, Hierarchy, Active)
            VALUES (%s, %s, %s, %s, TRUE) ON CONFLICT (UnitTypeID) DO NOTHING;
        """, (ut_id, ut_name, level, hier))

    units = [
        (1001, 'Koramangala Police Station', 1, None, 1, 29, 1),
        (1002, 'Indiranagar Police Station', 1, None, 1, 29, 1),
        (1003, 'Cubbon Park Police Station', 1, None, 1, 29, 1),
        (1004, 'M.G. Road Police Station, Mysuru', 1, None, 1, 29, 3),
        (1005, 'Nazarbad Police Station, Mysuru', 1, None, 1, 29, 3),
        (1006, 'Panambur Police Station, Mangaluru', 1, None, 1, 29, 5),
        (1007, 'Suburban Police Station, Dharwad', 1, None, 1, 29, 6),
        (1008, 'APMC Police Station, Belagavi', 1, None, 1, 29, 7),
        (1009, 'Brahampur Police Station, Kalaburagi', 1, None, 1, 29, 8),
        (1010, 'Jayanagar Police Station, Shivamogga', 1, None, 1, 29, 10)
    ]
    for u_id, u_name, t_id, parent, nat, s_id, d_id in units:
        cursor.execute("""
            INSERT INTO Unit (UnitID, UnitName, TypeID, ParentUnit, NationalityID, StateID, DistrictID, Active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE) ON CONFLICT (UnitID) DO NOTHING;
        """, (u_id, u_name, t_id, parent, nat, s_id, d_id))

    # 4. Courts in Karnataka
    courts = [
        (501, '1st Additional Chief Metropolitan Magistrate Court, Bengaluru', 1, 29),
        (502, 'City Civil & Sessions Court, Bengaluru', 1, 29),
        (503, 'Principal District & Sessions Court, Mysuru', 3, 29),
        (504, 'JMFC 1st Court, Mangaluru', 5, 29),
        (505, 'District & Sessions Court, Belagavi', 7, 29),
        (506, 'Principal District Court, Kalaburagi', 8, 29)
    ]
    for c_id, c_name, d_id, s_id in courts:
        cursor.execute("""
            INSERT INTO Court (CourtID, CourtName, DistrictID, StateID, Active)
            VALUES (%s, %s, %s, %s, TRUE) ON CONFLICT (CourtID) DO NOTHING;
        """, (c_id, c_name, d_id, s_id))

    # 5. Ranks & Designations
    ranks = [
        (1, 'Police Sub-Inspector (PSI)', 5),
        (2, 'Circle Inspector (CPI)', 4),
        (3, 'Assistant Commissioner of Police (ACP)', 3),
        (4, 'Deputy Superintendent of Police (DySP)', 3),
        (5, 'Superintendent of Police (SP)', 2),
        (6, 'Head Constable (HC)', 6)
    ]
    for r_id, r_name, h in ranks:
        cursor.execute("""
            INSERT INTO Rank (RankID, RankName, Hierarchy, Active)
            VALUES (%s, %s, %s, TRUE) ON CONFLICT (RankID) DO NOTHING;
        """, (r_id, r_name, h))

    designations = [
        (1, 'Investigating Officer (IO)', 1),
        (2, 'Station House Officer (SHO)', 2),
        (3, 'Law & Order Officer', 3),
        (4, 'Crime Branch Officer', 4)
    ]
    for des_id, des_name, s_order in designations:
        cursor.execute("""
            INSERT INTO Designation (DesignationID, DesignationName, Active, SortOrder)
            VALUES (%s, %s, TRUE, %s) ON CONFLICT (DesignationID) DO NOTHING;
        """, (des_id, des_name, s_order))

    # 6. Employees (Karnataka Police Personnel with real KGID formats)
    employees = [
        (2001, 1, 1001, 1, 1, 'KGID-847291', 'Ramesh', '1985-06-12', 1, 1, False, '2010-08-15'),
        (2002, 1, 1002, 2, 2, 'KGID-739102', 'Siddaramaiah', '1982-03-24', 1, 2, False, '2007-04-10'),
        (2003, 3, 1004, 1, 1, 'KGID-910283', 'Manjunath', '1988-11-05', 1, 3, False, '2012-01-20'),
        (2004, 5, 1006, 1, 1, 'KGID-629104', 'Praveen', '1990-09-18', 1, 1, False, '2015-06-01'),
        (2005, 7, 1008, 2, 2, 'KGID-510928', 'Kavitha', '1987-02-14', 2, 4, False, '2011-09-12'),
        (2006, 8, 1009, 1, 1, 'KGID-401928', 'Basavaraj', '1984-12-30', 1, 1, False, '2009-03-25')
    ]
    for emp_id, d_id, u_id, r_id, des_id, kgid, fname, dob, g_id, bg_id, pc, app_dt in employees:
        cursor.execute("""
            INSERT INTO Employee (EmployeeID, DistrictID, UnitID, RankID, DesignationID, KGID, FirstName, EmployeeDOB, GenderID, BloodGroupID, PhysicallyChallenged, AppointmentDate)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (EmployeeID) DO NOTHING;
        """, (emp_id, d_id, u_id, r_id, des_id, kgid, fname, dob, g_id, bg_id, pc, app_dt))

    # 7. Lookup Master Tables
    castes = [(1, 'Vokkaliga'), (2, 'Lingayat'), (3, 'Kuruba'), (4, 'Brahmin'), (5, 'Scheduled Caste'), (6, 'Scheduled Tribe'), (7, 'Muslim'), (8, 'Christian')]
    for cid, cname in castes:
        cursor.execute("INSERT INTO CasteMaster (caste_master_id, caste_master_name) VALUES (%s, %s) ON CONFLICT (caste_master_id) DO NOTHING;", (cid, cname))

    religions = [(1, 'Hindu'), (2, 'Islam'), (3, 'Christianity'), (4, 'Jainism'), (5, 'Sikhism')]
    for rid, rname in religions:
        cursor.execute("INSERT INTO ReligionMaster (ReligionID, ReligionName) VALUES (%s, %s) ON CONFLICT (ReligionID) DO NOTHING;", (rid, rname))

    occupations = [(1, 'Software Engineer'), (2, 'Farmer / Agriculturist'), (3, 'Business / Trader'), (4, 'Government Employee'), (5, 'Student'), (6, 'Driver'), (7, 'Daily Wager')]
    for oid, oname in occupations:
        cursor.execute("INSERT INTO OccupationMaster (OccupationID, OccupationName) VALUES (%s, %s) ON CONFLICT (OccupationID) DO NOTHING;", (oid, oname))

    statuses = [(1, 'Under Investigation'), (2, 'Charge Sheeted'), (3, 'Closed - Undetected (C-Report)'), (4, 'Closed - False Case (B-Report)'), (5, 'Pending Trial')]
    for stid, stname in statuses:
        cursor.execute("INSERT INTO CaseStatusMaster (CaseStatusID, CaseStatusName) VALUES (%s, %s) ON CONFLICT (CaseStatusID) DO NOTHING;", (stid, stname))

    categories = [(1, 'FIR'), (2, 'UDR'), (3, 'PAR'), (4, 'Zero FIR')]
    for catid, catval in categories:
        cursor.execute("INSERT INTO CaseCategory (CaseCategoryID, LookupValue) VALUES (%s, %s) ON CONFLICT (CaseCategoryID) DO NOTHING;", (catid, catval))

    gravities = [(1, 'Heinous'), (2, 'Non-Heinous')]
    for gid, gval in gravities:
        cursor.execute("INSERT INTO GravityOffence (GravityOffenceID, LookupValue) VALUES (%s, %s) ON CONFLICT (GravityOffenceID) DO NOTHING;", (gid, gval))

    # 8. Crime Heads & Sub Heads
    crime_heads = [
        (1, 'Crimes Against Body'),
        (2, 'Crimes Against Property'),
        (3, 'Cyber Crimes'),
        (4, 'Crimes Against Women')
    ]
    for ch_id, ch_name in crime_heads:
        cursor.execute("INSERT INTO CrimeHead (CrimeHeadID, CrimeGroupName, Active) VALUES (%s, %s, TRUE) ON CONFLICT (CrimeHeadID) DO NOTHING;", (ch_id, ch_name))

    crime_sub_heads = [
        (101, 1, 'Murder', 1),
        (102, 1, 'Attempt to Murder', 2),
        (103, 2, 'Robbery & Dacoity', 1),
        (104, 2, 'House Breaking & Theft (HBT)', 2),
        (105, 3, 'Financial Fraud / Phishing', 1),
        (106, 4, 'Dowry Harassment', 1)
    ]
    for csh_id, ch_id, csh_name, seq in crime_sub_heads:
        cursor.execute("INSERT INTO CrimeSubHead (CrimeSubHeadID, CrimeHeadID, CrimeHeadName, SeqID) VALUES (%s, %s, %s, %s) ON CONFLICT (CrimeSubHeadID) DO NOTHING;", (csh_id, ch_id, csh_name, seq))

    # 9. Acts & Sections (IPC / BNS & Special Laws)
    acts = [
        ('IPC', 'Indian Penal Code, 1860', 'IPC'),
        ('BNS', 'Bharatiya Nyaya Sanhita, 2023', 'BNS'),
        ('IT_ACT', 'Information Technology Act, 2000', 'IT Act'),
        ('DP_ACT', 'Dowry Prohibition Act, 1961', 'DP Act')
    ]
    for acode, adesc, ashort in acts:
        cursor.execute("INSERT INTO Act (ActCode, ActDescription, ShortName, Active) VALUES (%s, %s, %s, TRUE) ON CONFLICT (ActCode) DO NOTHING;", (acode, adesc, ashort))

    sections = [
        ('IPC', '302', 'Punishment for murder'),
        ('IPC', '307', 'Attempt to murder'),
        ('IPC', '379', 'Punishment for theft'),
        ('IPC', '392', 'Punishment for robbery'),
        ('IPC', '498A', 'Husband or relative of husband subjecting woman to cruelty'),
        ('BNS', '103', 'Punishment for murder under BNS'),
        ('BNS', '303', 'Theft under BNS'),
        ('IT_ACT', '66D', 'Punishment for cheating by personation by using computer resource')
    ]
    for acode, scode, sdesc in sections:
        cursor.execute("INSERT INTO Section (ActCode, SectionCode, SectionDescription, Active) VALUES (%s, %s, %s, TRUE) ON CONFLICT (ActCode, SectionCode) DO NOTHING;", (acode, scode, sdesc))

    cursor.execute("""
        INSERT INTO CrimeHeadActSection (CrimeHeadID, ActCode, SectionCode)
        VALUES (1, 'IPC', '302'), (1, 'IPC', '307'), (2, 'IPC', '379'), (3, 'IT_ACT', '66D')
        ON CONFLICT DO NOTHING;
    """)

    # 10. Cases & Detail Data (Realistic Karnataka Incidents in Bengaluru, Mysuru, Mangaluru, etc.)
    cases = [
        (
            10001, '104430001202600001', '202600001', '2026-01-10', 2001, 1001, 1, 1, 1, 101, 1, 501,
            '2026-01-09 22:30:00', '2026-01-09 23:15:00', '2026-01-10 08:00:00', 12.9352, 77.6245,
            'On 09-01-2026 night near Koramangala 5th Block, during a property dispute argument, accused assaulted victim with a sharp weapon resulting in fatal injuries.'
        ),
        (
            10002, '104430002202600002', '202600002', '2026-01-15', 2002, 1002, 1, 2, 2, 104, 1, 502,
            '2026-01-14 14:00:00', '2026-01-14 18:00:00', '2026-01-15 10:30:00', 12.9784, 77.6408,
            'Complainant reported house breaking at Indiranagar 100ft Road. Gold ornaments worth Rs 4.5 Lakhs and cash stolen while family was away.'
        ),
        (
            10003, '104430003202600003', '202600003', '2026-01-20', 2003, 1004, 1, 2, 3, 105, 2, 503,
            '2026-01-19 11:00:00', '2026-01-19 12:00:00', '2026-01-20 09:15:00', 12.3052, 76.6552,
            'Victim received fraudulent call pretending to be bank manager asking for OTP, losing Rs 1.8 Lakhs from bank account.'
        ),
        (
            10004, '104430004202600004', '202600004', '2026-02-02', 2004, 1006, 1, 1, 4, 106, 1, 504,
            '2026-02-01 20:00:00', '2026-02-01 22:00:00', '2026-02-02 11:00:00', 12.9468, 74.8041,
            'Complainant alleged physical and mental harassment by husband and in-laws demanding additional dowry of Rs 10 Lakhs in cash and vehicle.'
        ),
        (
            10005, '104430005202600005', '202600005', '2026-02-12', 2005, 1008, 1, 2, 2, 103, 1, 505,
            '2026-02-11 23:45:00', '2026-02-12 01:00:00', '2026-02-12 07:30:00', 15.8872, 74.5241,
            'Two unidentified persons on a motorcycle snatched gold chain weighing 35 grams from victim walking near APMC Yard Belagavi.'
        )
    ]

    for c in cases:
        cursor.execute("""
            INSERT INTO CaseMaster (
                CaseMasterID, CrimeNo, CaseNo, CrimeRegisteredDate, PolicePersonID, PoliceStationID,
                CaseCategoryID, GravityOffenceID, CrimeMajorHeadID, CrimeMinorHeadID, CaseStatusID, CourtID,
                IncidentFromDate, IncidentToDate, InfoReceivedPSDate, latitude, longitude, BriefFacts
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (CaseMasterID) DO NOTHING;
        """, c)

    # 11. Complainants (Karnataka names & details)
    complainants = [
        (3001, 10001, 'Gowda Suresh Kumar', 45, 2, 1, 1, 1),
        (3002, 10002, 'Ananya Rao', 34, 1, 1, 4, 2),
        (3003, 10003, 'Keshava Murthy', 58, 4, 1, 4, 1),
        (3004, 10004, 'Divya Shetty', 28, 5, 1, 1, 2),
        (3005, 10005, 'Vijay Patil', 41, 3, 1, 2, 1)
    ]
    for comp in complainants:
        cursor.execute("""
            INSERT INTO ComplainantDetails (ComplainantID, CaseMasterID, ComplainantName, AgeYear, OccupationID, ReligionID, CasteID, GenderID)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (ComplainantID) DO NOTHING;
        """, comp)

    # 12. Act Section Association
    act_sections = [
        (10001, 'IPC', '302', 1, 1),
        (10002, 'IPC', '379', 1, 1),
        (10003, 'IT_ACT', '66D', 1, 1),
        (10004, 'IPC', '498A', 1, 1),
        (10005, 'IPC', '392', 1, 1)
    ]
    for as_assoc in act_sections:
        cursor.execute("""
            INSERT INTO ActSectionAssociation (CaseMasterID, ActID, SectionID, ActOrderID, SectionOrderID)
            VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING;
        """, as_assoc)

    # 13. Victims
    victims = [
        (4001, 10001, 'Venkatesh Gowda', 48, 1, '0'),
        (4002, 10002, 'Ananya Rao', 34, 2, '0'),
        (4003, 10003, 'Keshava Murthy', 58, 1, '0'),
        (4004, 10004, 'Divya Shetty', 28, 2, '0'),
        (4005, 10005, 'Sunitha Patil', 38, 2, '0')
    ]
    for v in victims:
        cursor.execute("""
            INSERT INTO Victim (VictimMasterID, CaseMasterID, VictimName, AgeYear, GenderID, VictimPolice)
            VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (VictimMasterID) DO NOTHING;
        """, v)

    # 14. Accused Persons
    accused = [
        (5001, 10001, 'Shankar Naik', 38, 1, 'A1'),
        (5002, 10002, 'Unknown Burglar / Intruder', 30, 1, 'A1'),
        (5003, 10003, 'Cyber Fraudster (Phishing Gang)', 25, 1, 'A1'),
        (5004, 10004, 'Rajesh Shetty', 32, 1, 'A1'),
        (5005, 10004, 'Sharada Shetty', 58, 2, 'A2'),
        (5006, 10005, 'Kiran Kumar', 26, 1, 'A1')
    ]
    for acc in accused:
        cursor.execute("""
            INSERT INTO Accused (AccusedMasterID, CaseMasterID, AccusedName, AgeYear, GenderID, PersonID)
            VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (AccusedMasterID) DO NOTHING;
        """, acc)

    # 15. Arrest / Surrender Events & Junction
    arrests = [
        (6001, 10001, 1, '2026-01-11', 29, 1, 1001, 2001, 501, 5001, True, False),
        (6002, 10004, 1, '2026-02-04', 29, 5, 1006, 2004, 504, 5004, True, False),
        (6003, 10005, 1, '2026-02-14', 29, 7, 1008, 2005, 505, 5006, True, False)
    ]
    for arr in arrests:
        cursor.execute("""
            INSERT INTO ArrestSurrender (
                ArrestSurrenderID, CaseMasterID, ArrestSurrenderTypeID, ArrestSurrenderDate,
                ArrestSurrenderStateId, ArrestSurrenderDistrictId, PoliceStationID, IOID, CourtID, AccusedMasterID, IsAccused, IsComplainantAccused
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT (ArrestSurrenderID) DO NOTHING;
        """, arr)

    cursor.execute("""
        INSERT INTO inv_arrestsurrenderaccused (ArrestSurrenderID, AccusedMasterID)
        VALUES (6001, 5001), (6002, 5004), (6003, 5006)
        ON CONFLICT DO NOTHING;
    """)

    # 16. Chargesheet Details
    chargesheets = [
        (7001, 10001, '2026-02-28 10:00:00', 'A', 2001)
    ]
    for cs in chargesheets:
        cursor.execute("""
            INSERT INTO ChargesheetDetails (CSID, CaseMasterID, csdate, cstype, PolicePersonID)
            VALUES (%s, %s, %s, %s, %s) ON CONFLICT (CSID) DO NOTHING;
        """, cs)

    # 17. Inv_OccuranceTime
    cursor.execute("INSERT INTO Inv_OccuranceTime (CaseMasterID) VALUES (10001), (10002), (10003), (10004), (10005) ON CONFLICT DO NOTHING;")

    conn.commit()
    cursor.close()
    conn.close()
    print("SUCCESS: Mock data inserted into all database tables successfully!")

if __name__ == "__main__":
    seed_database()
