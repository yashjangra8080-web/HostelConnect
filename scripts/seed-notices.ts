import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { pool, closeAllPools } from '../server/src/db.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

export interface NoticeRecord {
  notice_id: number;
  category: 'CIRCULAR' | 'WATER_QUALITY' | 'PEST_CONTROL' | 'ELECTRICIAN' | 'PLUMBER' | 'GENERAL';
  hostel_id: number | null;
  title: string;
  body: string;
  is_pinned: number;
  starts_at: string;
  ends_at: string;
  posted_by: number;
}

export const REALISTIC_NOTICES: NoticeRecord[] = [
  // 1. Water Tank Cleaning BH1 (Referenced by Notification 1)
  {
    notice_id: 1,
    category: 'WATER_QUALITY',
    hostel_id: 1,
    title: 'Overhead Drinking Water Tank Cleaning & Chlorination — BH1',
    body: 'Please note that the overhead drinking water storage tanks of Boys Hostel 1 will undergo scheduled high-pressure hydraulic cleaning and chlorination on Wednesday, 04 Nov 2026 between 09:00 and 14:00 IST. Water supply to all floor washrooms will be temporarily shut off during this period. Residents are requested to store adequate water in advance for morning use.',
    is_pinned: 1,
    starts_at: '2026-11-02 08:30:00',
    ends_at: '2026-11-05 18:00:00',
    posted_by: 8, // Caretaker BH1 (Mr. Jagdish Prasad)
  },
  // 2. Gate Timings (Campus Wide)
  {
    notice_id: 2,
    category: 'CIRCULAR',
    hostel_id: null,
    title: 'Winter Semester Hostel Gate Timings & Biometric In-Out Protocol',
    body: 'Effective 01 November 2026, the main campus entry gates for all hostels (BH1, BH2, GH1, GH2) shall strictly close at 22:00 IST. Late entry between 22:00 and 23:00 IST will strictly require biometric punch-in and authorization from the respective hostel warden. Unauthorized late entries beyond 23:00 IST will be escalated to the Proctorial Board.',
    is_pinned: 1,
    starts_at: '2026-10-31 10:00:00',
    ends_at: '2026-11-30 23:59:59',
    posted_by: 2, // Chief Warden (Prof. Sanjeev Kumar)
  },
  // 3. Fee Circular / Refund Audit
  {
    notice_id: 3,
    category: 'CIRCULAR',
    hostel_id: null,
    title: 'Mandatory Dining Rebate Audit & Semester Fee Reconciliation Circular',
    body: 'All registered hostel residents are hereby notified that the dining rebate calculation for September 2026 has been finalized and credited to their student mess ledger. October attendance preview is now open for resident verification. Any discrepancies in counter marking or biometric logs must be reported to the Mess Manager before 07 Nov 2026.',
    is_pinned: 1,
    starts_at: '2026-11-01 09:00:00',
    ends_at: '2026-11-15 17:00:00',
    posted_by: 1, // Hostel Office (Dr. Ramesh Sharma)
  },
  // 4. Electrician Visit BH1 (Referenced by Notification)
  {
    notice_id: 4,
    category: 'ELECTRICIAN',
    hostel_id: 1,
    title: 'Routine Geyser & Electrical MCB Inspection across All Floors (BH1)',
    body: 'Campus electrical staff will be inspecting water geysers and distribution sub-boards across Ground, First, and Second floors of BH1 on 28-29 October 2026. Please ensure electrical points are accessible. Report any faulty sockets to the caretaker logbook.',
    is_pinned: 0,
    starts_at: '2026-10-27 16:30:00',
    ends_at: '2026-10-30 18:00:00',
    posted_by: 8, // Caretaker BH1
  },
  // 5. Water Quality Results Week 43 (Referenced by Notification)
  {
    notice_id: 5,
    category: 'WATER_QUALITY',
    hostel_id: null,
    title: 'Weekly Potable Water Quality Laboratory Test Results (Week 43)',
    body: 'Comprehensive chemical and microbial testing was conducted for all underground reservoirs and RO dispensing units across BH1, BH2, GH1, and GH2 on 26 Oct 2026. TDS levels remained within optimal limits (240–310 PPM), pH balanced at 7.2–7.5, and free residual chlorine measured at 0.25 mg/L. All points certified SAFE for drinking.',
    is_pinned: 0,
    starts_at: '2026-10-26 15:00:00',
    ends_at: '2026-11-09 23:59:59',
    posted_by: 2, // Chief Warden
  },
  // 6. Wi-Fi Downtime (Referenced by Notification)
  {
    notice_id: 6,
    category: 'GENERAL',
    hostel_id: 1,
    title: 'Campus Wi-Fi Optical Fiber Splicing & Maintenance Downtime',
    body: 'Computer Center maintenance team will carry out optical fiber cable termination and access point firmware upgrades in BH1 and surrounding quads on 26 Oct 2026 from 01:00 to 05:00 IST. High-speed LAN and Wi-Fi access may experience intermittent disruption during early morning hours.',
    is_pinned: 0,
    starts_at: '2026-10-25 18:00:00',
    ends_at: '2026-10-27 12:00:00',
    posted_by: 3, // Warden BH1
  },
  // 7. Plumber Visit BH2 (Referenced by Notification)
  {
    notice_id: 7,
    category: 'PLUMBER',
    hostel_id: 2,
    title: 'Main Pipeline Valve Replacement & Plumbing Maintenance — BH2',
    body: 'Replacement of corroded gate valves in the West Wing plumbing shaft of Boys Hostel 2 is scheduled for 21 Oct 2026 between 14:00 and 17:00 IST. Low water pressure may be observed in 2nd and 3rd floor washrooms.',
    is_pinned: 0,
    starts_at: '2026-10-20 11:00:00',
    ends_at: '2026-10-22 18:00:00',
    posted_by: 4, // Warden BH2
  },
  // 8. Mess Menu Changes (Referenced by Notification)
  {
    notice_id: 8,
    category: 'GENERAL',
    hostel_id: null,
    title: 'Revised Winter Dining Menu & Introduction of Sunday Feast Specials',
    body: 'Following recommendations of the Student Mess Committee meeting held on 29 Oct 2026, the North Indian rotating menu has been refreshed with seasonal winter greens, gobhi paratha with white butter, kadhi pakora, and Sunday festive chole-bhature with gulab jamun. The updated 14-day cycle is operational across all hostel dining halls.',
    is_pinned: 0,
    starts_at: '2026-11-01 12:00:00',
    ends_at: '2026-11-30 23:59:59',
    posted_by: 7, // Mess Manager
  },
  // 9. Mosquito Fogging BH1 & BH2
  {
    notice_id: 9,
    category: 'PEST_CONTROL',
    hostel_id: 1,
    title: 'Anti-Dengue Thermal Fogging & Larvicide Spray Schedule — BH1',
    body: 'In coordination with South Delhi Municipal Corporation health officials, thermal mosquito fogging and pyrethrum spray will be conducted around BH1 hostel corridors, staircases, and surrounding garden areas on Friday, 30 Oct 2026 from 16:30 to 18:00 IST. Residents are advised to keep room windows closed during the fogging operation.',
    is_pinned: 0,
    starts_at: '2026-10-29 09:00:00',
    ends_at: '2026-10-31 19:00:00',
    posted_by: 8, // Caretaker BH1
  },
  // 10. Mosquito Fogging GH1 & GH2
  {
    notice_id: 10,
    category: 'PEST_CONTROL',
    hostel_id: 3,
    title: 'Campus Fumigation & Vector Control Operation — GH1 & GH2',
    body: 'Routine vector control fogging will be carried out across Girls Hostel 1 and 2 peripheral courtyards on Saturday, 31 Oct 2026 from 16:00 to 17:30 IST. Please ensure laundry on open balconies is brought indoors prior to 15:30 IST.',
    is_pinned: 0,
    starts_at: '2026-10-30 10:00:00',
    ends_at: '2026-11-01 18:00:00',
    posted_by: 9, // Caretaker GH1
  },
  // 11. Quiet Hours Circular
  {
    notice_id: 11,
    category: 'CIRCULAR',
    hostel_id: null,
    title: 'Enforcement of Mandatory Study Hours & Noise Regulation Policy',
    body: 'In view of forthcoming Mid-Semester Examinations, strict quiet hours will be in effect across all residential blocks from 22:30 to 06:00 IST daily. Playing loud music, shouting in corridors, and gathering in common stairwells during these hours is strictly prohibited and subject to disciplinary action.',
    is_pinned: 1,
    starts_at: '2026-10-18 10:00:00',
    ends_at: '2026-11-15 23:59:59',
    posted_by: 2, // Chief Warden
  },
  // 12. Smart Laundry Maintenance GH1
  {
    notice_id: 12,
    category: 'GENERAL',
    hostel_id: 3,
    title: 'Smart Laundry Room Drainage Sump Maintenance & Drum Descaling — GH1',
    body: 'Preventive maintenance and descaling of commercial washing machines in the GH1 Ground Floor laundry room will take place on Tuesday, 27 Oct 2026 between 10:00 and 14:00 IST. Two machines will remain operational for emergency loads during the service window.',
    is_pinned: 0,
    starts_at: '2026-10-25 09:00:00',
    ends_at: '2026-10-28 15:00:00',
    posted_by: 9, // Caretaker GH1
  },
  // 13. Water Quality Results Week 42
  {
    notice_id: 13,
    category: 'WATER_QUALITY',
    hostel_id: null,
    title: 'Weekly Potable Water Quality Laboratory Test Results (Week 42)',
    body: 'Weekly water potability analysis reports from the Civil Engineering Environmental Lab indicate that all tested parameters across BH1, BH2, GH1, GH2 comply fully with IS 10500:2012 standards. Turbidity < 1.0 NTU, coliform absent.',
    is_pinned: 0,
    starts_at: '2026-10-19 14:00:00',
    ends_at: '2026-11-02 23:59:59',
    posted_by: 2, // Chief Warden
  },
  // 14. Plumber Visit GH1
  {
    notice_id: 14,
    category: 'PLUMBER',
    hostel_id: 3,
    title: 'Bathroom Tap Replacement & Shower Head De-scaling Drive — GH1',
    body: 'Maintenance team will be replacing aerators and servicing hot water mixer valves in GH1 block A and B bathrooms on 22-23 October 2026. Residents are requested to facilitate access to designated floor washrooms.',
    is_pinned: 0,
    starts_at: '2026-10-21 08:30:00',
    ends_at: '2026-10-24 17:00:00',
    posted_by: 9, // Caretaker GH1
  },
  // 15. Electrician Visit BH2
  {
    notice_id: 15,
    category: 'ELECTRICIAN',
    hostel_id: 2,
    title: 'Corridor LED Tube Replacement & Emergency Light Servicing — BH2',
    body: 'Electrical section staff will replace non-functional LED fixtures and inspect battery backup units in stairwells of BH2 on Monday, 19 October 2026 from 09:30 to 13:00 IST.',
    is_pinned: 0,
    starts_at: '2026-10-17 11:00:00',
    ends_at: '2026-10-20 18:00:00',
    posted_by: 4, // Warden BH2
  },
  // 16. Diwali Vacation Room Safety Circular
  {
    notice_id: 16,
    category: 'CIRCULAR',
    hostel_id: null,
    title: 'Diwali Festival Break: Room Security, Power Down & Leave Application Notice',
    body: 'Students departing the campus during Diwali vacations are instructed to securely lock their rooms, switch off main MCB power switches, and ensure water taps are completely shut. All out-of-station travels must be logged via the Student Portal leave application by 28 Oct 2026.',
    is_pinned: 0,
    starts_at: '2026-10-22 10:00:00',
    ends_at: '2026-11-06 23:59:59',
    posted_by: 1, // Hostel Office
  },
  // 17. Special Festival Dinner Announcement
  {
    notice_id: 17,
    category: 'GENERAL',
    hostel_id: null,
    title: 'Grand Diwali Festive Feast & Mess Timings Schedule (01 Nov 2026)',
    body: 'A special celebratory dinner featuring Paneer Lababdar, Dal Makhani, Kashmiri Pulao, Butter Naan, and assorted sweets (Gulab Jamun, Kaju Katli) will be hosted in all dining halls on Sunday, 01 Nov 2026 from 19:30 to 22:30 IST. Regular snacks will not be served on this day.',
    is_pinned: 0,
    starts_at: '2026-10-28 12:00:00',
    ends_at: '2026-11-02 23:00:00',
    posted_by: 7, // Mess Manager
  },
  // 18. Water Quality Alert Week 41 (High TDS resolved)
  {
    notice_id: 18,
    category: 'WATER_QUALITY',
    hostel_id: 1,
    title: 'Follow-up Water Test Report: Underground Sump Filtration Overhaul (BH1)',
    body: 'Following filtration membrane flushing on 14 Oct 2026, re-testing of the BH1 underground tank confirmed that TDS has stabilized at 285 PPM, down from the earlier elevated 580 PPM spike. RO units have been re-commissioned and certified safe for resident consumption.',
    is_pinned: 0,
    starts_at: '2026-10-15 11:30:00',
    ends_at: '2026-10-29 23:59:59',
    posted_by: 8, // Caretaker BH1
  },
  // 19. Pest Control Termite Treatment
  {
    notice_id: 19,
    category: 'PEST_CONTROL',
    hostel_id: 2,
    title: 'Wood Preservative & Anti-Termite Treatment in Study Lounges — BH2',
    body: 'Specialist pest technicians will carry out drill-and-inject anti-termite barrier treatment in the BH2 ground floor reading room and library annexe on 16 Oct 2026. The reading room will remain closed until 18:00 IST on Saturday.',
    is_pinned: 0,
    starts_at: '2026-10-14 09:00:00',
    ends_at: '2026-10-17 19:00:00',
    posted_by: 4, // Warden BH2
  },
  // 20. Electrician High Voltage Line Maintenance
  {
    notice_id: 20,
    category: 'ELECTRICIAN',
    hostel_id: null,
    title: '11kV Campus Substation Transformer Servicing & Power Switchover',
    body: 'Delhi Transco maintenance engineers will service the main 11kV substation feeder on Sunday, 18 Oct 2026 from 06:00 to 09:00 IST. Campus backup diesel generators will supply essential lighting, lift operations, and water pump circuits during the switchover.',
    is_pinned: 0,
    starts_at: '2026-10-15 16:00:00',
    ends_at: '2026-10-19 12:00:00',
    posted_by: 1, // Hostel Office
  },
  // 21. Water Quality Results Week 40
  {
    notice_id: 21,
    category: 'WATER_QUALITY',
    hostel_id: null,
    title: 'Weekly Potable Water Quality Laboratory Test Results (Week 40)',
    body: 'Routine weekly microbiological testing across all campus dining and drinking facilities was executed on 12 Oct 2026. All water samples tested negative for pathogenic bacteria, E. coli, and fecal coliforms. Residual chlorine measured at 0.28 mg/L.',
    is_pinned: 0,
    starts_at: '2026-10-12 14:00:00',
    ends_at: '2026-10-26 23:59:59',
    posted_by: 2, // Chief Warden
  },
  // 22. Fire Safety Equipment Audit
  {
    notice_id: 22,
    category: 'CIRCULAR',
    hostel_id: null,
    title: 'Annual Fire Extinguisher Inspection & Hydrant Pressure Testing Schedule',
    body: 'Delhi Fire Service accredited inspectors will conduct pressure testing of dry chemical powder (ABC) fire extinguishers and water hose reels across all hostel corridors between 12-14 October 2026. Residents are requested not to obstruct fire exit corridors or stairways.',
    is_pinned: 0,
    starts_at: '2026-10-10 10:00:00',
    ends_at: '2026-10-16 18:00:00',
    posted_by: 2, // Chief Warden
  },
  // 23. Plumber Water Cooler Servicing GH2
  {
    notice_id: 23,
    category: 'PLUMBER',
    hostel_id: 4,
    title: 'Drinking Water Cooler Filter Replacement & Sanitization — GH2',
    body: 'Activated carbon filters and UV sterilization lamps in water coolers located on 1st, 2nd, and 3rd floors of GH2 will be replaced on Friday, 09 Oct 2026 between 11:00 and 15:00 IST.',
    is_pinned: 0,
    starts_at: '2026-10-07 14:00:00',
    ends_at: '2026-10-10 18:00:00',
    posted_by: 6, // Warden GH2
  },
  // 24. Mess Maintenance Day Closure
  {
    notice_id: 24,
    category: 'GENERAL',
    hostel_id: null,
    title: 'Monthly Kitchen Exhaust Duct Deep-Cleaning & Lunch Rescheduling',
    body: 'Commercial exhaust hoods, chimney blowers, and kitchen oil traps in all hostel messes will undergo professional degreasing on 07 Oct 2026. Snacks service will be provided as packed tea and biscuits in dining foyers.',
    is_pinned: 0,
    starts_at: '2026-10-05 11:00:00',
    ends_at: '2026-10-08 20:00:00',
    posted_by: 7, // Mess Manager
  },
  // 25. Water Quality Results Week 39
  {
    notice_id: 25,
    category: 'WATER_QUALITY',
    hostel_id: null,
    title: 'Weekly Potable Water Quality Laboratory Test Results (Week 39)',
    body: 'Potable water test samples collected on 05 Oct 2026 confirmed safe drinking water parameters across all hostel taps. TDS: 290 PPM, pH: 7.3, Hardness: 110 mg/L CaCO3 equivalent.',
    is_pinned: 0,
    starts_at: '2026-10-05 15:00:00',
    ends_at: '2026-10-19 23:59:59',
    posted_by: 2, // Chief Warden
  },
  // 26. Electrician Generator Testing GH1
  {
    notice_id: 26,
    category: 'ELECTRICIAN',
    hostel_id: 3,
    title: 'Backup Diesel Generator Synchronization & Full Load Trial — GH1',
    body: 'Trial synchronization of the newly installed 125 kVA silent generator set for GH1 will take place on Saturday, 03 Oct 2026 from 10:00 to 11:30 IST. Two brief 5-minute outages may occur as circuits transfer from grid to generator power.',
    is_pinned: 0,
    starts_at: '2026-10-01 12:00:00',
    ends_at: '2026-10-04 18:00:00',
    posted_by: 5, // Warden GH1
  },
  // 27. Pest Control Kitchen Desensitization
  {
    notice_id: 27,
    category: 'PEST_CONTROL',
    hostel_id: 1,
    title: 'Food-Grade Cockroach Gel Baiting & Kitchen Sanitization — BH1 Mess',
    body: 'Certified organic gel baiting against kitchen pests will be applied in pantry storage areas, cold rooms, and vegetable preparation halls of BH1 mess on Thursday, 01 Oct 2026 after dinner service (22:30 IST).',
    is_pinned: 0,
    starts_at: '2026-09-30 15:00:00',
    ends_at: '2026-10-03 12:00:00',
    posted_by: 7, // Mess Manager
  },
  // 28. Water Quality Results Week 38
  {
    notice_id: 28,
    category: 'WATER_QUALITY',
    hostel_id: null,
    title: 'Weekly Potable Water Quality Laboratory Test Results (Week 38)',
    body: 'Water samples taken from all 4 hostel dining halls on 28 Sept 2026 demonstrated compliance with drinking water norms. Free chlorine residual of 0.22 mg/L recorded.',
    is_pinned: 0,
    starts_at: '2026-09-28 14:00:00',
    ends_at: '2026-10-12 23:59:59',
    posted_by: 2, // Chief Warden
  },
  // 29. Bicycle Parking & Registration Circular
  {
    notice_id: 29,
    category: 'CIRCULAR',
    hostel_id: null,
    title: 'Mandatory Student Bicycle Tagging & Campus Parking Regulation',
    body: 'All students parking bicycles in designated hostel cycle stands must obtain an authorized barcode security sticker from the respective caretaker office before 05 Oct 2026. Unregistered bicycles obstructing pedestrian pathways will be confiscated by campus security.',
    is_pinned: 0,
    starts_at: '2026-09-26 10:00:00',
    ends_at: '2026-10-10 18:00:00',
    posted_by: 1, // Hostel Office
  },
  // 30. Plumber Sewer Line Desilting
  {
    notice_id: 30,
    category: 'PLUMBER',
    hostel_id: 2,
    title: 'External Stormwater Drain Desilting & Sewer Inspection — BH2 Perimeter',
    body: 'External sewer jetting and manhole cleaning work will be executed around BH2 blocks on 25-26 September 2026. Please avoid parking two-wheelers adjacent to the stormwater drains.',
    is_pinned: 0,
    starts_at: '2026-09-24 09:00:00',
    ends_at: '2026-09-27 18:00:00',
    posted_by: 8, // Caretaker BH1 (covering cluster)
  },
  // 31. Water Quality Results Week 37
  {
    notice_id: 31,
    category: 'WATER_QUALITY',
    hostel_id: null,
    title: 'Weekly Potable Water Quality Laboratory Test Results (Week 37)',
    body: 'Laboratory inspection results for Week 37 (21 Sept 2026) show satisfactory microbiological quality and balanced mineral content across all residential dispensers.',
    is_pinned: 0,
    starts_at: '2026-09-21 14:00:00',
    ends_at: '2026-10-05 23:59:59',
    posted_by: 2, // Chief Warden
  },
  // 32. Electrician Streetlight Maintenance
  {
    notice_id: 32,
    category: 'ELECTRICIAN',
    hostel_id: null,
    title: 'Hostel Complex Pathway Streetlighting & Perimeter Floodlight Upgrades',
    body: 'Installation of high-efficiency LED pathway luminaires along the walkway connecting BH1, BH2, and the Sports Complex will be carried out between 22-24 September 2026.',
    is_pinned: 0,
    starts_at: '2026-09-20 11:00:00',
    ends_at: '2026-09-25 18:00:00',
    posted_by: 1, // Hostel Office
  },
  // 33. Gymnasium Access Timings Circular
  {
    notice_id: 33,
    category: 'GENERAL',
    hostel_id: null,
    title: 'Hostel Fitness Center Operating Hours & Sanitization Protocols',
    body: 'The Student Gymnasium located in the Student Activity Center will operate in two designated daily shifts: Morning (06:00–09:00 IST) and Evening (17:00–21:00 IST). Clean sports footwear and personal hand towels are mandatory for entry.',
    is_pinned: 0,
    starts_at: '2026-09-18 09:00:00',
    ends_at: '2026-10-31 23:59:59',
    posted_by: 2, // Chief Warden
  },
  // 34. Pest Control Fogging Week 37
  {
    notice_id: 34,
    category: 'PEST_CONTROL',
    hostel_id: 4,
    title: 'Comprehensive Fumigation & Anti-Larval Treatment — GH2',
    body: 'Post-monsoon vector mitigation fogging will be conducted in the basement utility corridors and shafts of GH2 on Saturday, 19 Sept 2026 between 16:30 and 18:00 IST.',
    is_pinned: 0,
    starts_at: '2026-09-17 10:00:00',
    ends_at: '2026-09-20 18:00:00',
    posted_by: 9, // Caretaker GH1
  },
  // 35. Water Quality Results Week 36
  {
    notice_id: 35,
    category: 'WATER_QUALITY',
    hostel_id: null,
    title: 'Weekly Potable Water Quality Laboratory Test Results (Week 36)',
    body: 'Testing conducted on 14 Sept 2026 confirmed normal potability parameters across all 4 hostels. Free chlorine residual maintained at 0.24 mg/L.',
    is_pinned: 0,
    starts_at: '2026-09-14 14:00:00',
    ends_at: '2026-09-28 23:59:59',
    posted_by: 2, // Chief Warden
  },
  // 36. Semester Mess Advance Fee Payment Notice
  {
    notice_id: 36,
    category: 'CIRCULAR',
    hostel_id: null,
    title: 'Notice for Submission of Mess Advance Dues (Odd Semester 2026)',
    body: 'All resident students are requested to ensure their semester dining charges of ₹4,500/month are cleared by the 10th of each running month through the State Bank of India Collect portal. Unpaid mess dues will result in temporary suspension of biometric dining access.',
    is_pinned: 0,
    starts_at: '2026-09-12 10:00:00',
    ends_at: '2026-09-26 18:00:00',
    posted_by: 1, // Hostel Office
  },
  // 37. Plumber Solar Water Heater Servicing
  {
    notice_id: 37,
    category: 'PLUMBER',
    hostel_id: 1,
    title: 'Rooftop Solar Water Heating Panel Descaling & Pipe Insulation — BH1',
    body: 'Technical servicing of rooftop solar collector arrays and replacement of damaged glass tubes on BH1 roof will proceed from 15-17 September 2026. Access to the rooftop will remain restricted during this maintenance period.',
    is_pinned: 0,
    starts_at: '2026-09-13 09:00:00',
    ends_at: '2026-09-18 17:00:00',
    posted_by: 8, // Caretaker BH1
  },
  // 38. Electrician LAN Switch Upgrades
  {
    notice_id: 38,
    category: 'ELECTRICIAN',
    hostel_id: 3,
    title: 'Gigabit LAN Switch Replacement in Floor Rack Closets — GH1',
    body: 'Network engineers will replace legacy 100Mbps distribution switches with Gigabit managed switches in GH1 floor server racks on 11-12 September 2026 between 10:00 and 15:00 IST.',
    is_pinned: 0,
    starts_at: '2026-09-10 11:00:00',
    ends_at: '2026-09-13 18:00:00',
    posted_by: 5, // Warden GH1
  },
  // 39. Water Quality Results Week 35
  {
    notice_id: 39,
    category: 'WATER_QUALITY',
    hostel_id: null,
    title: 'Weekly Potable Water Quality Laboratory Test Results (Week 35)',
    body: 'Water samples tested on 07 Sept 2026 met all chemical and microbiological criteria under institutional health standards. TDS: 305 PPM, pH: 7.4.',
    is_pinned: 0,
    starts_at: '2026-09-07 14:00:00',
    ends_at: '2026-09-21 23:59:59',
    posted_by: 2, // Chief Warden
  },
  // 40. Anti-Ragging Affidavit Submission
  {
    notice_id: 40,
    category: 'CIRCULAR',
    hostel_id: null,
    title: 'Mandatory Online Anti-Ragging Undertaking Submission for All Residents',
    body: 'As per Supreme Court of India directives and UGC regulations, every student admitted to university hostels must submit the signed Anti-Ragging Affidavit (Reference Number) to their respective warden office by 15 Sept 2026 without fail.',
    is_pinned: 1,
    starts_at: '2026-09-01 09:00:00',
    ends_at: '2026-09-20 23:59:59',
    posted_by: 2, // Chief Warden
  },
  // 41. Pest Control Monsoon Fogging Drive
  {
    notice_id: 41,
    category: 'PEST_CONTROL',
    hostel_id: null,
    title: 'Campus-wide Intensive Monsoon Fogging & Water Body Treatment',
    body: 'Intensive vector mitigation across rain gullies and lawn borders surrounding all residential buildings will be carried out on 05 Sept 2026. Please keep all balcony doors closed.',
    is_pinned: 0,
    starts_at: '2026-09-04 10:00:00',
    ends_at: '2026-09-07 19:00:00',
    posted_by: 1, // Hostel Office
  },
  // 42. Electrician Power Backup Load Testing
  {
    notice_id: 42,
    category: 'ELECTRICIAN',
    hostel_id: 4,
    title: 'DG Set Maintenance & Automatic Changeover Switch Calibration — GH2',
    body: 'Periodic load testing of the automated transfer switch (ATS) and diesel generator engine oil replacement for GH2 is scheduled for 03 Sept 2026 between 14:00 and 16:00 IST.',
    is_pinned: 0,
    starts_at: '2026-09-02 09:00:00',
    ends_at: '2026-09-04 18:00:00',
    posted_by: 6, // Warden GH2
  },
  // 43. Plumber Water Tank Cleaning GH1
  {
    notice_id: 43,
    category: 'WATER_QUALITY',
    hostel_id: 3,
    title: 'Bi-Monthly Overhead Water Tank Desilting & Scrubbing — GH1',
    body: 'Overhead RCC tanks on the GH1 terrace will undergo mechanical scrubbing and chemical disinfection on 02 Sept 2026. Water supply will be suspended from 10:00 to 14:30 IST.',
    is_pinned: 0,
    starts_at: '2026-09-01 10:00:00',
    ends_at: '2026-09-03 18:00:00',
    posted_by: 9, // Caretaker GH1
  },
  // 44. Waste Segregation & Green Campus Initiative
  {
    notice_id: 44,
    category: 'CIRCULAR',
    hostel_id: null,
    title: 'Green Campus Protocol: Mandatory Two-Bin Waste Segregation in Hostels',
    body: 'Color-coded waste bins (Green for biodegradable food waste, Blue for recyclable dry waste) have been installed on all floors. Residents are strictly advised not to dispose plastic packaging in green bins.',
    is_pinned: 0,
    starts_at: '2026-09-03 11:00:00',
    ends_at: '2026-10-31 23:59:59',
    posted_by: 2, // Chief Warden
  },
  // 45. Guest Policy & Visitors Register Notice
  {
    notice_id: 45,
    category: 'CIRCULAR',
    hostel_id: null,
    title: 'Day Visitor Registration & Strict Prohibition of Unauthorized Overnight Guests',
    body: 'All day visitors (parents, local guardians) must be signed into the caretaker visitor register at hostel security checkposts. Unauthorized overnight stay of day scholars or external guests in resident rooms constitutes severe violation of institutional rules and incurs a ₹5,000 fine.',
    is_pinned: 0,
    starts_at: '2026-09-05 10:00:00',
    ends_at: '2026-11-30 23:59:59',
    posted_by: 1, // Hostel Office
  },
  // 46. Mess Feedback & Dining Grievance Session
  {
    notice_id: 46,
    category: 'GENERAL',
    hostel_id: null,
    title: 'Monthly Open-Door Mess Committee & Resident Feedback Consultation',
    body: 'The Chief Warden and Mess Manager will hold an open consultation session regarding dining quality, food warmth, and portion sizes on Saturday, 07 Nov 2026 at 17:00 IST in the Central Dining Hall. All hostel resident representatives are welcome to attend.',
    is_pinned: 1,
    starts_at: '2026-11-02 12:00:00',
    ends_at: '2026-11-08 19:00:00',
    posted_by: 7, // Mess Manager
  },
];

export async function seedNotices(conn?: mysql.PoolConnection | mysql.Pool) {
  const db = conn || pool;
  console.log('[Seed Notices] Seeding 46 realistic campus notices...');

  await db.query('DELETE FROM notices');

  const insertData = REALISTIC_NOTICES.map((n) => [
    n.notice_id,
    n.category,
    n.hostel_id,
    n.title,
    n.body,
    n.is_pinned,
    n.starts_at,
    n.ends_at,
    n.posted_by,
    null,
  ]);

  await db.query(
    'INSERT INTO notices (notice_id, category, hostel_id, title, body, is_pinned, starts_at, ends_at, posted_by, attachment_url) VALUES ?',
    [insertData]
  );

  console.log(`[Seed Notices] Successfully populated ${REALISTIC_NOTICES.length} realistic notices.`);
}

// Standalone runner
import { fileURLToPath } from 'url';
const isMain = process.argv[1] && (import.meta.url.endsWith(path.basename(process.argv[1])) || process.argv[1].includes('seed-notices'));
if (isMain) {
  seedNotices()
    .then(async () => {
      await closeAllPools();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed Notices Error]:', err);
      await closeAllPools();
      process.exit(1);
    });
}
