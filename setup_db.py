import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

CREATE_TABLES_SQL = """
-- Drop existing tables in reverse dependency order if needed
-- DROP TABLE IF EXISTS inv_arrestsurrenderaccused CASCADE;
-- DROP TABLE IF EXISTS ChargesheetDetails CASCADE;
-- DROP TABLE IF EXISTS ArrestSurrender CASCADE;
-- DROP TABLE IF EXISTS Accused CASCADE;
-- DROP TABLE IF EXISTS Victim CASCADE;
-- DROP TABLE IF EXISTS ActSectionAssociation CASCADE;
-- DROP TABLE IF EXISTS ComplainantDetails CASCADE;
-- DROP TABLE IF EXISTS Inv_OccuranceTime CASCADE;
-- DROP TABLE IF EXISTS CaseMaster CASCADE;
-- DROP TABLE IF EXISTS CrimeHeadActSection CASCADE;
-- DROP TABLE IF EXISTS Section CASCADE;
-- DROP TABLE IF EXISTS Act CASCADE;
-- DROP TABLE IF EXISTS CrimeSubHead CASCADE;
-- DROP TABLE IF EXISTS CrimeHead CASCADE;
-- DROP TABLE IF EXISTS Employee CASCADE;
-- DROP TABLE IF EXISTS Unit CASCADE;
-- DROP TABLE IF EXISTS UnitType CASCADE;
-- DROP TABLE IF EXISTS Court CASCADE;
-- DROP TABLE IF EXISTS District CASCADE;
-- DROP TABLE IF EXISTS State CASCADE;
-- DROP TABLE IF EXISTS CaseCategory CASCADE;
-- DROP TABLE IF EXISTS GravityOffence CASCADE;
-- DROP TABLE IF EXISTS CaseStatusMaster CASCADE;
-- DROP TABLE IF EXISTS OccupationMaster CASCADE;
-- DROP TABLE IF EXISTS ReligionMaster CASCADE;
-- DROP TABLE IF EXISTS CasteMaster CASCADE;
-- DROP TABLE IF EXISTS Rank CASCADE;
-- DROP TABLE IF EXISTS Designation CASCADE;

-- 1. Independent Lookup Tables
CREATE TABLE IF NOT EXISTS State (
    StateID INT PRIMARY KEY,
    StateName VARCHAR(255),
    NationalityID INT,
    Active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS District (
    DistrictID INT PRIMARY KEY,
    DistrictName VARCHAR(255),
    StateID INT REFERENCES State(StateID),
    Active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS UnitType (
    UnitTypeID INT PRIMARY KEY,
    UnitTypeName VARCHAR(255),
    CityDistState VARCHAR(100),
    Hierarchy INT,
    Active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS Unit (
    UnitID INT PRIMARY KEY,
    UnitName VARCHAR(255),
    TypeID INT REFERENCES UnitType(UnitTypeID),
    ParentUnit INT REFERENCES Unit(UnitID),
    NationalityID INT,
    StateID INT REFERENCES State(StateID),
    DistrictID INT REFERENCES District(DistrictID),
    Active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS Court (
    CourtID INT PRIMARY KEY,
    CourtName VARCHAR(255),
    DistrictID INT REFERENCES District(DistrictID),
    StateID INT REFERENCES State(StateID),
    Active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS Rank (
    RankID INT PRIMARY KEY,
    RankName VARCHAR(255),
    Hierarchy INT,
    Active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS Designation (
    DesignationID INT PRIMARY KEY,
    DesignationName VARCHAR(255),
    Active BOOLEAN DEFAULT TRUE,
    SortOrder INT
);

CREATE TABLE IF NOT EXISTS Employee (
    EmployeeID INT PRIMARY KEY,
    DistrictID INT REFERENCES District(DistrictID),
    UnitID INT REFERENCES Unit(UnitID),
    RankID INT REFERENCES Rank(RankID),
    DesignationID INT REFERENCES Designation(DesignationID),
    KGID VARCHAR(100),
    FirstName VARCHAR(255),
    EmployeeDOB DATE,
    GenderID INT,
    BloodGroupID INT,
    PhysicallyChallenged BOOLEAN DEFAULT FALSE,
    AppointmentDate DATE
);

CREATE TABLE IF NOT EXISTS CasteMaster (
    caste_master_id INT PRIMARY KEY,
    caste_master_name VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS ReligionMaster (
    ReligionID INT PRIMARY KEY,
    ReligionName VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS OccupationMaster (
    OccupationID INT PRIMARY KEY,
    OccupationName VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS CaseStatusMaster (
    CaseStatusID INT PRIMARY KEY,
    CaseStatusName VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS CaseCategory (
    CaseCategoryID INT PRIMARY KEY,
    LookupValue VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS GravityOffence (
    GravityOffenceID INT PRIMARY KEY,
    LookupValue VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS CrimeHead (
    CrimeHeadID INT PRIMARY KEY,
    CrimeGroupName VARCHAR(255),
    Active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS CrimeSubHead (
    CrimeSubHeadID INT PRIMARY KEY,
    CrimeHeadID INT REFERENCES CrimeHead(CrimeHeadID),
    CrimeHeadName VARCHAR(255),
    SeqID INT
);

CREATE TABLE IF NOT EXISTS Act (
    ActCode VARCHAR(100) PRIMARY KEY,
    ActDescription TEXT,
    ShortName VARCHAR(255),
    Active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS Section (
    SectionCode VARCHAR(100),
    ActCode VARCHAR(100) REFERENCES Act(ActCode),
    SectionDescription TEXT,
    Active BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (ActCode, SectionCode)
);

CREATE TABLE IF NOT EXISTS CrimeHeadActSection (
    CrimeHeadID INT REFERENCES CrimeHead(CrimeHeadID),
    ActCode VARCHAR(100) REFERENCES Act(ActCode),
    SectionCode VARCHAR(100),
    PRIMARY KEY (CrimeHeadID, ActCode, SectionCode),
    FOREIGN KEY (ActCode, SectionCode) REFERENCES Section(ActCode, SectionCode)
);

-- 2. Core CaseMaster Table
CREATE TABLE IF NOT EXISTS CaseMaster (
    CaseMasterID INT PRIMARY KEY,
    CrimeNo VARCHAR(100),
    CaseNo VARCHAR(100),
    CrimeRegisteredDate DATE,
    PolicePersonID INT REFERENCES Employee(EmployeeID),
    PoliceStationID INT REFERENCES Unit(UnitID),
    CaseCategoryID INT REFERENCES CaseCategory(CaseCategoryID),
    GravityOffenceID INT REFERENCES GravityOffence(GravityOffenceID),
    CrimeMajorHeadID INT REFERENCES CrimeHead(CrimeHeadID),
    CrimeMinorHeadID INT REFERENCES CrimeSubHead(CrimeSubHeadID),
    CaseStatusID INT REFERENCES CaseStatusMaster(CaseStatusID),
    CourtID INT REFERENCES Court(CourtID),
    IncidentFromDate TIMESTAMP,
    IncidentToDate TIMESTAMP,
    InfoReceivedPSDate TIMESTAMP,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    BriefFacts TEXT
);

-- 3. Case Related Detail Tables
CREATE TABLE IF NOT EXISTS ComplainantDetails (
    ComplainantID INT PRIMARY KEY,
    CaseMasterID INT REFERENCES CaseMaster(CaseMasterID),
    ComplainantName VARCHAR(255),
    AgeYear INT,
    OccupationID INT REFERENCES OccupationMaster(OccupationID),
    ReligionID INT REFERENCES ReligionMaster(ReligionID),
    CasteID INT REFERENCES CasteMaster(caste_master_id),
    GenderID INT
);

CREATE TABLE IF NOT EXISTS ActSectionAssociation (
    CaseMasterID INT REFERENCES CaseMaster(CaseMasterID),
    ActID VARCHAR(100) REFERENCES Act(ActCode),
    SectionID VARCHAR(100),
    ActOrderID INT,
    SectionOrderID INT,
    PRIMARY KEY (CaseMasterID, ActID, SectionID),
    FOREIGN KEY (ActID, SectionID) REFERENCES Section(ActCode, SectionCode)
);

CREATE TABLE IF NOT EXISTS Victim (
    VictimMasterID INT PRIMARY KEY,
    CaseMasterID INT REFERENCES CaseMaster(CaseMasterID),
    VictimName VARCHAR(255),
    AgeYear INT,
    GenderID INT,
    VictimPolice VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS Accused (
    AccusedMasterID INT PRIMARY KEY,
    CaseMasterID INT REFERENCES CaseMaster(CaseMasterID),
    AccusedName VARCHAR(255),
    AgeYear INT,
    GenderID INT,
    PersonID VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS ArrestSurrender (
    ArrestSurrenderID INT PRIMARY KEY,
    CaseMasterID INT REFERENCES CaseMaster(CaseMasterID),
    ArrestSurrenderTypeID INT,
    ArrestSurrenderDate DATE,
    ArrestSurrenderStateId INT REFERENCES State(StateID),
    ArrestSurrenderDistrictId INT REFERENCES District(DistrictID),
    PoliceStationID INT REFERENCES Unit(UnitID),
    IOID INT REFERENCES Employee(EmployeeID),
    CourtID INT REFERENCES Court(CourtID),
    AccusedMasterID INT REFERENCES Accused(AccusedMasterID),
    IsAccused BOOLEAN,
    IsComplainantAccused BOOLEAN
);

CREATE TABLE IF NOT EXISTS inv_arrestsurrenderaccused (
    ArrestSurrenderID INT REFERENCES ArrestSurrender(ArrestSurrenderID),
    AccusedMasterID INT REFERENCES Accused(AccusedMasterID),
    PRIMARY KEY (ArrestSurrenderID, AccusedMasterID)
);

CREATE TABLE IF NOT EXISTS ChargesheetDetails (
    CSID INT PRIMARY KEY,
    CaseMasterID INT REFERENCES CaseMaster(CaseMasterID),
    csdate TIMESTAMP,
    cstype CHAR(1),
    PolicePersonID INT REFERENCES Employee(EmployeeID)
);

CREATE TABLE IF NOT EXISTS Inv_OccuranceTime (
    CaseMasterID INT PRIMARY KEY REFERENCES CaseMaster(CaseMasterID)
);
"""

def main():
    if not DATABASE_URL or "[YOUR-PASSWORD]" in DATABASE_URL:
        print("ERROR: Please set your actual database password in the .env file.")
        return

    print("Connecting to Supabase PostgreSQL database...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        print("Executing table creation schema script...")
        cursor.execute(CREATE_TABLES_SQL)
        conn.commit()
        print("SUCCESS: All tables and columns created successfully in Supabase!")
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"FAILED to execute script: {e}")

if __name__ == "__main__":
    main()
