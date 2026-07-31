# Software Architecture & Requirements Guide: Pharmacy Expiry Tracker

This document serves as the primary technical specification and strategic blueprint for building the **Pharmacy Expiry Tracker**. It compiles all domain-specific insights, API integrations, hardware scanning mechanics, Health Canada DPD nuances, and fallback strategies discussed for implementation with AI development agents (e.g., Google Anti-Gravity).

---

## 1. Project Overview & Core Objectives

### **Primary Goal**
To build a fast, frictionless, and reliable software application for pharmacy staff to track medication expiration dates. Staff must be able to scan a physical medication bottle/package, automatically identify the exact product (brand, generic, strength, DIN, format), and record the lot number and expiry date with minimal manual typing.

### **Key Operational Constraints**
1. **Diverse Barcode Ecosystem:** Canadian pharmacy inventory consists of a mix of modern 2D barcodes (GS1 DataMatrix) and traditional 1D retail barcodes (UPC/EAN).
2. **Regulatory Differences:** Health Canada tracks clinical safety via 8-digit **Drug Identification Numbers (DINs)**, whereas package sizes (bottles of 30 vs. 100 vs. 500) are identified via **UPCs / GTINs**.
3. **Data Integrity & Speed:** Scanning must resolve product names in milliseconds without failing on custom or unindexed inventory.

---

## 2. Barcode Standards in Canadian Pharmacies

Understanding what happens when a physical package is scanned is critical for selecting the appropriate parser library.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                               PACKAGE BARCODES                                   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
    [ GS1 DataMatrix (2D Square) ]                     [ Linear UPC / EAN (1D) ]
    • Present on Rx stock bottles                     • Present on OTC, NHPs, & legacy Rx
    • Holds MULTIPLE data fields                      • Holds SINGLE data field (GTIN/UPC)
    • Contains: Product ID + Lot + Expiry + Serial     • Contains: Package ID only (No Lot/Exp)
```

### **1. 2D GS1 DataMatrix (Prescription Stock)**
* **Structure:** A square grid of high-density black and white pixels.
* **Embedded Identifiers (GS1 Application Identifiers):**
  * `(01)` GTIN / Product Identification Number
  * `(17)` Expiration Date (`YYMMDD` format)
  * `(10)` Lot / Batch Number
  * `(21)` Serial Number
* **Parser Requirement:** Must use a GS1-compliant parser (e.g., Scandit, Cognex, or open-source GS1 parsers) to extract structured JSON instead of raw continuous strings.

### **2. 1D Linear UPC/EAN (OTC & Legacy Rx)**
* **Structure:** Parallel vertical lines.
* **Limitation:** Only encodes a 12-digit or 13-digit product identifier. **Does NOT contain lot or expiry date.**
* **Requirement:** Requires database mapping to resolve the UPC to a product name and Health Canada DIN.

---

## 3. Product Resolution Architecture (The Hybrid Strategy)

To ensure **100% recognition coverage** across all medications, the app must execute a multi-tier fallback pipeline when an item is scanned.

```
                      ┌────────────────────────────────────────┐
                      │          EMPLOYEE SCANS BOTTLE         │
                      └───────────────────┬────────────────────┘
                                          │
    ┌─────────────────────────────────────┼─────────────────────────────────────┐
    ▼                                     ▼                                     ▼
[ Tier 1: Local Database ]       [ Tier 2: Dual Barcode + OCR ]      [ Tier 3: Gemini Vision API ]
• Fast local check (UPC -> DIN)  • Scans 1D UPC                     • Triggers if label is torn,
• Resolves in <50ms              • Simultaneously reads "DIN 12345678"  unbarcoded, or compounded
• Zero external network calls    • Auto-queries Health Canada DPD   • Returns JSON via AI vision
                                 • Auto-links new UPC in DB         • Multi-modal fall-back
```

### **Tier 1: Local Pre-Loaded Database (Fast Path)**
* **Mechanic:** The app queries an internal database (SQLite, PostgreSQL, or IndexedDB) pre-populated with master wholesaler catalogs (McKesson, Kohl & Frisch, PJC corporate exports) that link `UPC` -> `DIN + Brand Name + Format`.
* **Latency:** <50 ms.
* **Cost:** $0.00.

### **Tier 2: Dual Camera Scan (UPC + DIN OCR)**
* **Mechanic:** If the scanned UPC is not present in the local database, the camera frame simultaneously executes an on-device OCR scan looking for the string pattern `DIN` followed by 8 digits (e.g., `DIN 02243859`).
* **Resolution:** The app queries the free **Health Canada Drug Product Database (DPD) API**:
  `GET https://health-products.canada.ca/api/drug/drugproduct/?din=02243859`
* **Auto-Learning:** Upon receiving the brand name, the app automatically saves the mapping (`Scanned UPC` = `DIN`) into the local database so future scans resolve instantly on Tier 1.

### **Tier 3: Gemini Multimodal Vision API (Fallback Path)**
* **Mechanic:** For damaged labels, compounded products, or liquid items where barcodes are unreadable, the user captures a quick photo of the front label.
* **Processing:** The image is sent to the Gemini Vision API with a structured system prompt to extract product details directly from the visual text.

---

## 4. API Reference & Data Sources

| API / Resource | Purpose | Provider / Endpoint | Cost Structure |
| :--- | :--- | :--- | :--- |
| **Health Canada DPD API** | Official DIN lookup for generic name, active ingredients, and brand | `health-products.canada.ca/api/drug/` | **Free** (Public Government API) |
| **GS1 "Verified by GS1"** | Official global registry for GTIN/UPC validation | GS1 Official API | Enterprise Licensing |
| **Commercial UPC APIs** | Retail product lookup for OTCs (Tylenol, vitamins, creams) | Barcode Lookup / UPCitemdb API | Freemium / Pay-per-request |
| **Wholesaler Catalogs** | Cross-referencing 1D UPCs to DINs & packaging counts | McKesson / Kohl & Frisch / PMS Export | Internal / Included with Pharmacy Operations |
| **Gemini Vision API** | Optical label parsing for unbarcoded or damaged bottles | Google Cloud AI Studio (`gemini-2.5-flash`) | Pay-as-you-go (~$0.0001 - $0.0003 per scan) |
| **Twilio API** *(Optional)* | Sending SMS notifications for expiring stock/alerts | Twilio Telecom API | Pay-per-SMS (~$0.0075 / SMS) |

---

## 5. Gemini Vision API Integration & Cost Analysis

### **Model Recommendation**
Use `gemini-2.5-flash` or `gemini-3.5-flash` for vision tasks. It provides ultra-fast response times (<1 second) and low token costs compared to flagship reasoning models.

### **Conceptual Implementation (Python Backend)**

```python
import google.generativeai as genai
import json

def process_pharmacy_label(image_bytes: bytes) -> dict:
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    prompt = """
    You are a pharmacy automation assistant. Analyze this drug label image and return ONLY a raw JSON object with no markdown formatting:
    {
      "brand_name": "Full brand or generic name and strength (e.g., Atorvastatin 20mg)",
      "din": "8-digit DIN string if visible, else null",
      "format": "Package size/count if visible (e.g., Bottle of 100 Tablets), else null",
      "lot_number": "Lot/Batch number if visible, else null",
      "expiry_date": "YYYY-MM-DD format if visible, else null"
    }
    """
    
    response = model.generate_content([prompt, {"mime_type": "image/jpeg", "data": image_bytes}])
    clean_json = response.text.replace("```json", "").replace("```", "").strip()
    return json.loads(clean_json)
```

### **Commercial Economics**
* **Input Token Pricing:** ~$0.10 per 1,000,000 tokens.
* **Average Image Size:** ~258–1,000 tokens.
* **Cost per Scan:** ~$0.0001 to $0.0003 USD.
* **Monthly Cost (10,000 scans):** ~$1.00 to $3.00 USD.

---

## 6. Testing & Development Guidelines

### **Mobile & Hardware Testing**
* **DO NOT** test 2D DataMatrix codes using native iOS/Android camera apps or basic QR readers; they will output unparsed raw strings.
* **Recommended Demo Apps for Testing:**
  1. **Scandit Barcode Scanner (Demo App):** Tests enterprise-grade 2D GS1 DataMatrix parsing under poor light/glare.
  2. **GS1 Barcode Scanner / ScanVortex:** Validates application identifiers `(01)`, `(17)`, `(10)`.
  3. **Cognex Barcode Scanner:** Evaluates industrial camera performance on small vials and blister packs.

### **Database Schema Blueprint (Local Cache)**

```sql
CREATE TABLE inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upc VARCHAR(14) UNIQUE,
    din VARCHAR(8) NOT NULL,
    brand_name VARCHAR(255) NOT NULL,
    dosage_form VARCHAR(100),
    package_size VARCHAR(50),
    is_custom_entry BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expiry_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER REFERENCES inventory_items(id),
    lot_number VARCHAR(50),
    expiry_date DATE NOT NULL,
    quantity_on_hand INTEGER DEFAULT 1,
    scanned_by_user VARCHAR(100),
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 7. Actionable Prompt for Anti-Gravity Agent

To feed this technical specification into your AI coding agent (e.g., Google Anti-Gravity or Replit Agent), copy and paste the following prompt:

> **System Prompt for Agent:**
> *"I am building a web/mobile Pharmacy Expiry Tracker. Read the attached specification file (`pharmacy_expiry_tracker_spec.md`). Please implement the core data architecture based on the 3-tier fallback workflow:
> 1. Set up a local database schema holding `upc`, `din`, `brand_name`, `lot_number`, and `expiry_date`.
> 2. Implement a 2D GS1 DataMatrix parser that extracts GTIN, Lot (10), and Expiry (17) fields into clean JSON.
> 3. Implement an OCR fallback scanner that detects 8-digit Health Canada DINs (`DIN 02243859`) and queries the Health Canada DPD API (`https://health-products.canada.ca/api/drug/drugproduct/?din=...`).
> 4. Add a Gemini 2.5 Flash Vision API route for fallback image label parsing when barcodes are missing or damaged."*

---
*Document prepared for Victor Khoukaz — Technical Architecture Guide for Pharmacy Software Development.*
