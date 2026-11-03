export type Role =
  | 'ADMIN'
  | 'HOSTEL_OFFICE'
  | 'CHIEF_WARDEN'
  | 'WARDEN'
  | 'MESS_MANAGER'
  | 'CARETAKER'
  | 'STUDENT';

export interface Student {
  student_id: number;
  user_id: number;
  roll_no: string;
  full_name: string;
  gender: 'M' | 'F';
  branch: string;
  batch_year: number;
  merit_rank: number;
  schooling_state_id: number;
  schooling_state: string;
  schooling_state_code: string | null;
  home_city_id: number;
  home_city: string;
  home_latitude: number;
  home_longitude: number;
  home_state_id: number;
  home_state: string;
  home_state_code: string | null;
  is_delhi_candidate: number;
  study_habit: 'DAY' | 'NIGHT';
  phone: string | null;
  email: string | null;
  hostel_id: number | null;
  hostel_name: string | null;
  room_id: number | null;
  room_no: string | null;
  floor_no: number | null;
  allotment_id: number | null;
  allotment_status: 'AWAITING' | 'ACCEPTED' | 'DECLINED' | null;
  applications?: Application[];
  roommates?: Roommate[];
  mess_refunds?: {
    total_refunds: number;
    total_amount: number;
    records: MessRefundRecord[];
  };
}

export interface Roommate {
  student_id: number;
  roll_no: string;
  full_name: string;
  gender: 'M' | 'F';
  study_habit: 'DAY' | 'NIGHT';
  allotment_status: string;
}

export interface MessRefundRecord {
  refund_id: number;
  month: number;
  year: number;
  meals_scheduled: number;
  meals_eaten: number;
  refund_amount: number | string;
  status: 'PREVIEW' | 'FINAL';
}

export interface Application {
  application_id: number;
  cycle_id: number;
  academic_year: string;
  cycle_status: 'OPEN' | 'CLOSED' | 'ALLOTTED' | 'PUBLISHED';
  student_id: number;
  roll_no: string;
  full_name: string;
  gender: 'M' | 'F';
  branch: string;
  batch_year: number;
  merit_rank: number;
  schooling_state_id: number;
  schooling_state: string;
  is_delhi_candidate: number;
  home_city_id: number;
  home_city: string;
  home_state: string;
  study_habit: 'DAY' | 'NIGHT';
  distance_km: number;
  distance_band: number;
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  application_status: 'PENDING' | 'ALLOTTED' | 'WAITLISTED' | 'WITHDRAWN';
  applied_at: string;
  verified_by: number | null;
  verified_by_name: string | null;
  hostel_name: string | null;
  room_no: string | null;
}

export interface StateLookup {
  state_id: number;
  state_name: string;
  state_code: string | null;
}

export interface CityLookup {
  city_id: number;
  state_id: number;
  city_name: string;
  latitude: number;
  longitude: number;
}

export interface KPIStats {
  totalApplications: number;
  pendingVerification: number;
  verifiedApplications: number;
  rejectedApplications: number;
  delhiApplications: number;
  nonDelhiApplications: number;
  avgDistanceKm: number;
  totalStudents: number;
  allottedResidents: number;
  totalCapacity: number;
}

export interface KeysetResponse<T> {
  items: T[];
  total: number;
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface PublicApplicant {
  cycle_id: number;
  academic_year: string;
  rank_no: number;
  masked_roll_no: string;
  gender: 'M' | 'F';
  is_delhi_candidate: number;
  priority_group: 'Outside Delhi' | 'Delhi';
  distance_band: number;
  distance_km: number;
  study_habit: 'DAY' | 'NIGHT';
  application_status: 'PENDING' | 'ALLOTTED' | 'WAITLISTED' | 'WITHDRAWN';
  applied_at: string;
  gender_cutoff_rank: number | null;
  is_seated: boolean;
  is_me?: boolean;
}

export interface PoolMeta {
  cycle_id: number;
  academic_year: string;
  cycle_status: string;
  cutoff: {
    M: number;
    F: number;
  };
  capacity: {
    M: number;
    F: number;
  };
}

export interface PoolResponse {
  meta: PoolMeta;
  data: PublicApplicant[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RankExplanationKey {
  key: string;
  label: string;
  value: string | number;
  direction: string;
  higher_count: number;
  explanation: string;
}

export interface RankExplanation {
  student: {
    student_id: number;
    masked_roll_no: string;
    gender: 'M' | 'F';
    rank_no: number;
    application_status: string;
    cutoff_rank: number;
    is_seated: boolean;
  };
  keys: RankExplanationKey[];
  total_in_gender_pool: number;
}

export interface RoomOccupant {
  allotment_id: number;
  student_id: number;
  roll_no: string;
  name: string;
  study_habit: 'DAY' | 'NIGHT';
  allotted_on: string;
  response_status: 'AWAITING' | 'ACCEPTED' | 'DECLINED';
}

export interface RoomBoardItem {
  room_id: number;
  room_no: string;
  floor_no: number;
  capacity: number;
  occupied_count: number;
  study_habit_tag: 'DAY' | 'NIGHT' | null;
  occupants: RoomOccupant[];
}

export interface HostelBoard {
  hostel_id: number;
  hostel_name: string;
  hostel_type: 'BOYS' | 'GIRLS';
  floors: {
    floor_no: number;
    rooms: RoomBoardItem[];
  }[];
}

export interface AllotmentStatusResponse {
  has_allotment: boolean;
  cycle_status?: string;
  application_status?: string;
  allotment?: {
    allotment_id: number;
    cycle_id: number;
    room_id: number;
    room_no: string;
    floor_no: number;
    hostel_name: string;
    response_status: 'AWAITING' | 'ACCEPTED' | 'DECLINED';
    allotted_on: string;
    response_deadline: string | null;
  };
  application?: {
    application_id: number;
    cycle_id: number;
    status: string;
    verification_status: string;
    rank_no?: number;
  };
}

// ============================================================================
// Phase 6 Types: Notices, Water Quality, Maintenance & Notifications
// ============================================================================

export type NoticeCategory =
  | 'CIRCULAR'
  | 'WATER_QUALITY'
  | 'PEST_CONTROL'
  | 'ELECTRICIAN'
  | 'PLUMBER'
  | 'GENERAL';

export interface NoticeItem {
  notice_id: number;
  category: NoticeCategory;
  hostel_id: number | null;
  hostel_name: string | null;
  title: string;
  body: string | null;
  is_pinned: number | boolean;
  starts_at: string | null;
  ends_at: string | null;
  posted_by_name: string | null;
}

export interface WaterLimits {
  tdsMax: number;
  phMin: number;
  phMax: number;
  chlorineMin: number;
  chlorineMax: number;
}

export interface WaterReportItem {
  report_id: number;
  hostel_id: number;
  hostel_name: string;
  week_start: string;
  tds_ppm: number;
  ph: number;
  chlorine_mgl: number;
  verdict: 'SAFE' | 'UNSAFE';
  remarks: string | null;
  posted_by_name: string | null;
}

export interface WaterTrendResponse {
  hostel_id: number;
  hostel_name: string;
  limits: WaterLimits;
  reports: WaterReportItem[];
}

export type MaintenanceType =
  | 'MOSQUITO_SPRAY'
  | 'ELECTRICIAN'
  | 'PLUMBER'
  | 'TANK_CLEANING'
  | 'PEST_CONTROL';

export type MaintenanceStatus = 'SCHEDULED' | 'DONE' | 'CANCELLED';

export interface MaintenanceScheduleItem {
  schedule_id: number;
  hostel_id: number;
  hostel_name: string;
  maint_type: MaintenanceType;
  block: string | null;
  floor_no: number | null;
  sched_date: string;
  time_slot: string | null;
  status: MaintenanceStatus;
  posted_by_name: string | null;
}

export interface NotificationItem {
  notif_id: number;
  user_id: number;
  notif_type: 'NOTICE' | 'WATER_QUALITY' | 'MAINTENANCE' | 'ALLOTMENT' | 'COMPLAINT';
  title: string;
  body: string | null;
  link: string | null;
  is_read: number | boolean;
  created_at: string;
}


export type MachineStatus = 'FREE' | 'OCCUPIED' | 'OUT_OF_ORDER';

export interface WashingMachineItem {
  machine_id: number;
  hostel_id: number;
  hostel_name: string;
  label: string;
  floor_no: number;
  status: MachineStatus;
  current_student_id: number | null;
  current_student_roll_no: string | null;
  current_student_name: string | null;
  started_at: string | null;
  expected_end_at: string | null;
  seconds_remaining: number | null;
  minutes_remaining: number | null;
  isMyWash?: boolean;
  qrPayload?: string;
  signature?: string;
}

export interface LaundryHistoryItem {
  log_id: number;
  machine_id: number;
  machine_label: string;
  hostel_id: number;
  hostel_name: string;
  floor_no: number;
  student_id: number;
  student_roll_no: string;
  student_name: string;
  started_at: string;
  ended_at: string | null;
  end_reason: 'FINISHED' | 'AUTO_RELEASED' | null;
  duration_minutes: number;
}
