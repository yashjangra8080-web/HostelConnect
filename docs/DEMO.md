# HostelConnect — Demo Accounts & Persona Guide

This document defines the primary demo personas for testing and showcasing HostelConnect, including mess attendance, refund calculations, and residential features.

---

## 1. Primary Demo Students

| Metric / Attribute | Demo Student 1: Resident (High Attendance) | Demo Student 2: Resident (Mixed Attendance) | Demo Student 3: Non-Resident (Waitlisted) |
| :--- | :--- | :--- | :--- |
| **Full Name** | **Krishna Gupta** | **Mayank Jain** | **Dev Sethi** |
| **Roll Number** | `2026UITX0192` | `2026UEEX0214` | `2026UCSDS0001` |
| **Student ID** | `192` | `214` | `1` |
| **User ID** | `202` | `224` | `11` |
| **Credentials** | `2026UITX0192` / `Password@123` | `2026UEEX0214` / `Password@123` | `2026UCSDS0001` / `Password@123` |
| **Residency Status** | **Resident (Allotted)** | **Resident (Allotted)** | **Non-Resident (Waitlisted)** |
| **Hostel & Room** | BH1 (Boys Hostel 1), Room 101 | BH1 (Boys Hostel 1), Room 102 | *None (Waitlisted candidate)* |
| **Applicant Category**| Non-Delhi (Outside-Delhi Priority) | Non-Delhi (Outside-Delhi Priority) | Delhi Candidate (`is_delhi_candidate = 1`) |
| **Allotment Cycle** | 2026-27 Autumn Semester | 2026-27 Autumn Semester | 2026-27 Autumn Semester (Unallotted) |
| **Attendance Trait** | **REGULAR (High Adherence)** | **SKIPS_BREAKFAST (Mixed)** | **N/A (Non-Resident)** |
| **Sept 2026 Scheduled**| 117 meals (3 closures) | 117 meals (3 closures) | 0 meals (N/A) |
| **Sept 2026 Eaten** | **109 meals (93.2%)** | **74 meals (63.2%)** | 0 meals |
| **Sept 2026 Missed** | 8 meals | 43 meals | 0 meals |
| **Free Skips Allowed**| 8 meals | 8 meals | 8 meals |
| **Deductible Misses** | 0 meals (8 - 8 = 0) | 35 meals (43 - 8 = 35) | 0 meals |
| **Sept Refund (FINAL)**| **₹0.00** | **₹980.00** (35 × ₹28.00) | **₹0.00** (No ledger records) |
| **Mess Strip UI State**| Populated with eaten/missed/closed | Populated with eaten/missed/closed | **Clean Non-Resident Empty State** |

---

## 2. Dev Sethi Root-Cause Summary

- **Question**: Why does student Dev Sethi (`2026UCSDS0001`) see an empty strip?
- **Root Cause**: Dev Sethi is a Delhi applicant (`is_delhi_candidate = 1`). Under the university seat-allocation policy, outside-Delhi students receive statutory priority for the 300 campus beds. Dev Sethi was waitlisted and does not hold an active hostel allotment. The backend correctly returns `404 Not Found` for resident-only mess endpoints (`/api/mess/me/month`).
- **Resolution**: Rather than rendering an empty 31-day placeholder grid with question marks or blank dots, the UI displays a structured non-resident informational banner explaining that mess facilities and dining rebates apply strictly to residential students.

---

## 3. Administrative Demo Accounts

All administrative accounts use the default demo password: `Password@123`

| Role | Login ID | Name / Scope | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin` | System Administrator | Full transparency logs, privilege proofs, system audits |
| **HOSTEL_OFFICE** | `office` | Dr. Ramesh Sharma | Allotment cycles, student verification, merit rankings |
| **CHIEF_WARDEN** | `chiefwarden` | Prof. Sanjeev Kumar | Disciplinary circulars, campus-wide escalation, security |
| **WARDEN** | `warden_bh1` | Dr. Ankit Gupta | BH1 block complaints, maintenance schedules, discipline |
| **CARETAKER** | `caretaker_bh1` | Caretaker Office BH1 | Laundry status, machine toggles, repair work orders |
| **MESS_MANAGER** | `mess_mgr` | Dining Hall Operations | Headcount counters, QR check-ins, monthly refund finalization |
| **SECURITY_GUARD**| `guard_bh1` | Gate Security Post | Gate pass verification, curfew timing enforcement |
